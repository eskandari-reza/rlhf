CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"name_en" text NOT NULL,
	"track" text DEFAULT 'topics' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "category_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name_translation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"name_translation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	"name_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "scenario_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"title_translation" text,
	"prompt_translation" text,
	"response_a_translation" text,
	"response_b_translation" text,
	"analysis_translation" text,
	"justification_translation" text,
	"verification_translation" text
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"number" integer NOT NULL,
	"bank" text NOT NULL,
	"category_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"level" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"title_en" text,
	"prompt_en" text NOT NULL,
	"response_a_en" text NOT NULL,
	"response_b_en" text NOT NULL,
	"correct" text NOT NULL,
	"rating" text NOT NULL,
	"analysis_en" text,
	"justification_en" text NOT NULL,
	"verification_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenarios_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_translations" ADD CONSTRAINT "domain_translations_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_translations" ADD CONSTRAINT "scenario_translations_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_translations_uq" ON "category_translations" USING btree ("category_id","lang");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_translations_uq" ON "domain_translations" USING btree ("domain_id","lang");--> statement-breakpoint
CREATE INDEX "domains_category_idx" ON "domains" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_translations_uq" ON "scenario_translations" USING btree ("scenario_id","lang");--> statement-breakpoint
CREATE INDEX "scenarios_category_level_idx" ON "scenarios" USING btree ("category_id","level");--> statement-breakpoint
CREATE INDEX "scenarios_domain_idx" ON "scenarios" USING btree ("domain_id");