import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { QueueModule } from "@/modules/queue";
import { InvitationsModule } from "@/modules/invitations";

@Module({
    // QueueModule provides the producer used to enqueue invitation emails.
    imports: [QueueModule, InvitationsModule],
    controllers: [OrganizationsController],
    providers: [OrganizationsService],
    exports: [OrganizationsService],
})
export class OrganizationsModule { }
