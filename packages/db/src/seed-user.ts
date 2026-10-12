import { config } from "dotenv";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { users } from "./schema/index";

config();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error("Usage: tsx seed-user.ts <email> <password>");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  const passwordHash = await bcrypt.hash(password, 10);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
    console.log("Updated password for", email);
  } else {
    await db
      .insert(users)
      .values({ email, name: "Test User", passwordHash, role: "admin" });
    console.log("Created user", email);
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});