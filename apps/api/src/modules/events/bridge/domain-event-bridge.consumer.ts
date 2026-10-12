import { Logger } from "@nestjs/common";
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { DomainEventsService } from "../domain-events.service";
import {
    DOMAIN_EVENT_QUEUE,
    JOBS,
    type PublishDomainEventJob,
} from "@/modules/queue";

/**
 * Drains cross-process domain events onto the local bus.
 *
 * Nest's EventEmitter is in-process only, but some facts are produced by the
 * WORKER (REPORT_COMPLETED is the current case). Rather than duplicating the
 * listeners in the worker, the worker publishes to this queue and this consumer
 * re-emits locally — so listeners stay in one place and cannot diverge.
 *
 * The API is therefore a CONSUMER for this queue only; all other queues are
 * produce-only from here.
 */
@Processor(DOMAIN_EVENT_QUEUE)
export class DomainEventBridgeConsumer extends WorkerHost {
    private readonly logger = new Logger(DomainEventBridgeConsumer.name);

    constructor(private readonly domainEvents: DomainEventsService) {
        super();
    }

    async process(job: Job<PublishDomainEventJob>): Promise<void> {
        if (job.name !== JOBS.PUBLISH_DOMAIN_EVENT) {
            throw new Error(`Unknown domain-event job name: ${job.name}`);
        }

        const { name, payload } = job.data;

        // `emit` never throws (a listener failure must not fail the request
        // path), and it stamps occurredAt.
        this.domainEvents.emit(name as never, payload as never);

        this.logger.log(`Bridged domain event ${name} from the worker`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(
            `domainEventQueue job ${job?.id ?? "unknown"} failed: ${error.message}`,
        );
    }
}
