import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
    DOMAIN_EVENTS,
    type DataExportedEvent,
    type DomainEventMap,
    type DomainEventName,
    type ReportCompletedEvent,
    type RoleChangedEvent,
    type SessionEvent,
    type TenantCreatedEvent,
    type UserCreatedEvent,
    type UserDeletedEvent,
} from "@saas/shared-types";

/**
 * Typed facade over Nest's EventEmitter.
 *
 * Why a facade instead of injecting EventEmitter2 everywhere:
 *
 *  - **Type safety.** `DomainEventMap` binds each event name to its payload, so
 *    emitting `report.completed` with a user payload is a compile error rather
 *    than a listener that silently never fires.
 *  - **`occurredAt` is set here**, so no caller can forget it.
 *  - **Emission is fire-and-forget and must never break the caller.** A domain
 *    event is a side-effect notification: a listener blowing up must not fail the
 *    HTTP request that already committed its write. Errors are logged.
 */
@Injectable()
export class DomainEventsService {
    private readonly logger = new Logger(DomainEventsService.name);

    constructor(private readonly emitter: EventEmitter2) {}

    /**
     * Emit a domain event.
     *
     * Call this AFTER the database write has succeeded — never before, and never
     * inside a transaction that might roll back (a rolled-back write must not
     * have announced itself).
     */
    emit<K extends DomainEventName>(
        name: K,
        payload: Omit<DomainEventMap[K], "occurredAt">,
    ): void {
        const enriched = {
            ...payload,
            occurredAt: new Date().toISOString(),
        } as DomainEventMap[K];

        try {
            // emitAsync would propagate listener failures into the caller; a
            // plain emit keeps the request path independent of its listeners.
            this.emitter.emit(name, enriched);
        } catch (error) {
            // Throwing here would fail a request whose write already succeeded.
            this.logger.error(
                `Failed to emit ${name}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    // Convenience wrappers: they keep the payload shape in one place so a new
    // field only has to be threaded through here.

    userCreated(payload: Omit<UserCreatedEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.USER_CREATED, payload);
    }

    tenantCreated(payload: Omit<TenantCreatedEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.TENANT_CREATED, payload);
    }

    roleChanged(payload: Omit<RoleChangedEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.ROLE_CHANGED, payload);
    }

    reportCompleted(payload: Omit<ReportCompletedEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.REPORT_COMPLETED, payload);
    }

    userDeleted(payload: Omit<UserDeletedEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.USER_DELETED, payload);
    }

    loggedIn(payload: Omit<SessionEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.USER_LOGGED_IN, payload);
    }

    loggedOut(payload: Omit<SessionEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.USER_LOGGED_OUT, payload);
    }

    dataExported(payload: Omit<DataExportedEvent, "occurredAt">): void {
        this.emit(DOMAIN_EVENTS.DATA_EXPORTED, payload);
    }
}
