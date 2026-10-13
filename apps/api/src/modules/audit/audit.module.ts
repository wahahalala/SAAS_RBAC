import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

/**
 * Read-only audit trail API.
 *
 * The WRITE side is the audit domain-event listener (modules/events/listeners);
 * this module only queries what that listener recorded.
 */
@Module({
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService],
})
export class AuditModule {}
