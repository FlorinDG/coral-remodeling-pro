import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { NextResponse } from "next/server";
import { getPortalById, getPortalBySlug } from "@/lib/data/portals";
import { authSecret } from "@/lib/auth-secret";

export const PORTAL_SESSION_COOKIE = "portal_session";
export const PORTAL_SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

function getPortalSecret(): string {
    return process.env.PORTAL_AUTH_SECRET || authSecret(); // AUTH-SECRET-1: no default secret
}

export interface PortalSessionPayload {
    portalId: string;
    exp: number;
}

export function signPortalSessionToken(portalId: string): string {
    const exp = Date.now() + PORTAL_SESSION_MAX_AGE * 1000;
    const payload: PortalSessionPayload = { portalId, exp };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
        .createHmac("sha256", getPortalSecret())
        .update(payloadStr)
        .digest("base64url");
    return `${payloadStr}.${signature}`;
}

export function verifyPortalSessionToken(token: string): { portalId: string } | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 2) return null;
        const [payloadStr, signature] = parts;
        const expectedSig = crypto
            .createHmac("sha256", getPortalSecret())
            .update(payloadStr)
            .digest("base64url");

        if (signature.length !== expectedSig.length) return null;
        const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
        if (!isValid) return null;

        const payload: PortalSessionPayload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf-8"));
        if (!payload.portalId || !payload.exp) return null;
        if (Date.now() > payload.exp) return null;

        return { portalId: payload.portalId };
    } catch {
        return null;
    }
}

export function setPortalSessionCookie(response: NextResponse, portalId: string): void {
    const token = signPortalSessionToken(portalId);
    response.cookies.set(PORTAL_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PORTAL_SESSION_MAX_AGE,
    });
}

export function clearPortalSessionCookie(response: NextResponse): void {
    response.cookies.delete(PORTAL_SESSION_COOKIE);
}

export function getPortalTokenFromRequest(request: Request): string | null {
    // 1. From Cookie header
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
        const cookies = cookieHeader.split(";").map(c => c.trim());
        for (const c of cookies) {
            if (c.startsWith(`${PORTAL_SESSION_COOKIE}=`)) {
                return decodeURIComponent(c.substring(PORTAL_SESSION_COOKIE.length + 1));
            }
        }
    }

    // 2. From Authorization header: Bearer <token>
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        return authHeader.substring(7).trim();
    }

    return null;
}

export type PortalAuthResult =
    | { success: true; portal: any; tenantId: string; fromSession?: boolean; newSession?: boolean; isErpAdmin?: boolean }
    | { success: false; status: number; error: string; unverified?: boolean; portal?: any };

export async function verifyPortalAccess(
    request: Request,
    options: {
        portalId?: string;
        slug?: string;
        explicitPassword?: string | null;
        preloadedPortal?: any;
    }
): Promise<PortalAuthResult> {
    const portal = options.preloadedPortal
        ? options.preloadedPortal
        : options.slug
        ? await getPortalBySlug(options.slug)
        : options.portalId
        ? await getPortalById(options.portalId)
        : null;

    if (!portal) {
        return { success: false, status: 404, error: "Portal not found" };
    }

    // PORTAL-4: If portal has no password, access is granted
    if (!portal.password) {
        return { success: true, portal, tenantId: portal.tenantId };
    }

    // Check signed session token from cookie or Authorization header
    const token = getPortalTokenFromRequest(request);
    if (token) {
        const session = verifyPortalSessionToken(token);
        if (session && session.portalId === portal.id) {
            return { success: true, portal, tenantId: portal.tenantId, fromSession: true };
        }
    }

    // Check explicit password if provided
    if (options.explicitPassword) {
        const isValid = await bcrypt.compare(options.explicitPassword, portal.password);
        if (isValid) {
            return { success: true, portal, tenantId: portal.tenantId, newSession: true };
        } else {
            return { success: false, status: 401, error: "Invalid password" };
        }
    }

    // Check if Bearer header contained the raw password
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        const bearer = authHeader.substring(7).trim();
        // If it wasn't a session token, test if it matches raw password
        const isValid = await bcrypt.compare(bearer, portal.password);
        if (isValid) {
            return { success: true, portal, tenantId: portal.tenantId, newSession: true };
        } else {
            return { success: false, status: 401, error: "Invalid password" };
        }
    }

    // Check if request is authenticated as an ERP user/admin for this tenant
    try {
        const { auth } = await import("@/auth");
        const session = await auth();
        if (session?.user?.tenantId && session.user.tenantId === portal.tenantId) {
            return { success: true, portal, tenantId: portal.tenantId, isErpAdmin: true };
        }
    } catch {
        // Ignore session read error
    }

    // No valid credentials provided
    return {
        success: false,
        status: 401,
        error: "Password required",
        unverified: true,
        portal
    };
}
