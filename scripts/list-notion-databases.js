const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

async function listDatabases() {
    console.log("Listing all accessible databases...");
    try {
        const response = await notion.search({
            filter: {
                property: "object",
                value: "data_source",
            },
        });

        console.log(`Found ${response.results.length} databases:`);
        response.results.forEach((db) => {
            console.log(`- Title: ${db.title?.[0]?.plain_text || "No Title"}`);
            console.log(`  ID: ${db.id}`);
            console.log(`  URL: ${db.url}\n`);
        });
    } catch (error) {
        console.error("Error:", error.message);
        if (error.body) console.error(error.body);
    }
}

listDatabases();
