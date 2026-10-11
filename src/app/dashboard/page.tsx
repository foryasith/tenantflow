
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { LogoutButton } from "@/components/auth/logout-button";

type Booking = {
  id: string;
  title: string;
  status: string;
  start_time: Date;
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const data = await withTenant(user.tenantId, async (client) => {
    const [organization, bookings, members] = await Promise.all([
      client.query<{ name: string; slug: string }>(
        "SELECT name, slug FROM organizations LIMIT 1"
      ),
      client.query<Booking>(
        `SELECT id, title, status, start_time
         FROM bookings
         ORDER BY start_time DESC LIMIT 5`
      ),
      client.query<{ total: string }>(
        "SELECT COUNT(*)::text AS total FROM users"
      ),
    ]);

    return {
      organization: organization.rows[0],
      bookings: bookings.rows,
      memberCount: Number(members.rows[0]?.total ?? 0),
    };
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/dashboard" className="text-xl font-bold">
            <span className="text-indigo-400">◆</span> TenantFlow
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-400 sm:block">
              {user.fullName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="mb-2 text-sm font-medium text-indigo-400">
          ORGANIZATION DASHBOARD
        </p>

        <h1 className="text-3xl font-bold sm:text-4xl">
          Welcome back, {user.fullName.split(" ")[0]}!
        </h1>

        <p className="mt-3 text-slate-400">
          Here is an overview of your organization.
        </p>

        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Organization",
              value: data.organization?.name ?? "Workspace",
            },
            {
              label: "Team members",
              value: String(data.memberCount),
            },
            {
              label: "Recent bookings",
              value: String(data.bookings.length),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <p className="text-sm text-slate-400">
                {stat.label}
              </p>
              <p className="mt-3 break-words text-2xl font-bold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-9 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-6">
            <h2 className="text-xl font-semibold">Recent bookings</h2>
            <p className="mt-1 text-sm text-slate-400">
              Bookings belonging to your organization only.
            </p>
          </div>

          {data.bookings.length === 0 ? (
            <p className="p-8 text-center text-slate-400">
              No bookings yet. Booking management is coming in Week 2.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {data.bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-5"
                >
                  <div>
                    <p className="font-medium">{booking.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {new Date(booking.start_time).toLocaleString("en-US")}
                    </p>
                  </div>

                  <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
                    {booking.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-7 rounded-xl border border-slate-800 p-5 text-sm text-slate-400">
          Signed in as <span className="text-white">{user.email}</span>
          {" · "}Role: <span className="text-white">{user.role}</span>
          {" · "}Organization:{" "}
          <span className="text-white">{data.organization?.slug}</span>
        </div>
      </div>
    </main>
  );
}
