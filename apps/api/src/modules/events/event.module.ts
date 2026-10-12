import { Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DomainEventsService } from "./domain-events.service";
import { EmailListener } from "./listeners/email.listener";
import { AuditListener } from "./listeners/audit.listener";
import { AnalyticsListener } from "./listeners/analytics.listener";
import { DomainEventBridgeConsumer } from "./bridge/domain-event-bridge.consumer";
import { QueueModule } from "@/modules/queue";

/**
 * Domain events.
 *
 * Wiring:
 *   - `EventEmitterModule` provides the in-process bus.
 *   - `DomainEventsService` is the typed emit facade used by feature services.
 *   - The three listeners are the side effects: email, audit, analytics.
 *   - `DomainEventBridgeConsumer` drains events published by OTHER processes
 *     (the worker) and re-emits them here, so listeners do not care where a
 *     fact came from.
 *
 * Global so any feature module can inject `DomainEventsService` without
 * importing this module explicitly.
 */
@Global()
@Module({
    imports: [
        EventEmitterModule.forRoot({
            // One shared bus; listener failures are reported through the
            // service's own guard rather than silencing everything.
            wildcard: false,
            delimiter: ".",
            maxListeners: 20,
            verboseMemoryLeak: false,
        }),
        QueueModule,
    ],
    providers: [
        DomainEventsService,
        EmailListener,
        AuditListener,
        AnalyticsListener,
        DomainEventBridgeConsumer,
    ],
    exports: [DomainEventsService],
})
export class EventModule {}
