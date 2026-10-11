// apps/web/src/proxy.ts
import { auth } from "./lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));
  }
  return NextResponse.next();
});

export default proxy as unknown as (req: NextRequest) => Response | Promise<Response>;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
