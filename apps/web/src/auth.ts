import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema } from "@rlhf/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const isDev = process.env.AUTH_MODE === "dev";

export const { handlers, auth, signIn, signOut }: ReturnType<typeof NextAuth> = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: isDev ? "jwt" : "database" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    ...(isDev
      ? [
          Credentials({
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(creds) {
              const email = String(creds?.email ?? "");
              const password = String(creds?.password ?? "");
              if (!email || !password) return null;
              const [user] = await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.email, email))
                .limit(1);
              if (!user?.passwordHash) return null;
              const ok = await bcrypt.compare(password, user.passwordHash);
              return ok
                ? { id: user.id, email: user.email, name: user.name , role: user.role}
                : null;
            },
          }),
        ]
      : []),
  ],
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.role = (user as { role?: string }).role ?? "user";
    }
    return token;
  },
  async session({ session, token, user }) {
    session.user.id = (token?.id as string) ?? user?.id;
    (session.user as { role?: string }).role =
      (token?.role as string) ?? (user as { role?: string })?.role ?? "user";
    return session;
  },
},
});