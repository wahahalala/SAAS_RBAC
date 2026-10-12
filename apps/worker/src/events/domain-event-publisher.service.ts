import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
    DOMAIN_EVENT_QUEUE,
    JOBS,
    DEFAULT_JOB_OPTIONS,
} from "@/queue/queue.constants";
import type { PublishDomainEventJob } from "@/queue/job.types";

/**
 * Publishes domain events produced by the worker to the API process.
 *
 * Nest's EventEmitter is in-process only, and REPORT_COMPLETED is produced here,
 * not in the API. Rather than registering a second set of listeners in the
 * worker (which would drift from the API's), the fact is handed to the API over
 * BullMQ and re-emitted there — so every listener lives in exactly one place.
 *
 * Publishers never throw: delivery of a notification must not fail the job that
 * produced the fact (the report itself is already written and marked complete).
 */
@Injectable()
export class DomainEventPublisher {
    private readonly logger = new Logger(DomainEventPublisher.name);

    constructor(
        @InjectQueue(DOMAIN_EVENT_QUEUE)
        private readonly queue: Queue,
    ) {}

    async publish(
        name: string,
        payload: Record<string, unknown>,
    ): Promise<void> {
        try {
            const job = await this.queue.add(
                JOBS.PUBLISH_DOMAIN_EVENT,
                {
                    type: "publish-domain-event",
                    name,
                    payload,
                } satisfies PublishDomainEventJob,
                {
                    ...DEFAULT_JOB_OPTIONS,
                    // The report id + name make the publish idempotent per fact.
                    // Colon-free on purpose: BullMQ rejects ids containing ":"
                    // (with a carve-out for its legacy three-segment repeatable
                    // ids, which is not something to rely on).
                    jobId: `event-${name}-${String(payload.reportId ?? Date.now())}`,
                },
            );

            this.logger.log(`Published domain event ${name} (job ${job.id})`);
        } catch (error) {
            this.logger.error(
                `Could not publish domain event ${name}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
}
