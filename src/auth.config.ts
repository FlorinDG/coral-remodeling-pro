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
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { role?: string }).role = token.role as string;
                session.user.id = token.id as string;
                (session.user as { tenantId?: string | null }).tenantId = token.tenantId as string | null;
            }
            return session;
        }
    },
    providers: [], // Add providers with an empty array for edge compatibility
    session: {
        strategy: "jwt",
    },
    secret: process.env.AUTH_SECRET || "coral-secret-12345",
} satisfies NextAuthConfig;
