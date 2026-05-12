/* eslint-disable @typescript-eslint/no-explicit-any */
import { DefaultSession } from "next-auth";
import { Role } from "@/lib/roles";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
            role?: Role;
            tenantId?: string | null;
            environmentLanguage?: string | null;
            emailVerified?: any;
            activeModules?: string[];
            planType?: string;
        }
    }

    interface User {
        role?: Role | string;
        tenantId?: string | null;
        environmentLanguage?: string | null;
        emailVerified?: Date | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        name?: string | null;
        email?: string | null;
        picture?: string | null;
        sub?: string;
        role?: Role | string;
        tenantId?: string | null;
        environmentLanguage?: string | null;
        emailVerified?: any;
        activeModules?: string[];
        planType?: string;
    }
}
