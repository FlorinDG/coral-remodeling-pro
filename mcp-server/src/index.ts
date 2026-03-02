import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import prisma from "./prisma.js";
import notion, {
    addLeadToNotion,
    addBookingToNotion,
    addServiceToNotion,
    addProjectToNotion,
    getServicesFromNotion,
    addPortalToNotion,
    addTaskToNotion,
    getPortalsFromNotion,
    getTasksFromNotion
} from "./notion.js";

const server = new Server(
    {
        name: "notion-cms-sync",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "sync_leads_to_notion",
                description: "Fetch all leads from the database and push them to Notion",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "sync_bookings_to_notion",
                description: "Fetch all bookings from the database and push them to Notion",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "sync_cms_to_notion",
                description: "Push all Services and Projects from Prisma to Notion",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "sync_from_notion",
                description: "Fetch updated content from Notion and update Prisma",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "sync_portals_to_notion",
                description: "Push all Client Portals from Prisma to Notion",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "sync_tasks_to_notion",
                description: "Push all Tasks from Prisma to Notion",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "sync_leads_to_notion") {
            const leads = await prisma.lead.findMany();
            for (const lead of leads) {
                await addLeadToNotion(lead);
            }
            return {
                content: [{ type: "text", text: `Successfully synced ${leads.length} leads to Notion.` }],
            };
        }

        if (name === "sync_bookings_to_notion") {
            const bookings = await prisma.booking.findMany();
            for (const booking of bookings) {
                await addBookingToNotion(booking);
            }
            return {
                content: [{ type: "text", text: `Successfully synced ${bookings.length} bookings to Notion.` }],
            };
        }

        if (name === "sync_cms_to_notion") {
            const services = await prisma.cMS_Service.findMany();
            const projects = await prisma.cMS_Project.findMany();

            for (const service of services) {
                await addServiceToNotion(service);
            }
            for (const project of projects) {
                await addProjectToNotion(project);
            }

            return {
                content: [{ type: "text", text: `Successfully synced ${services.length} services and ${projects.length} projects to Notion.` }],
            };
        }

        if (name === "sync_from_notion") {
            const notionServices = await getServicesFromNotion();
            let updatedCount = 0;

            for (const nService of notionServices) {
                if (!nService.slug) continue;
                await prisma.cMS_Service.upsert({
                    where: { slug: nService.slug },
                    update: {
                        titleEn: nService.titleEn,
                        titleNl: nService.titleNl,
                        descriptionEn: nService.descriptionEn,
                        fullDescriptionEn: nService.fullDescriptionEn,
                        order: nService.order,
                    },
                    create: {
                        slug: nService.slug,
                        titleEn: nService.titleEn || "",
                        descriptionEn: nService.descriptionEn || "",
                        fullDescriptionEn: nService.fullDescriptionEn || "",
                        image: "", // Placeholder
                        icon: "",  // Placeholder
                        order: nService.order || 0,
                    },
                });
                updatedCount++;
            }

            return {
                content: [{ type: "text", text: `Successfully updated ${updatedCount} services from Notion.` }],
            };
        }

        if (name === "sync_portals_to_notion") {
            const portals = await prisma.clientPortal.findMany();
            for (const portal of portals) {
                await addPortalToNotion(portal);
            }
            return {
                content: [{ type: "text", text: `Successfully synced ${portals.length} portals to Notion.` }],
            };
        }

        if (name === "sync_tasks_to_notion") {
            const tasks = await prisma.task.findMany();
            for (const task of tasks) {
                await addTaskToNotion(task);
            }
            return {
                content: [{ type: "text", text: `Successfully synced ${tasks.length} tasks to Notion.` }],
            };
        }

        throw new Error(`Tool not found: ${name}`);
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Notion CMS Sync MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
