import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Global so processors can inject PrismaService without importing this module
 * from every feature module.
 */
@Global()
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule {}
