import { z } from "zod";
import { roleSchema } from "./auth";

/**
 * Team / member schemas (web) and reusable input validation.
 */

export const inviteMemberSchema = z.object({
    email: z.string().email("Please enter a valid email"),
    role: roleSchema,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
