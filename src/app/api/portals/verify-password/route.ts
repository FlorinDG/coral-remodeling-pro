import { NextResponse } from "next/server";
import { verifyPortalAccess, setPortalSessionCookie } from "@/lib/portal-auth";

export async function POST(request: Request) {
    try {
        const { id, password } = await request.json();
        if (!id) {
            return NextResponse.json({ success: false, error: "Portal ID required" }, { status: 400 });
        }

        const authResult = await verifyPortalAccess(request, { portalId: id, explicitPassword: password });
        if (authResult.success) {
            const response = NextResponse.json({ success: true });
            setPortalSessionCookie(response, authResult.portal.id);
            return response;
        } else {
            return NextResponse.json(
                { success: false, error: authResult.error || "Invalid password" },
                { status: authResult.status || 401 }
            );
        }
    } catch (error) {
        return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
}
