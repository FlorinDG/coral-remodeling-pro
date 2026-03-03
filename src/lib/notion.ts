import { Client } from "@notionhq/client";

const notion = new Client({
    auth: process.env.NOTION_TOKEN as string,
});

export interface NotionPortal {
    notionId: string;
    id: string;
    clientName: string;
    clientEmail: string;
    slug: string;
    status: string;
    updatedAt: Date;
}

export interface NotionTask {
    notionId: string;
    id: string;
    title: string;
    status: string;
    portalNotionId: string;
    updatedAt: Date;
}

export async function syncLeadToNotion(lead: any) {
    const databaseId = process.env.NOTION_LEADS_DATABASE_ID;
    if (!process.env.NOTION_TOKEN || !databaseId) {
        console.warn("Notion token or Leads Database ID missing, skipping sync.");
        return;
    }

    try {
        console.log(`Syncing lead ${lead.id} to Notion database ${databaseId.substring(0, 5)}...`);
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
                "Created at": { date: { start: lead.createdAt.toISOString() } },
            },
        });
        console.log(`Lead ${lead.id} successfully synced to Notion. Page ID: ${response.id}`);
    } catch (error: any) {
        console.error("Failed to sync lead to Notion:");
        if (error.body) {
            console.error("Notion API Error Body:", JSON.parse(error.body));
        } else {
            console.error("Error Message:", error.message || error);
        }
    }
}

export async function syncBookingToNotion(booking: any) {
    const databaseId = process.env.NOTION_BOOKINGS_DATABASE_ID;
    if (!process.env.NOTION_TOKEN || !databaseId) {
        console.warn("Notion token or Bookings Database ID missing, skipping sync.");
        return;
    }

    try {
        console.log(`Syncing booking ${booking.id} to Notion database ${databaseId.substring(0, 5)}...`);
        const response = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                "id": { title: [{ text: { content: booking.id } }] },
                "Client Name": { rich_text: [{ text: { content: booking.clientName } }] },
                "Client Email": { email: booking.clientEmail },
                "Service Type": { select: { name: booking.serviceType } },
                "Date": { date: { start: booking.date.toISOString() } },
                "Time Slot": { rich_text: [{ text: { content: booking.timeSlot } }] },
                "Status": { select: { name: booking.status } },
                "Created At": { date: { start: booking.createdAt.toISOString() } },
            },
        });
        console.log(`Booking ${booking.id} successfully synced to Notion. Page ID: ${response.id}`);
    } catch (error: any) {
        console.error("Failed to sync booking to Notion:");
        if (error.body) {
            console.error("Notion API Error Body:", JSON.parse(error.body));
        } else {
            console.error("Error Message:", error.message || error);
        }
    }
}

export async function getServicesFromNotion() {
    const databaseId = process.env.NOTION_SERVICES_DATABASE_ID;
    if (!process.env.NOTION_TOKEN || !databaseId) return [];

    const response = await (notion as any).dataSources.query({
        data_source_id: databaseId,
    });

    return response.results.map((page: any) => {
        const props = page.properties;
        return {
            slug: props.slug?.title[0]?.plain_text,
            titleEn: props["Title EN"]?.rich_text[0]?.plain_text,
            titleNl: props["Title NL"]?.rich_text[0]?.plain_text,
            descriptionEn: props["Description EN"]?.rich_text[0]?.plain_text,
            fullDescriptionEn: props["Full Description EN"]?.rich_text[0]?.plain_text,
            order: props["Order"]?.number,
        };
    });
}

export async function syncPortalToNotion(portal: any) {
    const databaseId = process.env.NOTION_PORTALS_DATABASE_ID;
    if (!process.env.NOTION_TOKEN || !databaseId) return;

    try {
        await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                "id": { title: [{ text: { content: portal.id } }] },
                "Client Name": { rich_text: [{ text: { content: portal.clientName } }] },
                "Client Email": { email: portal.clientEmail },
                "Slug": { rich_text: [{ text: { content: portal.slug } }] },
                "Status": { select: { name: portal.status } },
                "Created At": { date: { start: portal.createdAt.toISOString() } },
                "Updated At": { date: { start: portal.updatedAt.toISOString() } },
            },
        });
    } catch (error) {
        console.error("Failed to sync portal to Notion:", error);
    }
}

export async function syncTaskToNotion(task: any, portalPageId?: string) {
    const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
    if (!process.env.NOTION_TOKEN || !databaseId) return;

    try {
        const properties: any = {
            "id": { title: [{ text: { content: task.id } }] },
            "Title": { rich_text: [{ text: { content: task.title } }] },
            "Status": { select: { name: task.status } },
            "Created At": { date: { start: task.createdAt.toISOString() } },
            "Updated At": { date: { start: task.updatedAt.toISOString() } },
        };

        if (portalPageId) {
            properties["Portal"] = { relation: [{ id: portalPageId }] };
        }

        await notion.pages.create({
            parent: { database_id: databaseId },
            properties,
        });
    } catch (error) {
        console.error("Failed to sync task to Notion:", error);
    }
}

export async function getPortalsFromNotion(): Promise<NotionPortal[]> {
    const databaseId = process.env.NOTION_PORTALS_DATABASE_ID;
    if (!process.env.NOTION_TOKEN || !databaseId) return [];

    const response = await (notion as any).dataSources.query({
        data_source_id: databaseId,
    });

    return response.results.map((page: any) => ({
        notionId: page.id,
        id: page.properties.id?.title[0]?.plain_text || "",
        clientName: page.properties["Client Name"]?.rich_text[0]?.plain_text || "",
        clientEmail: page.properties["Client Email"]?.email || "",
        slug: page.properties["Slug"]?.rich_text[0]?.plain_text || "",
        status: page.properties["Status"]?.select?.name || "ACTIVE",
        updatedAt: new Date(page.properties["Updated At"]?.date?.start || page.last_edited_time),
    }));
}

export async function getTasksFromNotion(): Promise<NotionTask[]> {
    const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
    if (!process.env.NOTION_TOKEN || !databaseId) return [];

    const response = await (notion as any).dataSources.query({
        data_source_id: databaseId,
    });

    return response.results.map((page: any) => ({
        notionId: page.id,
        id: page.properties.id?.title[0]?.plain_text || "",
        title: page.properties["Title"]?.rich_text[0]?.plain_text || "",
        status: page.properties["Status"]?.select?.name || "TODO",
        portalNotionId: page.properties["Portal"]?.relation[0]?.id || "",
        updatedAt: new Date(page.properties["Updated At"]?.date?.start || page.last_edited_time),
    }));
}
