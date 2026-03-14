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
                };
            }
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "google") {
                // Prevent creating random users via Google OAuth directly.
                // We only want to allow linking or logging in if the email already exists in our system.
                if (user.email) {
                    const existingUser = await prisma.user.findUnique({
                        where: { email: user.email }
                    });

                    // Allow linking if the user is already logged in (they are trying to link an account)
                    const cookieStore = await cookies();
                    const sessionToken = cookieStore.get("authjs.session-token")?.value || cookieStore.get("__Secure-authjs.session-token")?.value;
                    let isLoggedIn = false;

                    if (sessionToken) {
                        const session = await prisma.session.findUnique({
                            where: { sessionToken }
                        });
                        isLoggedIn = !!session;
                    }

                    if (!existingUser && !isLoggedIn) {
                        return false; // Reject standalone Google login for unknown emails
                    }
                }
            }
            return true;
        },
        ...authConfig.callbacks
    }
});
