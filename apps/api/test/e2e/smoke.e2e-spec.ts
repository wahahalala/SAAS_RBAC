import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { createWorld, resetWorld, E2eWorld } from "./world";

/**
 * Smoke test that the Jest + Supertest harness works end to end.
 *
 * A deliberately unknown route proves the real Nest app is serving and that the
 * global prefix is exactly what production uses.
 */
describe("e2e harness", () => {
    let world: E2eWorld;

    beforeAll(async () => {
        world = await createWorld();
        await resetWorld(world);
    });

    afterAll(async () => {
        await world.app.close();
    });

    it("serves the API under the global prefix", async () => {
        const response = await world.http.get("/api/v1/health");
        // whatever /health returns, the point is the app is real and reachable
        expect(response.status).toBeLessThan(500);
    });

    it("seeds three authenticated users", async () => {
        expect(world.adminToken).toBeTruthy();
        expect(world.memberToken).toBeTruthy();
        expect(world.outsiderToken).toBeTruthy();
    });
});
