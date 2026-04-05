import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { cookies } from "next/headers";

console.log("[DEBUG AUTH] Google Client ID loaded:", !!process.env.GOOGLE_CLIENT_ID);

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
                    scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events"
                }
            }
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string }
                });

                if (!user || !user.password) return null;

                const isPasswordValid = credentials.password === user.password;

                if (!isPasswordValid) return null;

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    tenantId: (user as any).tenantId, // Multi-tenant binding
                };
            }
        })
    ],
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account }) {
            // For MVP release, we allow anyone to authenticate via Google OAuth.
            // Brand new users will have a database `User` injected by the Prisma Adapter.
            // The `jwt` callback below handles their architectural `Tenant` onboarding.
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            // First run authConfig jwt explicitly to avoid edge issues
            if (authConfig.callbacks?.jwt) {
                token = await authConfig.callbacks.jwt({ token, user, trigger, session, account: null as any, profile: undefined, isNewUser: undefined });
            }

            // On initial sign in, aggressively inject the database properties into the token
            if (user && user.email) {
                let dbUser = await prisma.user.findUnique({
                    where: { email: user.email }
                });

                // SaaS MVP Auto-Provisioning: If user exists but is lacking an overarching Tenant workspace, generate one dynamically.
                if (dbUser && !dbUser.tenantId) {
                    const cookieStore = await cookies();
                    const nextLocale = cookieStore.get('NEXT_LOCALE')?.value || 'fr';

                    const newTenant = await prisma.tenant.create({
                        data: {
                            companyName: user.name ? `${user.name}'s Workspace` : 'New Workspace',
                            planType: "FREE",
                            subscriptionStatus: "ACTIVE",
                            activeModules: ["INVOICING"], // strictly isolated free tier default
                            documentLanguage: nextLocale
                        }
                    });

                    dbUser = await prisma.user.update({
                        where: { id: dbUser.id },
                        data: {
                            tenantId: newTenant.id,
                            role: "TENANT_ADMIN",
                            environmentLanguage: nextLocale
                        }
                    });
                }

                if (dbUser) {
                    token.role = dbUser.role;
                    token.tenantId = dbUser.tenantId;
                    token.environmentLanguage = dbUser.environmentLanguage;
                }
            }
            return token;
        }
    }
});
