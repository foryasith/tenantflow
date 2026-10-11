
import { z } from "zod";

export const registerSchema = z.object({
  organizationName: z.string()
    .trim()
    .min(2, "Organization name is too short")
    .max(150),

  fullName: z.string()
    .trim()
    .min(2, "Full name is too short")
    .max(150),

  email: z.email("Invalid email address")
    .max(255)
    .transform((value) => value.toLowerCase()),

  password: z.string()
    .min(8, "Minimum 8 characters required")
    .max(72)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[0-9]/, "Include a number"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
