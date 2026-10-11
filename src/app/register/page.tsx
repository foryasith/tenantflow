
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdSlug, setCreatedSlug] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          fullName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setCreatedSlug(data.organization.slug);
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  if (createdSlug) {
    return (
      <AuthShell
        title="Workspace created!"
        description="Your organization is ready."
      >
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <p className="font-semibold text-emerald-300">
            Organization registered successfully.
          </p>

          <p className="mt-4 text-sm text-slate-300">
            Save your organization slug. You will need it
            to sign in.
          </p>

          <code className="mt-3 block break-all rounded-lg bg-slate-950 p-4 text-indigo-300">
            {createdSlug}
          </code>

          <Link
            href="/login"
            className="mt-6 block rounded-xl bg-indigo-500 px-4 py-3 text-center font-semibold text-white"
          >
            Continue to login →
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your workspace"
      description="Start managing your organization in minutes."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          {
            id: "organization",
            label: "Organization name",
            value: organizationName,
            change: setOrganizationName,
            placeholder: "Nova Workspace",
            type: "text",
          },
          {
            id: "fullname",
            label: "Your full name",
            value: fullName,
            change: setFullName,
            placeholder: "Alex Morgan",
            type: "text",
          },
          {
            id: "email",
            label: "Work email",
            value: email,
            change: setEmail,
            placeholder: "alex@company.com",
            type: "email",
          },
          {
            id: "password",
            label: "Password",
            value: password,
            change: setPassword,
            placeholder: "Create a strong password",
            type: "password",
          },
        ].map((field) => (
          <div key={field.id}>
            <label
              htmlFor={field.id}
              className="mb-2 block text-sm text-slate-300"
            >
              {field.label}
            </label>

            <input
              id={field.id}
              type={field.type}
              required
              value={field.value}
              onChange={(e) => field.change(e.target.value)}
              placeholder={field.placeholder}
              minLength={field.type === "password" ? 8 : undefined}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-indigo-400"
            />
          </div>
        ))}

        <p className="text-xs text-slate-400">
          Password must have at least 8 characters,
          uppercase, lowercase and a number.
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold hover:bg-indigo-400 disabled:opacity-60"
        >
          {loading ? "Creating workspace..." : "Create workspace →"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-400">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
