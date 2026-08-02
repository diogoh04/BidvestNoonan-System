"use client";

import Link from "next/link";
import Image from "next/image";
import { Filter, UserPlus, Users, ClipboardList, Home } from "lucide-react";
import LogoutButton from "./LogoutButton";
import type { AppRole } from "@/lib/types";

export default function Header({ role }: { role: AppRole }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-6 py-4">
        <div className="flex justify-start gap-2">
          {role === "master" && (
            <Link
              href="/filter"
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
            >
              <Filter size={16} />
              Search
            </Link>
          )}
          {role === "master" && (
            <Link
              href="/users"
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
            >
              <Users size={16} />
              Usuários
            </Link>
          )}
          {role === "supervisor" && (
            <Link
              href="/review"
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
            >
              <ClipboardList size={16} />
              Folhas para revisar
            </Link>
          )}
          {role === "team_leader" && (
            <Link
              href="/my"
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
            >
              <Home size={16} />
              Meus Prédios
            </Link>
          )}
        </div>

        <Link href="/" className="flex justify-self-center">
          <Image
            src="/Bidvest-noonanlogo.jpg"
            alt="Bidvest Noonan"
            width={350}
            height={250}
            priority
            className="h-10 w-auto object-contain"
          />
        </Link>

        <div className="flex justify-end gap-2">
          <LogoutButton />
          {role === "master" && (
            <Link
              href="/staff/new"
              className="flex items-center gap-2 rounded-md bg-petrol px-3 py-2 text-sm font-medium text-white transition hover:bg-petrolDark"
            >
              <UserPlus size={16} />
              Register Staff
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
