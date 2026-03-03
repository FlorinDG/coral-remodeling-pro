import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
import path from "path";

// Load .env from the root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

async function testConnection() {
    console.log("--- Notion Connection Test ---");
    console.log("Using Token:", process.env.NOTION_TOKEN ? `${process.env.NOTION_TOKEN.substring(0, 7)}...` : "MISSING");

    const databases = {
        LEADS: process.env.NOTION_LEADS_DATABASE_ID,
        BOOKINGS: process.env.NOTION_BOOKINGS_DATABASE_ID,
        SERVICES: process.env.NOTION_SERVICES_DATABASE_ID,
        PORTALS: process.env.NOTION_PORTALS_DATABASE_ID,
        TASKS: process.env.NOTION_TASKS_DATABASE_ID,
    };

    for (const [name, id] of Object.entries(databases)) {
        if (!id) {
            console.warn(`[${name}] Database ID is MISSING in .env`);
            continue;
        }

        console.log(`\nTesting [${name}] Database (ID: ${id.substring(0, 4)}...${id.substring(id.length - 4)}):`);
        try {
            const response: any = await notion.databases.retrieve({ database_id: id });
            console.log(`✅ Success! Title: ${response.title?.[0]?.plain_text || "No Title"}`);

            // Test query - using any because of the non-standard dataSources usage seen in codebase
            try {
                const query = await (notion as any).databases.query({ database_id: id, page_size: 1 });
                console.log(`✅ Query successful. Found ${query.results.length} items.`);
            } catch (qError: any) {
                console.warn(`⚠️ Query failed but retrieve worked: ${qError.message}`);
            }
        } catch (error: any) {
            console.error(`❌ Failed: ${error.message}`);
            if (error.body) {
                console.error("Error Detail:", JSON.parse(error.body));
            }
        }
    }
}

testConnection();
