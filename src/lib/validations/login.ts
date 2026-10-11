
import { z } from "zod";

export const loginSchema = z.object({
  organizationSlug: z.string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Invalid organization slug"),

  email: z.email("Invalid email address")
    .max(255)
    .transform((value) => value.toLowerCase()),

  password: z.string()
    .min(1, "Password is required")
    .max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
