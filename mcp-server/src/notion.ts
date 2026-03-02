import { Client } from "@notionhq/client";

const notion = new Client({
    auth: process.env.NOTION_TOKEN as string,
});

export default notion;

export async function addLeadToNotion(lead: any) {
    const databaseId = process.env.NOTION_LEADS_DATABASE_ID;
    if (!databaseId) return;

    await notion.pages.create({
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
}

export async function addBookingToNotion(booking: any) {
    const databaseId = process.env.NOTION_BOOKINGS_DATABASE_ID;
    if (!databaseId) return;

    await notion.pages.create({
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
}

export async function addServiceToNotion(service: any) {
    const databaseId = process.env.NOTION_SERVICES_DATABASE_ID;
    if (!databaseId) return;

    await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
            "slug": { title: [{ text: { content: service.slug } }] },
            "Title EN": { rich_text: [{ text: { content: service.titleEn || "" } }] },
            "Title NL": { rich_text: [{ text: { content: service.titleNl || "" } }] },
            "Description EN": { rich_text: [{ text: { content: service.descriptionEn || "" } }] },
            "Full Description EN": { rich_text: [{ text: { content: service.fullDescriptionEn || "" } }] },
            "Order": { number: service.order },
        },
    });
}

export async function addProjectToNotion(project: any) {
    const databaseId = process.env.NOTION_PROJECTS_DATABASE_ID;
    if (!databaseId) return;

    await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
            "id": { title: [{ text: { content: project.id } }] },
            "Title EN": { rich_text: [{ text: { content: project.titleEn || "" } }] },
            "Location EN": { rich_text: [{ text: { content: project.locationEn || "" } }] },
            "Order": { number: project.order },
        },
    });
}

export async function getServicesFromNotion() {
    const databaseId = process.env.NOTION_SERVICES_DATABASE_ID;
    if (!databaseId) return [];

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

export async function addPortalToNotion(portal: any) {
    const databaseId = process.env.NOTION_PORTALS_DATABASE_ID;
    if (!databaseId) return;

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
}

export async function addTaskToNotion(task: any, portalPageId?: string) {
    const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
    if (!databaseId) return;

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
}

export async function getPortalsFromNotion() {
    const databaseId = process.env.NOTION_PORTALS_DATABASE_ID;
    if (!databaseId) return [];

    const response = await (notion as any).dataSources.query({
        data_source_id: databaseId,
    });

    return response.results.map((page: any) => ({
        notionId: page.id,
        id: page.properties.id?.title[0]?.plain_text,
        clientName: page.properties["Client Name"]?.rich_text[0]?.plain_text,
        clientEmail: page.properties["Client Email"]?.email,
        slug: page.properties["Slug"]?.rich_text[0]?.plain_text,
        status: page.properties["Status"]?.select?.name,
        updatedAt: new Date(page.properties["Updated At"]?.date?.start || page.last_edited_time),
    }));
}

export async function getTasksFromNotion() {
    const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
    if (!databaseId) return [];

    const response = await (notion as any).dataSources.query({
        data_source_id: databaseId,
    });

    return response.results.map((page: any) => ({
        notionId: page.id,
        id: page.properties.id?.title[0]?.plain_text,
        title: page.properties["Title"]?.rich_text[0]?.plain_text,
        status: page.properties["Status"]?.select?.name,
        portalNotionId: page.properties["Portal"]?.relation[0]?.id,
        updatedAt: new Date(page.properties["Updated At"]?.date?.start || page.last_edited_time),
    }));
}
