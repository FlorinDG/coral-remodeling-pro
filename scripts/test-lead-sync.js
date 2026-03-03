const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const notion = new Client({
    auth: process.env.NOTION_TOKEN,
});

async function syncLeadToNotion(lead) {
    const databaseId = "317891ec-7c9f-8028-a1ca-000ba499d5bb"; // LEADS DATA SOURCE ID
    console.log(`Syncing lead to Data Source ID: ${databaseId}`);

    try {
        const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                "id": { title: [{ text: { content: lead.id } }] },
                "Name": { rich_text: [{ text: { content: lead.name } }] },
                "Email": { email: lead.email },
                "Phone": { phone_number: lead.phone || "" },
                "Service": { select: { name: lead.service } },
                "Message": { rich_text: [{ text: { content: lead.message || "" } }] },
                "Status": { select: { name: lead.status } },
                "Created At": { date: { start: lead.createdAt.toISOString() } },
            },
        });
        console.log("✅ Lead synced successfully. Page ID:", response.id);
    } catch (error) {
        console.error("❌ Failed to sync lead to Notion:");
        if (error.body) {
            console.error(JSON.parse(error.body));
        } else {
            console.error(error.message);
        }
    }
}

async function runTest() {
    const testLead = {
        id: "test-" + Date.now(),
        name: "Test User",
        email: "test@example.com",
        phone: "+3212345678",
        service: "Kitchen", // Matches Notion option "Kitchen"
        message: "This is a test message",
        status: "NEW", // Matches Notion option "NEW"
        createdAt: new Date()
    };

    await syncLeadToNotion(testLead);
}

runTest();
