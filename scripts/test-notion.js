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

            if (response.data_sources && response.data_sources.length > 0) {
                const dsId = response.data_sources[0].id;
                console.log(`Found Data Source: ${dsId}`);
                try {
                    // Try to list property information using an internal or raw request if possible
                    // Since it's a sync database, properties might be under the data source
                    const dsResponse = await (notion).request({
                        path: `data_sources/${dsId}`,
                        method: "GET"
                    });
                    console.log("Data Source Details:", JSON.stringify(dsResponse, null, 2));
                } catch (e) {
                    console.log("Could not fetch data source details.");
                }
            }

            if (name === "LEADS") {
                console.log("Databases Methods:", Object.keys(notion.databases));
            }

            // Attempt to query to find properties from a page
            try {
                const query = await notion.databases.query({ database_id: id, page_size: 1 });
                console.log(`✅ Query successful. Found ${query.results.length} items.`);
                if (query.results.length > 0) {
                    console.log("Sample Properties (from result):");
                    const props = query.results[0].properties;
                    for (const key in props) {
                        console.log(`  - "${key}" (${props[key].type})`);
                    }
                }
            } catch (qError) {
                console.log(`❌ Query failed: ${qError.message}`);
                if (qError.body) {
                    console.error("Query Error Body:", qError.body);
                }
            }
        } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
            if (error.body) {
                console.error("Error Detail:", error.body);
            }
        }
    }
}

testConnection();
