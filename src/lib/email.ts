
import "server-only";
import { Resend } from "resend";

export async function sendPasswordResetEmail(
  email: string,
  token: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.APP_URL;

  if (!apiKey || !from || !appUrl) {
    throw new Error("Email service is not configured");
  }

  const url = new URL("/reset-password", appUrl);
  url.searchParams.set("token", token);

  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from,
    to: email,
    subject: "Reset your TenantFlow password",
    text: [
      "You requested a password reset.",
      "",
      `Open this link: ${url.toString()}`,
      "",
      "This link expires in 15 minutes.",
      "If you did not request this, ignore this email.",
    ].join("\n"),
  });

  if (result.error) {
    throw new Error("Email delivery request failed");
  }

  return result.data?.id;
}
