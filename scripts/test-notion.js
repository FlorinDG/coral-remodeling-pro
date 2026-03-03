const { Client } = require("@notionhq/client");

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

async function testConnection() {
    console.log("--- Notion Connection Test (JS) ---");
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
            const response = await notion.databases.retrieve({ database_id: id });
            console.log(`✅ Success! Title: ${response.title?.[0]?.plain_text || "No Title"}`);

            console.log("Properties found:");
            Object.keys(response.properties).forEach(prop => {
                console.log(`  - ${prop} (${response.properties[prop].type})`);
            });

            // Test query to check permissions further
            const query = await notion.databases.query({ database_id: id, page_size: 1 });
            console.log(`✅ Query successful. Found ${query.results.length} items.`);
        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
            if (error.body) {
                console.error("Error Detail:", error.body);
            }
        }
    }
}

testConnection();
