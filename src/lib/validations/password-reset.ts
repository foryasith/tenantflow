
import { z } from "zod";

export const forgotPasswordSchema = z.object({
  organizationSlug: z.string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/),

  email: z.email()
    .max(255)
    .transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string()
    .regex(/^[a-f0-9]{64}$/),

  password: z.string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
