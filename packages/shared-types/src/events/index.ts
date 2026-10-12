/**
 * Domain event contracts.
 *
 * What a domain event IS here: a fact that already happened in the business
 * ("a user was created"), emitted so side effects can react without the
 * producer knowing about them. Emitters must therefore emit AFTER the write
 * succeeds, and must never rely on a listener for the write itself.
 *
 * Two hard constraints shape the payloads:
 *
 *  1. **tenantId is always carried explicitly.** Listeners run asynchronously
 *     (Nest's EventEmitter is fire-and-forget), so the request's
 *     AsyncLocalStorage tenant context is gone by the time they run. Reading
 *     the tenant from an ambient context would silently mis-attribute audit
 *     rows, so the emitting code passes it in the payload.
 *  2. **Names are shared strings**, not per-app constants: the worker emits
 *     REPORT_COMPLETED through the BullMQ bridge and the API re-emits it, so
 *     both sides must agree on the spelling.
 */

export const DOMAIN_EVENTS = {
    USER_CREATED: "user.created",
    TENANT_CREATED: "tenant.created",
    ROLE_CHANGED: "role.changed",
    REPORT_COMPLETED: "report.completed",
} as const;

export type DomainEventName =
    (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/** Fields every domain event carries. */
export interface DomainEventBase {
    /**
     * Tenant the fact belongs to, or null when it does not belong to one yet.
     *
     * Always explicit — never read ambiently (listeners run after the request's
     * AsyncLocalStorage context is gone). Nullable because some facts genuinely
     * have no tenant: registration creates an account before the user belongs to
     * any tenant. Consumers must handle null rather than assume a tenant.
     */
    tenantId: string | null;
    /** Who caused it, when known (absent for system/automated actions). */
    actorId?: string;
    /**
     * When it happened, ISO-8601. Set by the emitter's emit() helper, so
     * producers should not have to supply it.
     */
    occurredAt: string;
}

/** A user account was created. */
export interface UserCreatedEvent extends DomainEventBase {
    userId: string;
    email: string;
    name: string | null;
    /** How the account came to exist. */
    source: "register" | "oauth" | "invitation";
}

/**
 * A tenant was created.
 *
 * Emitted during provisioning, which runs with NO tenant context (the tenant is
 * being created), so consumers must not assume an active request scope.
 */
export interface TenantCreatedEvent
    extends Omit<DomainEventBase, "tenantId"> {
    /**
     * Always present: the fact IS the tenant's creation, so this event can never
     * be tenant-less (unlike USER_CREATED, which fires before any tenant).
     */
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    /** The user who triggered provisioning. */
    ownerId: string;
}

/** A member's role changed within a tenant. */
export interface RoleChangedEvent extends Omit<DomainEventBase, "tenantId"> {
    /** A role exists only inside a tenant, so this is always present. */
    tenantId: string;
    membershipId: string;
    targetUserId: string;
    previousRoleKey: string;
    newRoleKey: string;
}

/** A report finished generating. */
export interface ReportCompletedEvent
    extends Omit<DomainEventBase, "tenantId"> {
    /** Reports are generated per tenant, so this is always present. */
    tenantId: string;
    reportId: string;
    reportType: string;
    format: string;
    status: "completed" | "failed";
    rowCount: number | null;
    fileSize: number | null;
    /** Set when `status` is "failed". */
    error?: string | null;
    requestedById: string;
}

/** Every domain event, discriminated by name at the listener registration. */
export type DomainEventPayload =
    | UserCreatedEvent
    | TenantCreatedEvent
    | RoleChangedEvent
    | ReportCompletedEvent;

/** Map of event name -> payload, so emitters and listeners stay in step. */
export interface DomainEventMap {
    [DOMAIN_EVENTS.USER_CREATED]: UserCreatedEvent;
    [DOMAIN_EVENTS.TENANT_CREATED]: TenantCreatedEvent;
    [DOMAIN_EVENTS.ROLE_CHANGED]: RoleChangedEvent;
    [DOMAIN_EVENTS.REPORT_COMPLETED]: ReportCompletedEvent;
}
