
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-white lg:grid lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-slate-900 p-12 lg:flex">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          <span className="text-indigo-400">◆</span> TenantFlow
        </Link>

        <div className="max-w-lg">
          <div className="mb-7 inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-300">
            Multi-Tenant SaaS Platform
          </div>

          <h1 className="text-5xl leading-tight font-bold">
            One platform.
            <br />
            Every workspace.
            <br />
            <span className="text-indigo-400">
              Complete control.
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-400">
            Manage your organization, team and bookings
            securely from a single modern workspace.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              ["Secure", "Tenant isolation"],
              ["Simple", "Booking management"],
              ["Flexible", "Team collaboration"],
              ["Scalable", "SaaS architecture"],
            ].map(([heading, detail]) => (
              <div
                key={heading}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="font-semibold">{heading}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-500">
          © 2026 TenantFlow. Built for modern teams.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-10 block text-2xl font-bold lg:hidden"
          >
            <span className="text-indigo-400">◆</span> TenantFlow
          </Link>

          <h2 className="text-3xl font-bold tracking-tight">
            {title}
          </h2>

          <p className="mt-3 text-slate-400">
            {description}
          </p>

          <div className="mt-9">{children}</div>
        </div>
      </section>
    </main>
  );
}
