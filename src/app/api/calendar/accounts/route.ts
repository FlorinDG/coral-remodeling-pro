import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/googleToken";

export const GET = auth(async function GET(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get Google connected accounts for the user
        const accounts = await prisma.account.findMany({
            where: {
                userId: req.auth.user.id,
                provider: "google",
            },
        });

        if (accounts.length === 0) {
            return NextResponse.json({ accounts: [] });
        }

        const accountsWithCalendars = await Promise.all(
            accounts.map(async (account) => {
                const validToken = await getValidAccessToken(account.id);
                if (!validToken) return null;

                try {
                    const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
                        headers: {
                            Authorization: `Bearer ${validToken}`,
                        },
                    });

                    if (!response.ok) {
                        return { accountId: account.id, email: account.providerAccountId, calendars: [], error: "Failed to fetch" };
                    }

                    const data = await response.json();
                    return {
                        accountId: account.id,
                        email: "Google Account", // Often we need an email, but the token itself grants access. providerAccountId is usually the google ID. 
                        calendars: data.items.map((c: any) => ({
                            id: c.id,
                            summary: c.summary,
                            colorId: c.colorId,
                            backgroundColor: c.backgroundColor,
                        }))
                    };
                } catch (e) {
                    return null;
                }
            })
        );

        return NextResponse.json({
            accounts: accountsWithCalendars.filter(Boolean)
        });
    } catch (error) {
        console.error("GET /api/calendar/accounts Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});

export const DELETE = auth(async function DELETE(req: any) {
    try {
        if (!req.auth?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const url = new URL(req.url);
        const accountId = url.searchParams.get("accountId");

        if (!accountId) {
            return new NextResponse("Missing accountId", { status: 400 });
        }

        const account = await prisma.account.findUnique({
            where: { id: accountId }
        });

        if (!account || account.userId !== req.auth.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        await prisma.account.delete({
            where: { id: accountId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/calendar/accounts Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
});
