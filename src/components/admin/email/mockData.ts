import { EmailThread } from "./store";

export const MOCK_THREADS: EmailThread[] = [
    {
        id: 1,
        subject: "Finalizing the Kitchen Remodel Proposal",
        lastActivityDate: new Date().toISOString(),
        emails: [
            {
                id: 101,
                threadId: 1,
                senderId: 1,
                recipientId: 2,
                subject: "Finalizing the Kitchen Remodel Proposal",
                body: "Hi team,\n\nI've reviewed the latest 3D renders for the Smith kitchen project. The marble countertops look fantastic, but I think we need to adjust the cabinet lighting slightly to warm up the space.\n\nCould we jump on a quick call this afternoon to finalize these details before the client presentation tomorrow?\n\nBest,\nSarah",
                sentDate: new Date().toISOString(),
                sender: {
                    id: 1,
                    firstName: "Sarah",
                    lastName: "Jenkins",
                    email: "sarah@coral-group.be",
                }
            }
        ]
    },
    {
        id: 2,
        subject: "Invoice #INV-2024-089 - Payment Received",
        lastActivityDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        emails: [
            {
                id: 102,
                threadId: 2,
                senderId: 3,
                recipientId: 1,
                subject: "Invoice #INV-2024-089 - Payment Received",
                body: "Hello,\n\nJust confirming that we have received the initial deposit for the hardwood flooring installation at the Brussels property.\n\nWe will proceed with ordering the materials tomorrow. Expected delivery is late next week.\n\nRegards,\nAccounting Team",
                sentDate: new Date(Date.now() - 86400000).toISOString(),
                sender: {
                    id: 3,
                    firstName: "Finance",
                    lastName: "Dept",
                    email: "billing@coral-group.be",
                }
            }
        ]
    },
    {
        id: 3,
        subject: "New Lead: Full Home Renovation (Antwerp)",
        lastActivityDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        emails: [
            {
                id: 103,
                threadId: 3,
                senderId: 4,
                recipientId: 1,
                subject: "New Lead: Full Home Renovation (Antwerp)",
                body: "Hi,\n\nA new lead just came in through the website contact form. They are looking for a complete gut renovation of a 3-story townhouse in Antwerp. Budget is estimated around €250k.\n\nI've added the details to the CRM. Who wants to take lead on the initial consultation?\n\nThanks,\nAutomated System",
                sentDate: new Date(Date.now() - 172800000).toISOString(),
                sender: {
                    id: 4,
                    firstName: "System",
                    lastName: "Bot",
                    email: "noreply@coral-group.be",
                    avatarUrl: undefined
                }
            }
        ]
    }
];
