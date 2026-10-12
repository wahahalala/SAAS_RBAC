import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
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

    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 API running on http://localhost:${port}/${apiPrefix}`);
    console.log(`📚 Docs available at http://localhost:${port}/docs`);
}

bootstrap();
