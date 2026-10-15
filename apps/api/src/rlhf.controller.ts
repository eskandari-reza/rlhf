import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
  UseGuards
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
  // ادمین: خروجی JSONL برای آموزش reward model
  @Get("admin/export")
  @UseGuards(AdminGuard)
  @Header("Content-Type", "application/x-ndjson; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="preferences.jsonl"')
  async exportData(@Query("minVotes") minVotesRaw?: string) {
    const minVotes = Math.max(1, Number(minVotesRaw) || 1);

    const [comps, prompts, resps, anns] = await Promise.all([
      db.select().from(schema.comparisons),
      db.select().from(schema.prompts),
      db.select().from(schema.responses),
      db.select().from(schema.annotations),
    ]);

    const promptMap = new Map(prompts.map((p) => [p.id, p]));
    const respMap = new Map(resps.map((r) => [r.id, r]));

    const votes = new Map<string, { a: number; b: number; tie: number }>();
    for (const x of anns) {
      const v = votes.get(x.comparisonId) ?? { a: 0, b: 0, tie: 0 };
      if (x.choice === "a" || x.choice === "b" || x.choice === "tie") v[x.choice]++;
      votes.set(x.comparisonId, v);
    }

    const lines: string[] = [];
    for (const c of comps) {
      const v = votes.get(c.id);
      if (!v) continue;
      if (v.a + v.b + v.tie < minVotes) continue;
      if (v.a === v.b) continue; // مساوی یا نظرات دوپاره: حذف

      const aWins = v.a > v.b;
      const chosen = respMap.get(aWins ? c.responseAId : c.responseBId);
      const rejected = respMap.get(aWins ? c.responseBId : c.responseAId);
      const prompt = promptMap.get(c.promptId);
      if (!prompt || !chosen || !rejected) continue;

      lines.push(
        JSON.stringify({
          comparison_id: c.id,
          prompt: prompt.text,
          language: prompt.language,
          chosen: chosen.text,
          rejected: rejected.text,
          chosen_source: chosen.source,
          rejected_source: rejected.source,
          votes: v,
        }),
      );
    }
    return lines.length ? lines.join("\n") + "\n" : "";
  }
  // ادمین: توافق هر ارزیاب با بقیه
  @Get("admin/raters")
  @UseGuards(AdminGuard)
  async raterStats(@Query("minVotes") raw?: string) {
    const minVotes = Math.max(2, Math.floor(Number(raw)) || 3);

    const [anns, us] = await Promise.all([
      db.select().from(schema.annotations),
      db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users),
    ]);
    const emailOf = new Map(us.map((u) => [u.id, u.email]));

    const byComp = new Map<string, { userId: string; choice: string }[]>();
    const stats = new Map<
      string,
      { voted: number; a: number; b: number; tie: number; comparable: number; agreed: number }
    >();
    const get = (id: string) => {
      let s = stats.get(id);
      if (!s) {
        s = { voted: 0, a: 0, b: 0, tie: 0, comparable: 0, agreed: 0 };
        stats.set(id, s);
      }
      return s;
    };

    for (const x of anns) {
      const list = byComp.get(x.comparisonId) ?? [];
      list.push({ userId: x.userId, choice: x.choice });
      byComp.set(x.comparisonId, list);

      const s = get(x.userId);
      s.voted++;
      if (x.choice === "a" || x.choice === "b" || x.choice === "tie") s[x.choice]++;
    }

    for (const votes of byComp.values()) {
      if (votes.length < minVotes) continue;
      for (const v of votes) {
        const others = votes.filter((o) => o !== v);
        const tally = new Map<string, number>();
        for (const o of others) tally.set(o.choice, (tally.get(o.choice) ?? 0) + 1);
        const sorted = [...tally.entries()].sort((p, q) => q[1] - p[1]);
        // فقط وقتی بقیه اکثریت واضح دارند
        if (sorted.length === 0 || (sorted.length > 1 && sorted[0][1] === sorted[1][1])) continue;
        const s = get(v.userId);
        s.comparable++;
        if (sorted[0][0] === v.choice) s.agreed++;
      }
    }

    const raters = [...stats.entries()].map(([id, s]) => ({
      email: emailOf.get(id) ?? id,
      voted: s.voted,
      comparable: s.comparable,
      agreementRate: s.comparable ? s.agreed / s.comparable : null,
      share: {
        a: s.voted ? s.a / s.voted : 0,
        b: s.voted ? s.b / s.voted : 0,
        tie: s.voted ? s.tie / s.voted : 0,
      },
    }));
    raters.sort((p, q) => (p.agreementRate ?? 2) - (q.agreementRate ?? 2));
    return { minVotes, raters };
  }

  // ادمین: توافق ارزیاب‌ها (Fleiss' Kappa)
  @Get("admin/agreement")
  @UseGuards(AdminGuard)
  async agreement(@Query("raters") ratersRaw?: string) {
    const n = Math.max(2, Math.floor(Number(ratersRaw)) || 3);
    const cats = ["a", "b", "tie"] as const;

    const anns = await db
      .select()
      .from(schema.annotations)
      .orderBy(schema.annotations.createdAt);

    const byComp = new Map<string, string[]>();
    for (const x of anns) {
      const list = byComp.get(x.comparisonId) ?? [];
      list.push(x.choice);
      byComp.set(x.comparisonId, list);
    }

    // فقط مقایسه‌هایی که حداقل n رأی دارند؛ n رأی اول را می‌شماریم
    const rows: number[][] = [];
    let skipped = 0;
    for (const votes of byComp.values()) {
      if (votes.length < n) {
        skipped++;
        continue;
      }
      const counts = cats.map((c) => votes.slice(0, n).filter((v) => v === c).length);
      rows.push(counts);
    }

    const N = rows.length;
    if (N === 0) {
      return { raters: n, items: 0, skipped, kappa: null, message: "مقایسه‌ای با رأی کافی نیست" };
    }

    // توافق مشاهده‌شده برای هر مقایسه
    const Pi = rows.map(
      (r) => (r.reduce((s, c) => s + c * c, 0) - n) / (n * (n - 1)),
    );
    const Pbar = Pi.reduce((s, p) => s + p, 0) / N;

    // سهم هر دسته در کل رأی‌ها و توافق مورد انتظار از روی شانس
    const share = cats.map((_, j) => rows.reduce((s, r) => s + r[j], 0) / (N * n));
    const Pe = share.reduce((s, p) => s + p * p, 0);

    const kappa = Pe >= 1 ? null : (Pbar - Pe) / (1 - Pe);

    let level = "نامعتبر (همه همیشه یک گزینه را زده‌اند)";
    if (kappa !== null) {
      if (kappa < 0) level = "ضعیف‌تر از شانس";
      else if (kappa <= 0.2) level = "ناچیز";
      else if (kappa <= 0.4) level = "ضعیف";
      else if (kappa <= 0.6) level = "متوسط";
      else if (kappa <= 0.8) level = "قابل‌توجه";
      else level = "تقریباً کامل";
    }

    return {
      raters: n,
      items: N,
      skipped,
      kappa,
      level,
      observedAgreement: Pbar,
      expectedAgreement: Pe,
      categoryShare: { a: share[0], b: share[1], tie: share[2] },
    };
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