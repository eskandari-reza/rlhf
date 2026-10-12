import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { decode } from "@auth/core/jwt";
import { db, schema } from "@rlhf/db";
import { eq } from "drizzle-orm";

const DEV_COOKIE = "authjs.session-token";
const SECURE_COOKIE = "__Secure-authjs.session-token";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const cookies = req.headers.cookie ?? "";
    const parsed = Object.fromEntries(
      cookies.split(";").map((c: string) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      }),
    );

    const cookieName = parsed[SECURE_COOKIE] ? SECURE_COOKIE : DEV_COOKIE;
    const token = parsed[cookieName];
    if (!token) throw new UnauthorizedException("No session");

    if (process.env.AUTH_MODE === "dev") {
      const payload = await decode({
        token,
        secret: process.env.AUTH_SECRET!,
        salt: cookieName,
      });
      if (!payload?.id) throw new UnauthorizedException("Invalid session");
      req.user = { id: payload.id as string, email: payload.email as string };
      return true;
    }

    const [row] = await db
      .select({
        userId: schema.sessions.userId,
        expires: schema.sessions.expires,
        email: schema.users.email,
        role: schema.users.role,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(eq(schema.sessions.sessionToken, token))
      .limit(1);

    if (!row || row.expires < new Date()) {
      throw new UnauthorizedException("Session expired");
    }
    req.user = { id: row.userId, email: row.email, role: row.role };
    return true;
  }
}