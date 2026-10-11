import { auth } from "./lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const middleware = auth((req) => {
  const isLoggedIn = !!req.auth;
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.url));
  }
  return NextResponse.next();
});

// این assertion مانع از اینکه TS بخواد AppRouteHandlerFn رو name کنه میشه
export default middleware as unknown as (req: NextRequest) => Response | Promise<Response>;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
