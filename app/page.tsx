import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ClipboardList, Archive, LayoutDashboard, FileCheck2, Home, Table2, Gauge } from "lucide-react";
import Header from "@/components/Header";
import T from "@/components/T";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Header role={user.role} />
      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-24">
        <p className="mb-10 font-mono text-xs uppercase tracking-[0.3em] text-ink/40">
          <T s="Select a view" />
        </p>
        <div className="grid w-full max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {user.role === "master" && (
            <>
              <Link
                href="/teams"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <Table2 size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">Teams</div>
                  <div className="mt-1 text-sm text-ink/50">
                    Edit team number, TL hours and every building in one place
                  </div>
                </div>
              </Link>

              <Link
                href="/hours-control"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <Gauge size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">Hours Control</div>
                  <div className="mt-1 text-sm text-ink/50">
                    UCD Hours vs hours actually spent, by team and week
                  </div>
                </div>
              </Link>

              <Link
                href="/buildings"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <Building2 size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">Building</div>
                  <div className="mt-1 text-sm text-ink/50">
                    View by building and all staff assigned to it
                  </div>
                </div>
              </Link>

              <Link
                href="/timesheets"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <ClipboardList size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">TimeSheets</div>
                  <div className="mt-1 text-sm text-ink/50">
                    Blank timesheet, ready to print
                  </div>
                </div>
              </Link>

              <Link
                href="/outros"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <Archive size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">Other</div>
                  <div className="mt-1 text-sm text-ink/50">P45, LE, Staff Blocked and Sick.</div>
                </div>
              </Link>

              <Link
                href="/dashboard"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <LayoutDashboard size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">Dashboard</div>
                  <div className="mt-1 text-sm text-ink/50">Overview: staff, slots and hours by building</div>
                </div>
              </Link>
            </>
          )}

          {user.role === "supervisor" && (
            <>
              <Link
                href="/review"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <FileCheck2 size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">Fortnightly timesheets</div>
                  <div className="mt-1 text-sm text-ink/50">The forecast each team leader sent — review and mark as done</div>
                </div>
              </Link>

              <Link
                href="/review/adjustments"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <ClipboardList size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">Adjustments</div>
                  <div className="mt-1 text-sm text-ink/50">Weekly changes on top of the forecast</div>
                </div>
              </Link>
            </>
          )}

          {user.role === "team_leader" && (
            <>
              <Link
                href="/my"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <Home size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">
                    <T s="My Buildings" />
                  </div>
                  <div className="mt-1 text-sm text-ink/50">
                    <T s="Buildings under your responsibility" />
                  </div>
                </div>
              </Link>

              <Link
                href="/my/timesheets"
                className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
              >
                <ClipboardList size={40} className="text-petrol" />
                <div>
                  <div className="font-display text-2xl font-bold text-ink">
                    <T s="My Timesheets" />
                  </div>
                  <div className="mt-1 text-sm text-ink/50">
                    <T s="Log and track timesheets" />
                  </div>
                </div>
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
