import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const logger = new Logger("Worker");

    const port = process.env.PORT || 3002;
    logger.log(`Worker started (queue processor) on PID ${process.pid}`);

    // Signal handlers for graceful shutdown (drain BullMQ jobs).
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.on(signal, async () => {
            logger.log(`Received ${signal}, shutting down gracefully...`);
            await app.close();
            process.exit(0);
        });
    }

    // Keep the process alive for queue processors even though we use a
    // context (no HTTP listener). Explicitly documenting the intent.
    if (process.env.NODE_ENV === "development") {
        logger.log(`(configured PORT=${port}; worker exposes no HTTP server)`);
    }
}

bootstrap();
