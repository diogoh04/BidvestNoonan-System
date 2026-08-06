import { Hourglass } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function PendingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <Hourglass size={40} className="text-petrol" />
      <h1 className="font-display text-xl font-bold text-ink">Awaiting approval</h1>
      <p className="max-w-sm text-sm text-ink/50">
        Your account was created successfully. A Master needs to approve it and set your access role
        (Master, Supervisor or Team Leader) before you can use the system.
      </p>
      <LogoutButton />
    </main>
  );
}
