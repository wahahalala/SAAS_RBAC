import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

/**
 * Configure the Nest application.
 *
 * Extracted from `bootstrap()` so end-to-end tests (Supertest) can build the
 * exact same app — same pipes, same prefix, same CORS — without opening a real
 * socket. Keeping the two in one place means a test can never silently disagree
 * with production about URL structure or validation behaviour.
 */
export async function createApp(): Promise<INestApplication> {
    const app = await NestFactory.create(AppModule);

    // Cookie parsing for httpOnly refresh token
    app.use(cookieParser());

    // Global prefix
    const apiPrefix = process.env.API_PREFIX || "api/v1";
    app.setGlobalPrefix(apiPrefix);

    // CORS - must allow credentials for httpOnly cookies
    app.enableCors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
    });

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        })
    );

    // Swagger
    const config = new DocumentBuilder()
        .setTitle("SaaS API")
        .setDescription("API documentation for the SaaS Template")
        .setVersion("1.0")
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);

    return app;
}

async function bootstrap() {
    const app = await createApp();

    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 API running on http://localhost:${port}/${process.env.API_PREFIX || "api/v1"}`);
    console.log(`📚 Docs available at http://localhost:${port}/docs`);
}

// Only start listening when this file is executed directly (`node dist/main`).
// Importing it from a test (to reuse createApp) must NOT open a real socket.
if (require.main === module) {
    void bootstrap();
}
