import { auth } from "./auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const proxy = auth((req) => {
  if (!req.auth) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
});

export default proxy as unknown as (req: NextRequest) => Response | Promise<Response>;

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};