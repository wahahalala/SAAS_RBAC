import { Module, Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

@Injectable()
class HealthService implements OnModuleDestroy {
    constructor(
        @Inject("Queue:health")
        private readonly queue: Queue
    ) {}

    async check(): Promise<{ status: string; service: string; queue: string }> {
        return {
            status: "ok",
            service: "worker",
            queue: this.queue.name,
        };
    }

    async onModuleDestroy() {
        await this.queue.close();
    }
}

@Module({
    providers: [
        HealthService,
        {
            provide: "Queue:health",
            useFactory: () =>
                new Queue("health", {
                    connection: {
                        host: process.env.REDIS_HOST || "localhost",
                        port: Number(process.env.REDIS_PORT || 6379),
                    },
                }),
        },
    ],
    exports: [HealthService],
})
export class HealthModule {}
