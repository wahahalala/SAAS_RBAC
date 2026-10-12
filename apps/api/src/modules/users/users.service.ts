import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { UpdateUserDto } from "./dto";

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get user by ID
     */
    async findById(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                image: true,
                emailVerified: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return {
            ...user,
            emailVerified: !!user.emailVerified,
        };
    }

    /**
     * Update user profile
     */
    async update(userId: string, dto: UpdateUserDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: dto,
            select: {
                id: true,
                email: true,
                name: true,
                image: true,
                emailVerified: true,
                createdAt: true,
            },
        });

        return {
            ...user,
            emailVerified: !!user.emailVerified,
        };
    }

    /**
     * Get user's organizations (via Membership -> Tenant -> Organization).
     */
    async getOrganizations(userId: string) {
        const memberships = await this.prisma.membership.findMany({
            where: { userId },
            include: {
                role: true,
                tenant: {
                    include: {
                        organization: true,
                        memberships: true,
                        subscriptions: true,
                    },
                },
            },
        });

        return memberships.map((m) => {
            const org = m.tenant.organization;
            return {
                // tenantId is the identifier the client sends back as the
                // X-Tenant-Id header; `id` stays the Organization row id for
                // backward compatibility.
                tenantId: m.tenantId,
                id: org?.id ?? m.tenantId,
                name: m.tenant.name,
                slug: m.tenant.slug,
                logo: org?.logo ?? null,
                role: m.role.key,
                memberCount: m.tenant.memberships.length,
                plan: m.tenant.subscriptions?.[0]?.plan ?? "free",
            };
        });
    }

    /**
     * Delete user account
     */
    async delete(userId: string) {
        await this.prisma.user.delete({
            where: { id: userId },
        });
    }
}
