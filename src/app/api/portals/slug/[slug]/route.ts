import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, context: any) {
    const { params } = context;
    const { slug } = await params;

    try {
        const portal = await prisma.clientPortal.findUnique({
            where: { slug },
            include: {
                updates: { orderBy: { createdAt: 'desc' } },
                documents: { orderBy: { createdAt: 'desc' } },
                media: { orderBy: { createdAt: 'desc' } },
                messages: { orderBy: { createdAt: 'asc' } }
            }
        });

        if (!portal) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const isContractor = portal.audience === 'CONTRACTOR';
        const isCustomer = portal.audience === 'CUSTOMER';

        // 1. Fetch portal tasks from the generic tasks module
        // We only fetch tasks explicitly shared with this portal
        const rawTasks = await prisma.globalPage.findMany({
            where: {
                databaseId: 'db-tasks',
                properties: {
                    path: ['prop-task-portal'],
                    array_contains: portal.id
                }
            }
        });

        const mappedTasks = rawTasks.map(p => {
            const props = (p.properties as any) || {};
            return {
                id: p.id,
                title: props['title'] || 'Untitled',
                status: props['prop-task-status'] === 'opt-done' ? 'DONE' : 'TODO',
                dueDate: props['prop-task-due'] || null,
                fileUrl: props['prop-task-file-url'] || null,
                projectId: props['prop-task-project']?.[0] || null
            };
        });

        // 2. Fetch linked project data
        let linkedProjectData = null;
        let quotes: any[] = [];
        let invoices: any[] = [];

        if (portal.linkedProjectId) {
            const globalPage = await prisma.globalPage.findUnique({
                where: { id: portal.linkedProjectId },
                select: { id: true, properties: true }
            });
            if (globalPage) {
                const props = (globalPage.properties as any) || {};
                
                // Contractor data protection: Strip financial fields from the project data
                if (isContractor) {
                    delete props['budget'];
                    delete props['Budget'];
                    delete props['paidAmount'];
                    delete props['invoicedAmount'];
                    delete props['totalExVat'];
                }
                
                linkedProjectData = { id: globalPage.id, ...props };
            }

            // 3. Fetch financial documents only for CUSTOMER
            if (isCustomer) {
                // Fetch Quotes linked to project
                const rawQuotes = await prisma.globalPage.findMany({
                    where: {
                        databaseId: 'db-quotations',
                        properties: {
                            path: ['prop-quote-project'],
                            array_contains: portal.linkedProjectId
                        }
                    }
                });
                
                quotes = rawQuotes.map(q => {
                    const props = (q.properties as any) || {};
                    return {
                        id: q.id,
                        title: props['title'] || 'Quote',
                        status: props['status'] || 'Draft',
                        total: props['total'] || 0,
                        date: props['date'] || null
                    };
                });

                // Fetch Invoices linked to project
                const rawInvoices = await prisma.globalPage.findMany({
                    where: {
                        databaseId: 'db-invoices',
                        properties: {
                            path: ['project'],
                            array_contains: portal.linkedProjectId
                        }
                    }
                });
                
                invoices = rawInvoices.map(inv => {
                    const props = (inv.properties as any) || {};
                    return {
                        id: inv.id,
                        title: props['title'] || 'Invoice',
                        status: props['status'] || 'Draft',
                        total: props['total'] || 0,
                        date: props['date'] || null
                    };
                });
            }
        }

        // Don't leak the hashed password, just a flag
        const { password, budget, paidAmount, ...safePortal } = portal;
        
        // Strict Gating: If contractor, explicitly force budget and paidAmount to undefined
        const finalPortal = isContractor 
            ? { ...safePortal, budget: undefined, paidAmount: undefined }
            : { ...safePortal, budget, paidAmount };

        return NextResponse.json({
            ...finalPortal,
            tasks: mappedTasks,
            hasPassword: !!password,
            linkedProjectData,
            quotes,
            invoices
        });
    } catch (error) {
        console.error("Portal fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}
