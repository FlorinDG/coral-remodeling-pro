import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    try {
        const { id, password } = await request.json();

        const portal = await prisma.clientPortal.findUnique({
            where: { id },
            select: { password: true }
        });

        if (!portal || !portal.password) {
            return NextResponse.json({ success: false, error: "No password set" }, { status: 400 });
        }

        const isValid = await bcrypt.compare(password, portal.password);

        if (isValid) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: "Invalid password" }, { status: 401 });
        }
    } catch (error) {
        return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
}
