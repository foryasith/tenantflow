
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          organizationSlug: organizationSlug.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setError("Too many requests. Please try again later.");
        } else {
          setError(
            "Unable to process your request. Please try again later."
          );
        }
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={submitted ? "Check your inbox" : "Password recovery"}
      description={
        submitted
          ? "If your account exists, a reset link will be sent."
          : "Enter your workspace slug and email to request a secure reset link."
      }
    >
      {submitted ? (
        <div className="space-y-5">
          <div
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-7 text-emerald-200"
          >
            If the account exists, you will receive a password
            reset email. The link will expire after 15 minutes.
          </div>

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setError("");
            }}
            className="w-full rounded-xl border border-white/20 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Send another request
          </button>

          <Link
            href="/login"
            className="block rounded-xl bg-indigo-500 px-4 py-3 text-center font-semibold text-white transition hover:bg-indigo-600"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="organizationSlug"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Workspace slug
            </label>

            <input
              id="organizationSlug"
              name="organizationSlug"
              type="text"
              required
              minLength={3}
              maxLength={100}
              pattern="[a-z0-9-]+"
              autoComplete="organization"
              value={organizationSlug}
              onChange={(event) =>
                setOrganizationSlug(event.target.value.toLowerCase())
              }
              placeholder="your-workspace"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={255}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending request..." : "Send reset link"}
          </button>

          <p className="text-center text-sm text-slate-400">
            Remembered your password?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
