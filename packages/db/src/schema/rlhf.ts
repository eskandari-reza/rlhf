import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const prompts = pgTable("prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  text: text("text").notNull(),
  language: text("language").notNull().default("en"),
  status: text("status").notNull().default("active"), // active | archived
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    source: text("source"), // اسم مدل یا منبع پاسخ
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("responses_prompt_idx").on(t.promptId)],
);

export const comparisons = pgTable(
  "comparisons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    responseAId: uuid("response_a_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    responseBId: uuid("response_b_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    // حداقل تعداد ارزیابی لازم برای کامل شدن
    targetAnnotations: integer("target_annotations").notNull().default(3),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("comparisons_prompt_idx").on(t.promptId),
    uniqueIndex("comparisons_pair_idx").on(t.responseAId, t.responseBId),
  ],
);

export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    comparisonId: uuid("comparison_id")
      .notNull()
      .references(() => comparisons.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    choice: text("choice").notNull(), // "a" | "b" | "tie"
    reason: text("reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("annotations_user_comparison_idx").on(t.userId, t.comparisonId),
    index("annotations_comparison_idx").on(t.comparisonId),
  ],
);