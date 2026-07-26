"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      title="Sair"
      className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-danger hover:text-danger"
    >
      <LogOut size={16} />
      Logout
    </button>
  );
}
