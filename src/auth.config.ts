import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as { role?: string }).role;
                token.id = user.id;
                token.tenantId = (user as { tenantId?: string | null }).tenantId;
                token.emailVerified = !!(user as unknown as { emailVerified?: Date | null }).emailVerified;
                token.environmentLanguage = (user as { environmentLanguage?: string | null }).environmentLanguage;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { role?: string }).role = token.role as string;
                session.user.id = token.id as string;
                (session.user as { tenantId?: string | null }).tenantId = token.tenantId as string | null;
                (session.user as unknown as { emailVerified?: boolean }).emailVerified = token.emailVerified as boolean;
                (session.user as any).environmentLanguage = token.environmentLanguage as string | null;
            }
            return session;
        }
    },
    providers: [], // Add providers with an empty array for edge compatibility
    session: {
        strategy: "jwt",
        // OWASP-compliant session timeouts for SaaS:
        // - maxAge: 8 hours absolute timeout (session dies regardless of activity)
        // - updateAge: 30 minutes (token refreshed on activity, acts as idle timeout)
        maxAge: 8 * 60 * 60,    // 8 hours absolute
        updateAge: 30 * 60,     // 30 min idle refresh
    },
    secret: process.env.AUTH_SECRET || "coral-secret-12345",
} satisfies NextAuthConfig;
