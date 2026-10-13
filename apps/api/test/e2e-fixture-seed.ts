import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

/**
 * Seed extra E2E fixtures on top of the standard seed.
 *
 * The standard seed creates admin@example.com (with permissions) and no plain
 * member. The permission-UI test needs a REAL second account with no grants, so
 * it is created here, idempotently.
 *
 * Idempotent means "converges", not "skip if present". The Jest e2e suite
 * (`test/e2e/world.ts`) creates its own `member@example.com` in the SAME
 * database with a different password (`TestPass123!`), truncating and re-seeding
 * per test, so it leaves that account behind. A create-if-missing fixture would
 * hand Playwright a member whose password is not the one the browser test types,
 * and that login would 401 on every run. Overwriting the credential (and the
 * membership) each time is what makes this fixture independent of test order.
 */
const MEMBER_EMAIL = "member@example.com";
const MEMBER_PASSWORD = "Member123!";

async function main() {
    const prisma = new PrismaClient();

    const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { slug: "default" },
    });

    const memberRole =
        (await prisma.role.findFirst({
            where: { tenantId: tenant.id, key: "member" },
        })) ??
        (await prisma.role.create({
            data: {
                tenantId: tenant.id,
                key: "member",
                name: "Member",
                isSystem: true,
            },
        }));

    // Hash on every run so a leftover account from another suite is corrected
    // rather than trusted.
    const passwordHash = await bcrypt.hash(MEMBER_PASSWORD, 12);

    const user = await prisma.user.upsert({
        where: { email: MEMBER_EMAIL },
        update: { passwordHash },
        create: {
            email: MEMBER_EMAIL,
            name: "Plain Member",
            passwordHash,
        },
    });

    await prisma.membership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        update: { roleId: memberRole.id },
        create: { tenantId: tenant.id, userId: user.id, roleId: memberRole.id },
    });

    await prisma.$disconnect();
    console.log(`E2E fixtures ready: ${MEMBER_EMAIL} / ${MEMBER_PASSWORD}`);
}

main().catch((error) => {
    console.error("E2E fixture seed failed:", error);
    process.exit(1);
});
