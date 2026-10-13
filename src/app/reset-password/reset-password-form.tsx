
"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!/^[a-f0-9]{64}$/.test(token)) {
      setMessage("Invalid reset link. Request a new one.");
      return;
    }

    if (
      password.length < 8 ||
      password.length > 72 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setMessage(
        "Use 8–72 characters with uppercase, lowercase and a number."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const result: {
        message?: string;
        error?: string;
      } = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ?? "Password reset failed."
        );
        return;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      setMessage(
        "Password updated. You can now sign in."
      );

      // Remove reset token from the URL after success.
      window.history.replaceState(
        null,
        "",
        "/reset-password"
      );
    } catch {
      setMessage(
        "Unable to connect. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl text-blue-700">
          🔒
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {success
            ? "Password updated"
            : "Create a new password"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          {success
            ? "Your old sessions have been revoked. Please log in again."
            : "Choose a strong password for your TenantFlow account."}
        </p>

        {message && (
          <div
            role="status"
            className={`mt-5 rounded-lg border p-3 text-sm ${
              success
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {!success && (
          <>
            {!/^[a-f0-9]{64}$/.test(token) ? (
              <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                This password reset link is missing or invalid.
                Please request a new email.
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-5"
              >
                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    New password
                  </label>

                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    required
                    minLength={8}
                    maxLength={72}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Confirm new password"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) =>
                      setShowPassword(e.target.checked)
                    }
                  />
                  Show password
                </label>

                <p className="text-xs leading-5 text-slate-500">
                  Minimum 8 characters, including uppercase,
                  lowercase and a number.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Updating password..."
                    : "Reset password"}
                </button>
              </form>
            )}
          </>
        )}

        <div className="mt-6 text-center">
          <Link
            href={success ? "/login" : "/forgot-password"}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {success
              ? "Continue to login →"
              : "Request another reset link"}
          </Link>
        </div>
      </section>
    </main>
  );
}
