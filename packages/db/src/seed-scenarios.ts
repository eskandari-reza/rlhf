import { config } from "dotenv";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import {
  categories,
  categoryTranslations,
  domains,
  domainTranslations,
  scenarios,
  scenarioTranslations,
} from "./schema/scenarios";

config();

/*
 * Usage (from packages/db):
 *   pnpm exec tsx --env-file=../../.env src/seed-scenarios.ts data/scenarios.json
 *   pnpm exec tsx --env-file=../../.env src/seed-scenarios.ts data/scenarios.json --dry-run
 * Optional 2nd positional argument: language of the *_translation fields (default "fa").
 * Optional flag: --bank=NAME (default: file name without extension).
 *
 * Safe to run again: rows are matched by scenario `code` / domain `code` / category `number`.
 * Fields that may be filled later by hand (analysis_en, verification_en, title_en,
 * domain name_en, category track) are never overwritten with empty values.
 */

type RawCategory = { number: number; name_fa: string; name_en: string };
type RawScenario = {
  number: number;
  code: string;
  category_number: number;
  domain_fa: string;
  level: string;
  title_translation: string | null;
  prompt_en: string;
  prompt_translation: string | null;
  response_a_en: string;
  response_a_translation: string | null;
  response_b_en: string;
  response_b_translation: string | null;
  correct: string;
  rating: string;
  analysis_en: string | null;
  analysis_translation: string | null;
  justification_en: string;
  justification_translation: string | null;
  verification_en: string | null;
  verification_translation: string | null;
};

const LEVELS = new Set(["easy", "medium", "advanced"]);
const CORRECT = new Set(["A", "B", "SAME"]);
const RATINGS = new Set(["much_better", "better", "slightly_better", "about_the_same"]);
// Categories 1–4 are treated as annotation skills, the rest as topics (editable later in the DB).
const SKILL_CATEGORIES = new Set([1, 2, 3, 4]);

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const pos = args.filter((a) => !a.startsWith("--"));
const file = pos[0];
const lang = pos[1] ?? "fa";
const dryRun = flags.includes("--dry-run");

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const excluded = (col: string) => sql.raw(`excluded."${col}"`);

