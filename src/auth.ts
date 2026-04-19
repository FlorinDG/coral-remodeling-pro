import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { cookies } from "next/headers";
import { verifyPassword } from "@/lib/password";

console.log("[DEBUG AUTH] Google Client ID loaded:", !!process.env.GOOGLE_CLIENT_ID);

// Verification lifecycle thresholds (in milliseconds)
const GRACE_PERIOD_MS   = 3 * 24 * 60 * 60 * 1000; // 3 days — unverified but active
const WARNING_PERIOD_MS = 4 * 24 * 60 * 60 * 1000; // 4 days total — after this, hard block

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    prompt: "consent select_account",
                    access_type: "offline",
                    response_type: "code",
                    // Keep scope minimal — only what's needed for login.
                    // Calendar scopes (calendar.readonly, calendar.events) require
                    // Google app verification and will break OAuth for unverified apps.
                    // Re-add them once the app passes Google's verification review.
                    scope: "openid email profile",
                },
            },
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email:    { label: "Email",    type: "email"    },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: (credentials.email as string).toLowerCase().trim() },
                });

                if (!user || !user.password) return null;

                // bcrypt for hashed passwords, plaintext fallback for legacy seeds
                const isPasswordValid = user.password.startsWith("$2")
                    ? await verifyPassword(credentials.password as string, user.password)
                    : credentials.password === user.password;

                if (!isPasswordValid) return null;

                // Verification lifecycle check
                if (!user.emailVerified && user.verificationSentAt) {
                    const elapsed = Date.now() - new Date(user.verificationSentAt).getTime();
                    if (elapsed > WARNING_PERIOD_MS) throw new Error("VERIFICATION_HARD_BLOCK");
                    if (elapsed > GRACE_PERIOD_MS)   throw new Error("VERIFICATION_WARNING_BLOCK");
                    // Within grace period — allow login but unverified
                }

                return {
                    id:            user.id,
                    name:          user.name,
                    email:         user.email,
                    role:          user.role,
                    tenantId:      (user as any).tenantId,
                    emailVerified: user.emailVerified,
                };
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,

        async signIn({ user, account }) {
            // Allow all sign-ins. Google OAuth users get auto-provisioned in jwt().
            return true;
        },

        // ── Post-login redirect ──────────────────────────────────────────────────
        // Always land on the ERP app subdomain after authentication.
        // Without this, NextAuth follows NEXTAUTH_URL (may be coral-group.be / coral-sys)
        // instead of app.coral-group.be, causing the "routes back to coral-sys" bug.
        // The app subdomain is a fixed constant — no env var needed.
        async redirect({ url, baseUrl }) {
            const APP_ORIGIN = "https://app.coral-group.be";

            // Already on the right domain — honour the destination.
            if (url.startsWith(APP_ORIGIN)) return url;

            // Relative path (/nl/admin, /login, etc.) — prefix with app domain.
            if (url.startsWith("/")) return `${APP_ORIGIN}${url}`;

            // Anything else (e.g. wrong domain) — send to app root.
            return `${APP_ORIGIN}/`;
        },

        // ── JWT — token enrichment & Google auto-provisioning ────────────────────
        async jwt({ token, user, trigger, session }) {
            // Let authConfig's base jwt run first
            if (authConfig.callbacks?.jwt) {
                token = await authConfig.callbacks.jwt({
                    token, user, trigger, session,
                    account: null as any, profile: undefined, isNewUser: undefined,
                });
            }

            // Handle session.update() calls — e.g., after saving language preference
            // This keeps the JWT in sync without requiring a full sign-out/sign-in.
            if (trigger === 'update' && session) {
                if (session.environmentLanguage !== undefined) token.environmentLanguage = session.environmentLanguage;
                if (session.role              !== undefined) token.role              = session.role;
                if (session.tenantId          !== undefined) token.tenantId          = session.tenantId;
            }

            if (user && user.email) {
                let dbUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });

                // Auto-provision a Tenant workspace for first-time Google OAuth users
                if (dbUser && !dbUser.tenantId) {
                    const FOUNDING_CAP = 20;
                    const tenantCount  = await prisma.tenant.count();
                    if (tenantCount >= FOUNDING_CAP) {
                        // Beta is full — token without tenantId (handled gracefully in UI)
                        return token;
                    }

                    const cookieStore = await cookies();
                    const nextLocale  = cookieStore.get("NEXT_LOCALE")?.value || "fr";

                    const newTenant = await prisma.tenant.create({
                        data: {
                            companyName:        user.name ? `${user.name}'s Workspace` : "New Workspace",
                            planType:           "FOUNDER",
                            subscriptionStatus: "ACTIVE",
                            activeModules:      ["INVOICING"],
                            documentLanguage:   nextLocale,
                        },
                    });

                    dbUser = await prisma.user.update({
                        where: { id: dbUser.id },
                        data: {
                            tenantId:            newTenant.id,
                            role:                "APP_MANAGER",
                            environmentLanguage: nextLocale,
                        },
                    });
                }

                if (dbUser) {
                    token.role                = dbUser.role;
                    token.tenantId            = dbUser.tenantId;
                    token.environmentLanguage = dbUser.environmentLanguage;
                    token.emailVerified       = dbUser.emailVerified ? true : false;

                    // Fetch activeModules + planType for middleware route gating.
                    // Stored in JWT so the edge middleware can read them without a DB call.
                    // Refreshed on every sign-in — stale window = updateAge (30 min max).
                    if (dbUser.tenantId) {
                        const tenant = await prisma.tenant.findUnique({
                            where:  { id: dbUser.tenantId },
                            select: { activeModules: true, planType: true },
                        });
                        token.activeModules = tenant?.activeModules ?? ['INVOICING'];
                        token.planType      = tenant?.planType ?? 'FREE';
                    }
                }
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role                = token.role;
                (session.user as any).tenantId            = token.tenantId;
                (session.user as any).environmentLanguage = token.environmentLanguage;
                (session.user as any).emailVerified       = token.emailVerified;
                (session.user as any).activeModules       = token.activeModules ?? ['INVOICING'];
                (session.user as any).planType            = token.planType ?? 'FREE';
            }
            return session;
        },
    },
});
