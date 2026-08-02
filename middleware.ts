import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpg|logo.svg|logoUCD.png|Bidvest-noonanlogo.jpg).*)"],
};

// Bloqueio grosso por papel, feito aqui no Edge só com o payload já
// decodificado do cookie assinado (sem bcrypt, sem ida ao banco). A
// checagem que realmente vale (autorização por prédio/dono do recurso)
// fica em cada Route Handler — ver lib/auth.ts.
const TEAM_LEADER_ALLOWED_PREFIXES = ["/", "/my", "/login"];
const SUPERVISOR_ALLOWED_PREFIXES = ["/", "/review", "/login"];
const PENDING_ALLOWED_PREFIXES = ["/pending", "/login"];

function isAllowed(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname === "/register" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  const payload = await verifySessionToken(token);

  if (!payload) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (payload.role === "team_leader" && !isAllowed(pathname, TEAM_LEADER_ALLOWED_PREFIXES)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (payload.role === "supervisor" && !isAllowed(pathname, SUPERVISOR_ALLOWED_PREFIXES)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (payload.role === "pending" && !isAllowed(pathname, PENDING_ALLOWED_PREFIXES)) {
    return NextResponse.redirect(new URL("/pending", req.url));
  }

  return NextResponse.next();
}
