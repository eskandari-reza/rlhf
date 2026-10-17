import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Practice-scenario content.
 * English is the reference data (`*_en`); every translation lives in the
 * `*_translations` tables, one row per item and language (`lang`, e.g. "fa").
 */

// ───────── categories (17 in the current bank) ─────────
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: integer("number").notNull().unique(), // order in the source file
  nameEn: text("name_en").notNull(),
  track: text("track").notNull().default("topics"), // 'skills' | 'topics'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categoryTranslations = pgTable(
  "category_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    nameTranslation: text("name_translation").notNull(),
  },
  (t) => [uniqueIndex("category_translations_uq").on(t.categoryId, t.lang)],
);

// ───────── domains (170 in the current bank, 5 scenarios each) ─────────
export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(), // id prefix, e.g. FACT
    position: integer("position").notNull(), // order inside the category
    nameEn: text("name_en"), // not in the source file yet
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("domains_category_idx").on(t.categoryId)],
);

export const domainTranslations = pgTable(
  "domain_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    nameTranslation: text("name_translation").notNull(),
  },
  (t) => [uniqueIndex("domain_translations_uq").on(t.domainId, t.lang)],
);

// ───────── scenarios ─────────
export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(), // e.g. FACT-01; the import key
    number: integer("number").notNull(), // number inside its source bank
    bank: text("bank").notNull(), // which source file it came from
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // order inside the domain
    level: text("level").notNull(), // 'easy' | 'medium' | 'advanced'
    status: text("status").notNull().default("published"), // 'draft' | 'published'

    titleEn: text("title_en"),
    promptEn: text("prompt_en").notNull(),
    responseAEn: text("response_a_en").notNull(),
    responseBEn: text("response_b_en").notNull(),
    correct: text("correct").notNull(), // 'A' | 'B' | 'SAME'
    rating: text("rating").notNull(), // 'much_better' | 'better' | 'slightly_better' | 'about_the_same'
    analysisEn: text("analysis_en"), // empty for now, filled later
    justificationEn: text("justification_en").notNull(),
    verificationEn: text("verification_en"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("scenarios_category_level_idx").on(t.categoryId, t.level),
    index("scenarios_domain_idx").on(t.domainId),
  ],
);

export const scenarioTranslations = pgTable(
  "scenario_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    titleTranslation: text("title_translation"),
    promptTranslation: text("prompt_translation"),
    responseATranslation: text("response_a_translation"),
    responseBTranslation: text("response_b_translation"),
    analysisTranslation: text("analysis_translation"),
    justificationTranslation: text("justification_translation"),
    verificationTranslation: text("verification_translation"),
  },
  (t) => [uniqueIndex("scenario_translations_uq").on(t.scenarioId, t.lang)],
);
