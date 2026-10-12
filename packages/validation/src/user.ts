import { z } from "zod";

/**
 * User profile schemas (web) and reusable input validation.
 */

export const updateProfileSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