async function main() {
  if (!file) {
    console.error("Usage: tsx seed-scenarios.ts <scenarios.json> [lang] [--dry-run] [--bank=NAME]");
    process.exit(1);
  }
  const bankFlag = flags.find((f) => f.startsWith("--bank="));
  const bank = bankFlag ? bankFlag.slice(7) : file.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");

  const data = JSON.parse(readFileSync(file, "utf8")) as {
    categories: RawCategory[];
    scenarios: RawScenario[];
  };

  // ── validate ──
  const problems: string[] = [];
  const seen = new Set<string>();
  const catNumbers = new Set(data.categories.map((c) => c.number));
  for (const s of data.scenarios) {
    const id = `${s.code ?? "?"} (#${s.number})`;
    if (!s.code) problems.push(`#${s.number}: missing code`);
    if (seen.has(s.code)) problems.push(`${id}: duplicate code`);
    seen.add(s.code);
    if (!LEVELS.has(s.level)) problems.push(`${id}: bad level ${s.level}`);
    if (!CORRECT.has(s.correct)) problems.push(`${id}: bad correct ${s.correct}`);
    if (!RATINGS.has(s.rating)) problems.push(`${id}: bad rating ${s.rating}`);
    if (!catNumbers.has(s.category_number)) problems.push(`${id}: unknown category ${s.category_number}`);
    for (const f of ["prompt_en", "response_a_en", "response_b_en", "justification_en"] as const) {
      if (!s[f]) problems.push(`${id}: missing ${f}`);
    }
  }
  if (problems.length) {
    console.error(`Validation failed (${problems.length}):`);
    problems.slice(0, 40).forEach((p) => console.error("  - " + p));
    process.exit(1);
  }

  // ── derive domains: code = id prefix, ordered by first appearance ──
  const prefix = (code: string) => code.replace(/-\d+$/, "");
  const domainInfo = new Map<string, { categoryNumber: number; nameFa: string; position: number }>();
  const perCategory = new Map<number, number>();
  for (const s of data.scenarios) {
    const p = prefix(s.code);
    if (!domainInfo.has(p)) {
      const n = (perCategory.get(s.category_number) ?? 0) + 1;
      perCategory.set(s.category_number, n);
      domainInfo.set(p, { categoryNumber: s.category_number, nameFa: s.domain_fa, position: n });
    }
  }

  console.log(
    `File: ${file}  bank: ${bank}  lang: ${lang}\n` +
      `Categories: ${data.categories.length}  Domains: ${domainInfo.size}  Scenarios: ${data.scenarios.length}`,
  );
  if (dryRun) {
    console.log("Dry run: validation passed, nothing written.");
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      // categories
      const catRows = await tx
        .insert(categories)
        .values(
          data.categories.map((c) => ({
            number: c.number,
            nameEn: c.name_en,
            track: SKILL_CATEGORIES.has(c.number) ? "skills" : "topics",
          })),
        )
        .onConflictDoUpdate({ target: categories.number, set: { nameEn: excluded("name_en") } })
        .returning({ id: categories.id, number: categories.number });
      const catId = new Map(catRows.map((r) => [r.number, r.id]));

      await tx
        .insert(categoryTranslations)
        .values(
          data.categories.map((c) => ({
            categoryId: catId.get(c.number)!,
            lang,
            nameTranslation: c.name_fa,
          })),
        )
        .onConflictDoUpdate({
          target: [categoryTranslations.categoryId, categoryTranslations.lang],
          set: { nameTranslation: excluded("name_translation") },
        });

      // domains
      const domainEntries = [...domainInfo.entries()];
      const domRows = await tx
        .insert(domains)
        .values(
          domainEntries.map(([code, d]) => ({
            code,
            categoryId: catId.get(d.categoryNumber)!,
            position: d.position,
          })),
        )
        .onConflictDoUpdate({
          target: domains.code,
          set: { categoryId: excluded("category_id"), position: excluded("position") },
        })
        .returning({ id: domains.id, code: domains.code });
      const domId = new Map(domRows.map((r) => [r.code, r.id]));

      await tx
        .insert(domainTranslations)
        .values(
          domainEntries.map(([code, d]) => ({
            domainId: domId.get(code)!,
            lang,
            nameTranslation: d.nameFa,
          })),
        )
        .onConflictDoUpdate({
          target: [domainTranslations.domainId, domainTranslations.lang],
          set: { nameTranslation: excluded("name_translation") },
        });

      // scenarios (position = order by number inside its domain)
      const posInDomain = new Map<string, number>();
      const scenarioValues = data.scenarios.map((s) => {
        const p = prefix(s.code);
        const pos = (posInDomain.get(p) ?? 0) + 1;
        posInDomain.set(p, pos);
        return {
          code: s.code,
          number: s.number,
          bank,
          categoryId: catId.get(s.category_number)!,
          domainId: domId.get(p)!,
          position: pos,
          level: s.level,
          promptEn: s.prompt_en,
          responseAEn: s.response_a_en,
          responseBEn: s.response_b_en,
          correct: s.correct,
          rating: s.rating,
          analysisEn: s.analysis_en,
          justificationEn: s.justification_en,
          verificationEn: s.verification_en,
        };
      });

      const codeToId = new Map<string, string>();
      for (const part of chunk(scenarioValues, 100)) {
        const rows = await tx
          .insert(scenarios)
          .values(part)
          .onConflictDoUpdate({
            target: scenarios.code,
            set: {
              number: excluded("number"),
              bank: excluded("bank"),
              categoryId: excluded("category_id"),
              domainId: excluded("domain_id"),
              position: excluded("position"),
              level: excluded("level"),
              promptEn: excluded("prompt_en"),
              responseAEn: excluded("response_a_en"),
              responseBEn: excluded("response_b_en"),
              correct: excluded("correct"),
              rating: excluded("rating"),
              justificationEn: excluded("justification_en"),
              // never wipe values that were filled in later
              analysisEn: sql`coalesce(excluded."analysis_en", ${scenarios.analysisEn})`,
              verificationEn: sql`coalesce(excluded."verification_en", ${scenarios.verificationEn})`,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: scenarios.id, code: scenarios.code });
        rows.forEach((r) => codeToId.set(r.code, r.id));
      }

      // scenario translations
      const transValues = data.scenarios.map((s) => ({
        scenarioId: codeToId.get(s.code)!,
        lang,
        titleTranslation: s.title_translation,
        promptTranslation: s.prompt_translation,
        responseATranslation: s.response_a_translation,
        responseBTranslation: s.response_b_translation,
        analysisTranslation: s.analysis_translation,
        justificationTranslation: s.justification_translation,
        verificationTranslation: s.verification_translation,
      }));
      for (const part of chunk(transValues, 100)) {
        await tx
          .insert(scenarioTranslations)
          .values(part)
          .onConflictDoUpdate({
            target: [scenarioTranslations.scenarioId, scenarioTranslations.lang],
            set: {
              titleTranslation: sql`coalesce(excluded."title_translation", ${scenarioTranslations.titleTranslation})`,
              promptTranslation: excluded("prompt_translation"),
              responseATranslation: excluded("response_a_translation"),
              responseBTranslation: excluded("response_b_translation"),
              analysisTranslation: excluded("analysis_translation"),
              justificationTranslation: excluded("justification_translation"),
              verificationTranslation: sql`coalesce(excluded."verification_translation", ${scenarioTranslations.verificationTranslation})`,
            },
          });
      }
    });

    const [t] = await db.execute<{ c: number; d: number; s: number; tr: number }>(sql`
      select
        (select count(*)::int from categories) as c,
        (select count(*)::int from domains) as d,
        (select count(*)::int from scenarios) as s,
        (select count(*)::int from scenario_translations where lang = ${lang}) as tr
    `);
    console.log(
      `Done. In the database now: ${t.c} categories, ${t.d} domains, ${t.s} scenarios, ${t.tr} "${lang}" translations.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
