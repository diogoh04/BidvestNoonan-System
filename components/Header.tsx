"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Filter, UserPlus, Users, ClipboardList, UserCircle } from "lucide-react";
import LogoutButton from "./LogoutButton";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { AppRole } from "@/lib/types";

export default function Header({ role }: { role: AppRole }) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  // "/" é o hub de cada papel (ver app/page.tsx) — não tem pra onde voltar
  // dali, então some. Usa o histórico do navegador (não um mapa de "pai" de
  // cada rota) de propósito: com dezenas de telas de detalhe diferentes,
  // manter esse mapa manualmente seria mais frágil do que confiar em como a
  // pessoa realmente chegou aqui.
  const showBack = pathname !== "/";

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-1 px-2 py-2.5 sm:gap-2 sm:px-6 sm:py-4">
        <div className="flex justify-start gap-1.5 sm:gap-2">
          {showBack && (
            <button
              type="button"
              onClick={() => router.back()}
              title={t("Back")}
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol sm:gap-2 sm:px-3 sm:py-2"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">{t("Back")}</span>
            </button>
          )}
          {role === "master" && (
            <Link
              href="/filter"
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol sm:gap-2 sm:px-3 sm:py-2"
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Search</span>
            </Link>
          )}
          {role === "master" && (
            <Link
              href="/users"
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol sm:gap-2 sm:px-3 sm:py-2"
            >
              <Users size={16} />
              <span className="hidden sm:inline">Users</span>
            </Link>
          )}
          {role === "supervisor" && (
            <Link
              href="/review"
              className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol sm:gap-2 sm:px-3 sm:py-2"
            >
              <ClipboardList size={16} />
              <span className="hidden sm:inline">Timesheets</span>
            </Link>
          )}
          {role === "team_leader" && (
            <>
              <Link
                href="/my/perfil"
                className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol sm:gap-2 sm:px-3 sm:py-2"
              >
                <UserCircle size={16} />
                <span className="hidden sm:inline">{t("My Profile")}</span>
              </Link>
              <LanguageToggle />
            </>
          )}
        </div>

        <Link href="/" className="flex justify-self-center">
          <Image
            src="/Bidvest-noonanlogo.jpg"
            alt="Bidvest Noonan"
            width={350}
            height={250}
            priority
            className="h-7 w-auto object-contain sm:h-10"
          />
        </Link>

        <div className="flex justify-end gap-1.5 sm:gap-2">
          <LogoutButton />
          {role === "master" && (
            <Link
              href="/staff/new"
              title="Register Staff"
              className="flex items-center gap-1.5 rounded-md bg-petrol px-2 py-1.5 text-sm font-medium text-white transition hover:bg-petrolDark sm:gap-2 sm:px-3 sm:py-2"
            >
              <UserPlus size={16} />
              <span className="hidden sm:inline">Register Staff</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
