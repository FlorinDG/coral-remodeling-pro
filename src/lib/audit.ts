import { resolveUserLabel, insertAuditLog } from "@/lib/data/audit";

export type ActorKind = 'USER' | 'SYSTEM' | 'PORTAL' | 'OPERATOR';

export interface AuditActor {
    actorKind: ActorKind;
    actorUserId?: string | null;
    actorRef?: string | null;
    actorLabel: string;
    onBehalfOfId?: string | null;
}

export interface AuditScope {
    tenantId: string;
    actor?: AuditActor;
    userId?: string;
    userName?: string | null;
    userEmail?: string | null;
    user?: {
        id?: string;
        name?: string | null;
        email?: string | null;
        role?: string | null;
        impersonating?: boolean;
        impersonatedBy?: string | null;
    };
    portalId?: string;
    portalName?: string;
    jobName?: string;
}

export interface AuditEvent {
    entityType: string;
    entityId: string;
    action: string;
    field?: string | null;
    before?: any;
    after?: any;
    reason?: string | null;
}

export async function resolveActorFromScope(scope: AuditScope): Promise<AuditActor> {
    if (scope.actor) {
        return scope.actor;
    }

    if (scope.jobName) {
        return {
            actorKind: 'SYSTEM',
            actorUserId: null,
            actorRef: scope.jobName,
            actorLabel: `System (${scope.jobName})`,
            onBehalfOfId: null,
        };
    }

    if (scope.portalId) {
        return {
            actorKind: 'PORTAL',
            actorUserId: null,
            actorRef: scope.portalId,
            actorLabel: scope.portalName || 'Portal Client',
            onBehalfOfId: null,
        };
    }

    // Operator impersonating
    if (scope.user?.impersonatedBy) {
        const operatorId = scope.user.impersonatedBy;
        const tenantUserId = scope.user.id || scope.userId || null;
        return {
            actorKind: 'OPERATOR',
            actorUserId: operatorId,
            actorRef: null,
            actorLabel: `Operator impersonating`,
            onBehalfOfId: tenantUserId,
        };
    }

    // Default: USER
    const userId = scope.user?.id || scope.userId || null;
    let label = scope.userName || scope.user?.name || scope.user?.email || null;
    if (!label && userId) {
        label = await resolveUserLabel(scope.tenantId, userId);
    }

    return {
        actorKind: 'USER',
        actorUserId: userId,
        actorRef: null,
        actorLabel: label || userId || 'Unknown User',
        onBehalfOfId: null,
    };
}

export async function buildAuditLogData(scope: AuditScope, event: AuditEvent) {
    const actor = await resolveActorFromScope(scope);

    return {
        tenantId: scope.tenantId,
        actorKind: actor.actorKind,
        actorUserId: actor.actorUserId,
        actorRef: actor.actorRef,
        actorLabel: actor.actorLabel,
        onBehalfOfId: actor.onBehalfOfId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        field: event.field ?? null,
        before: event.before ?? null,
        after: event.after ?? null,
        reason: event.reason ?? null,
    };
}

export async function recordAuditLog(scope: AuditScope, event: AuditEvent) {
    const data = await buildAuditLogData(scope, event);
    return insertAuditLog(data);
}

export function buildAuditLogOperation(prismaClient: any, data: Awaited<ReturnType<typeof buildAuditLogData>>) {
    return prismaClient.auditLog.create({ data });
}
