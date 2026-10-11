
import { Suspense } from "react";
import DashboardContent from "./dashboard-content";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-400" />
            <p className="text-slate-400">
              Loading your workspace...
            </p>
          </div>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
