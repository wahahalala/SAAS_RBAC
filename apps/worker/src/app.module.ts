import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma";
import { EventsModule } from "./events";
import { QueueModule } from "./queue/queue.module";
import { WorkerModule } from "./worker/worker.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
        }),
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    host: configService.get("REDIS_HOST", "localhost"),
                    port: configService.get<number>("REDIS_PORT", 6379),
                },
            }),
        }),
        PrismaModule,
        EventsModule,
        QueueModule,
        WorkerModule,
        HealthModule,
    ],
})
export class AppModule {}
