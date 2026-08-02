import { Hourglass } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function PendingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <Hourglass size={40} className="text-petrol" />
      <h1 className="font-display text-xl font-bold text-ink">Aguardando aprovação</h1>
      <p className="max-w-sm text-sm text-ink/50">
        Sua conta foi criada com sucesso. Um Master precisa aprovar e definir seu papel de acesso
        (Master, Supervisor ou Team Leader) antes de você poder usar o sistema.
      </p>
      <LogoutButton />
    </main>
  );
}
