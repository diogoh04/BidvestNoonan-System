import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpg|logo.svg|logoUCD.png|Bidvest-noonanlogo.jpg).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  const valid = await verifySessionToken(token);

  if (!valid) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

