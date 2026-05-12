import { DefaultSession } from "next-auth";
import { Role } from "@/lib/roles";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role?: Role;
            tenantId?: string | null;
            environmentLanguage?: string | null;
            emailVerified?: boolean;
            activeModules?: string[];
            planType?: string;
        } & DefaultSession["user"]
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
        role?: Role | string;
        tenantId?: string | null;
        environmentLanguage?: string | null;
        emailVerified?: boolean;
        activeModules?: string[];
        planType?: string;
    }
}
