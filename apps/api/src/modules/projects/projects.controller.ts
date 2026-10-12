import { Controller, Get, Post, Patch, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { RequirePermission, CurrentUser } from "@/common/decorators";

@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
    @Get()
    @RequirePermission("project.read")
    @ApiOperation({ summary: "List projects (project.read)" })
    list(@CurrentUser() _user: unknown) {
        return { projects: [] };
    }

    @Post()
    @RequirePermission("project.create")
    @ApiOperation({ summary: "Create a project (project.create)" })
    create(@Body() _dto: unknown) {
        return { created: true };
    }

    @Patch(":id")
    @RequirePermission("project.update")
    @ApiOperation({ summary: "Update a project (project.update)" })
    update(@Body() _dto: unknown) {
        return { updated: true };
    }
}
