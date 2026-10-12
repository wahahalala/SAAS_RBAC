import { z } from "zod";

/**
 * Organization form schemas (web) and reusable input validation.
 */

export const createOrganizationSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    slug: z
        .string()
        .min(2, "Slug must be at least 2 characters")
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
        .optional(),
    logo: z.string().url().optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    logo: z.string().url().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const organizationSlugSchema = z.object({
    slug: z
        .string()
        .min(2, "Slug must be at least 2 characters")
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
});
export type OrganizationSlugInput = z.infer<typeof organizationSlugSchema>;
