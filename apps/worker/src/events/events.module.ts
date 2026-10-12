import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DOMAIN_EVENT_QUEUE } from "@/queue/queue.constants";
import { DomainEventPublisher } from "./domain-event-publisher.service";

/**
 * Domain-event publishing for the worker.
 *
 * The worker has no listeners: it only publishes facts it produces so the API
 * (which owns the listener set) can react. Global, so services can inject the
 * publisher without importing this module.
 */
@Global()
@Module({
    imports: [BullModule.registerQueue({ name: DOMAIN_EVENT_QUEUE })],
    providers: [DomainEventPublisher],
    exports: [DomainEventPublisher],
})
export class EventsModule {}
