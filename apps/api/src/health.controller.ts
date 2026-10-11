import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { db } from "@rlhf/db";
import { sql } from "drizzle-orm";

@Controller("health")
export class HealthController {
  @Get()
  async check() {
    try {
      await db.execute(sql`select 1`);
      return { status: "ok", database: "connected" };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: "error",
        database: "unreachable",
        message: (err as Error).message,
      });
    }
  }
}