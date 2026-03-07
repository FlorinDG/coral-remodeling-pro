import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export async function POST(request: Request) {
    try {
        const { databaseId, token } = await request.json();

        if (!databaseId) {
            return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
        }

        // Use provided token or fallback to global one
        const authToken = token || process.env.NOTION_TOKEN;

        if (!authToken) {
            return NextResponse.json({ error: "No Notion token provided or configured" }, { status: 400 });
        }

        const client = new Client({ auth: authToken });

        // Attempt to retrieve the database to verify access and existence
        const response = await client.databases.retrieve({ database_id: databaseId });

        return NextResponse.json({
            success: true,
            title: (response as any).title?.[0]?.plain_text || "Untitled Database",
            message: "Connection verified! The integration has access to this database."
        });
    } catch (error: any) {
        console.error("Notion test connection error:", error);

        let errorMessage = "Failed to connect to Notion";

        if (error.status === 401) {
            errorMessage = "Invalid Token. Please check your Internal Integration Secret.";
        } else if (error.status === 404) {
            errorMessage = "Database not found. Ensure the ID is correct and the integration is shared with the database.";
        } else if (error.code === "object_not_found") {
            errorMessage = "Database not found. Did you forget to 'Connect' your integration to this database in Notion?";
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json({ error: errorMessage }, { status: error.status || 500 });
    }
}
