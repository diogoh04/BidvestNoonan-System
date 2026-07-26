import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpg|logo.svg|logoUCD.png|Bidvest-noonanlogo.jpg).*)"],
};

export function middleware(req: NextRequest) {
  return NextResponse.next();
}
