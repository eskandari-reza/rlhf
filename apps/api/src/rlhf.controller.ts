import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { db, schema } from "@rlhf/db";
import { and, eq, notExists, sql } from "drizzle-orm";
import { AuthGuard } from "./auth.guard";
import { AdminGuard } from "./admin.guard";

type ImportItem = { prompt: string; language?: string; responses: { text: string; source?: string }[] };

@Controller()
@UseGuards(AuthGuard)
export class RlhfController {
  // ادمین: ورود prompt و پاسخ‌ها، و ساخت مقایسه‌ی جفتی
  @Post("admin/import")
  @UseGuards(AdminGuard)
  async import(@Body() body: { items: ImportItem[] }, @Req() req: { user: { id: string } }) {
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      throw new BadRequestException("items required");
    }
    let prompts = 0;
    let comparisons = 0;
    for (const item of body.items) {
      if (!item.prompt || !item.responses || item.responses.length < 2) continue;
      const [p] = await db
        .insert(schema.prompts)
        .values({ text: item.prompt, language: item.language ?? "en", createdBy: req.user.id })
        .returning();
      const rs = await db
        .insert(schema.responses)
        .values(item.responses.map((r) => ({ promptId: p.id, text: r.text, source: r.source })))
        .returning();
      prompts++;
      for (let i = 0; i < rs.length; i++) {
        for (let j = i + 1; j < rs.length; j++) {
          await db.insert(schema.comparisons).values({
            promptId: p.id,
            responseAId: rs[i].id,
            responseBId: rs[j].id,
          });
          comparisons++;
        }
      }
    }
    return { prompts, comparisons };
  }

  // کاربر: مقایسه‌ی بعدی که هنوز ارزیابی نکرده و به هدف نرسیده
  @Get("comparisons/next")
  async next(@Req() req: { user: { id: string } }) {
    const count = sql<number>`(select count(*) from ${schema.annotations} where ${schema.annotations.comparisonId} = ${schema.comparisons.id})`;
    const [c] = await db
      .select({ comparison: schema.comparisons, prompt: schema.prompts.text })
      .from(schema.comparisons)
      .innerJoin(schema.prompts, eq(schema.prompts.id, schema.comparisons.promptId))
      .where(
        and(
          notExists(
            db
              .select({ one: sql`1` })
              .from(schema.annotations)
              .where(
                and(
                  eq(schema.annotations.comparisonId, schema.comparisons.id),
                  eq(schema.annotations.userId, req.user.id),
                ),
              ),
          ),
          sql`${count} < ${schema.comparisons.targetAnnotations}`,
        ),
      )
      .orderBy(sql`random()`)
      .limit(1);

    if (!c) return { done: true };

    const [a] = await db.select().from(schema.responses).where(eq(schema.responses.id, c.comparison.responseAId));
    const [b] = await db.select().from(schema.responses).where(eq(schema.responses.id, c.comparison.responseBId));
    // منبع پاسخ را برای ارزیاب پنهان می‌کنیم تا سوگیری نشود
    return {
      comparisonId: c.comparison.id,
      prompt: c.prompt,
      a: { text: a.text },
      b: { text: b.text },
    };
  }

  // کاربر: ثبت انتخاب
  @Post("annotations")
  async annotate(
    @Body() body: { comparisonId: string; choice: string; reason?: string },
    @Req() req: { user: { id: string } },
  ) {
    if (!["a", "b", "tie"].includes(body?.choice)) {
      throw new BadRequestException("choice must be a, b or tie");
    }
    if (!body.comparisonId) throw new BadRequestException("comparisonId required");
    try {
      await db.insert(schema.annotations).values({
        comparisonId: body.comparisonId,
        userId: req.user.id,
        choice: body.choice,
        reason: body.reason,
      });
    } catch {
      throw new BadRequestException("Already annotated or invalid comparison");
    }
    return { ok: true };
  }
}