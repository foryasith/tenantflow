
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Password recovery"
      description="Password reset functionality is being prepared."
    >
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h3 className="font-semibold text-amber-200">
          Password reset is not available yet
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          The secure password reset service is under development.
          No reset email will be sent from this screen.
        </p>
      </div>

      <Link
        href="/login"
        className="mt-6 block rounded-xl bg-indigo-500 px-4 py-3 text-center font-semibold text-white"
      >
        Back to login
      </Link>
    </AuthShell>
  );
}
