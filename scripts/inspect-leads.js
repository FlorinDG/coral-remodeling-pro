const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

async function inspectLeads() {
    const databaseId = process.env.NOTION_LEADS_DATABASE_ID;
    console.log(`Inspecting Leads Database: ${databaseId}`);

    try {
        const response = await notion.databases.retrieve({ database_id: databaseId });
        console.log(`✅ Success! Title: ${response.title?.[0]?.plain_text || "No Title"}`);

        if (response.properties) {
            console.log("\n--- Database Properties ---");
            for (const [name, prop] of Object.entries(response.properties)) {
                console.log(`Property: "${name}" (Type: ${prop.type})`);
            }
        }

        if (response.data_sources && response.data_sources.length > 0) {
            const dsId = response.data_sources[0].id;
            console.log(`\nFound Data Source: ${dsId}`);
            try {
                const dsResponse = await (notion).request({
                    path: `data_sources/${dsId}`,
                    method: "GET"
                });

                console.log("\n--- Data Source Properties ---");
                for (const [name, prop] of Object.entries(dsResponse.properties)) {
                    console.log(`Property: "${name}" (Type: ${prop.type})`);
                    if (prop.type === "select") {
                        console.log("  Options:", prop.select.options.map(o => o.name).join(", "));
                    } else if (prop.type === "status") {
                        console.log("  Options:", prop.status.options.map(o => o.name).join(", "));
                    }
                }
            } catch (e) {
                console.log("Could not fetch data source details:", e.message);
            }
        }

    } catch (error) {
        console.error("Error:", error.message);
        if (error.body) console.error(error.body);
    }
}

inspectLeads();
