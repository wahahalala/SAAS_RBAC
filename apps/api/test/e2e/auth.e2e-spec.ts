import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { createWorld, resetWorld, E2eWorld, PASSWORD } from "./world";

/**
 * Auth end-to-end over real HTTP.
 *
 * Exercises the endpoints a client actually uses, including the refresh-cookie
 * flow and the server-side session endpoint (POST /auth/session) added for
 * server-side rendering — which must mint an access token WITHOUT rotating the
 * refresh token, or the next render breaks.
 */
describe("Auth (e2e)", () => {
    let world: E2eWorld;

    beforeAll(async () => {
        world = await createWorld();
    });

    afterAll(async () => {
        await world.app.close();
    });

    beforeEach(async () => {
        await resetWorld(world);
    });

    it("registers and signs in a new user", async () => {
        const email = `fresh-${Date.now()}@example.com`;

        const register = await world.http
            .post("/api/v1/auth/register")
            .send({ email, password: PASSWORD, name: "Fresh" })
            .expect(201);

        expect(register.body.accessToken).toBeTruthy();
        expect(register.body.user.email).toBe(email);
        // The refresh token must never appear in the JSON body.
        expect(register.body.refreshToken).toBeUndefined();
    });

    it("rejects a wrong password with 401", async () => {
        await world.http
            .post("/api/v1/auth/login")
            .send({ email: "admin@example.com", password: "wrong-password" })
            .expect(401);
    });

    it("returns the caller via GET /auth/me", async () => {
        const me = await world.http
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${world.adminToken}`)
            .expect(200);

        expect(me.body.email).toBe("admin@example.com");
        // The password hash must never leave the API.
        expect(me.body).not.toHaveProperty("passwordHash");
    });

    it("refuses an unknown access token", async () => {
        await world.http
            .get("/api/v1/auth/me")
            .set("Authorization", "Bearer not-a-real-token")
            .expect(401);
    });

    it("logs out and revokes the session so the refresh token is rejected", async () => {
        // Capture the refresh cookie from a real login.
        const login = await world.http
            .post("/api/v1/auth/login")
            .send({ email: "admin@example.com", password: PASSWORD })
            .expect(200);

        const cookies = login.headers["set-cookie"] as unknown as string[];
        const refreshCookie = extractCookie(cookies, "refresh_token");

        expect(refreshCookie).toBeTruthy();

        await world.http
            .post("/api/v1/auth/logout")
            .set("Cookie", refreshCookie)
            .expect(200);

        // The revoked token must no longer refresh.
        await world.http
            .post("/api/v1/auth/refresh")
            .set("Cookie", refreshCookie)
            .expect(401);
    });

    it("/auth/session mints a token WITHOUT rotating the refresh token", async () => {
        // This is the contract server-side rendering depends on: the refresh
        // cookie survives unchanged, so repeated renders can keep working.
        const login = await world.http
            .post("/api/v1/auth/login")
            .send({ email: "admin@example.com", password: PASSWORD })
            .expect(200);

        const cookies = login.headers["set-cookie"] as unknown as string[];
        const refreshCookie = extractCookie(cookies, "refresh_token");
        expect(refreshCookie).toBeTruthy();

        const session = await world.http
            .post("/api/v1/auth/session")
            .set("Cookie", refreshCookie)
            .expect(200);

        expect(session.body.accessToken).toBeTruthy();
        expect(session.body.refreshToken).toBeUndefined();

        // The SAME refresh cookie must still work afterwards — that is the
        // difference from /auth/refresh, which would have revoked it.
        const again = await world.http
            .post("/api/v1/auth/session")
            .set("Cookie", refreshCookie)
            .expect(200);

        expect(again.body.accessToken).toBeTruthy();
    });

    it("rejects /auth/refresh with a garbage cookie", async () => {
        await world.http
            .post("/api/v1/auth/refresh")
            .set("Cookie", "refresh_token=garbage")
            .expect(401);
    });
});

function extractCookie(setCookies: string[], name: string): string {
    const header = setCookies.find((cookie) => cookie.startsWith(`${name}=`));
    return header ? header.split(";")[0] : "";
}
