import prisma from "@/lib/prisma";

export type NotificationType = 
  | 'QUOTE_ACCEPTED' 
  | 'QUOTE_VIEWED' 
  | 'INVOICE_PAID' 
  | 'INVOICE_OVERDUE' 
  | 'INVOICE_SENT' 
  | 'CREDIT_NOTE' 
  | 'PEPPOL_RECEIVED';

export interface CreateNotificationParams {
    tenantId: string;
    userId?: string | null;
    type: NotificationType | string;
    title: string;
    body: string;
    entityType: 'quote' | 'invoice' | 'project' | string;
    entityId: string;
    href: string;
}

export async function createNotification(params: CreateNotificationParams) {
    return prisma.notification.create({
        data: params,
    });
}
