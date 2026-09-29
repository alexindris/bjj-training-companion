CREATE TABLE "reference_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"position_id" text,
	"technique_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_notes_owner_position_unique" UNIQUE("user_id","position_id"),
	CONSTRAINT "reference_notes_owner_technique_unique" UNIQUE("user_id","technique_id"),
	CONSTRAINT "reference_notes_target_xor_check" CHECK (("reference_notes"."position_id" is not null) <> ("reference_notes"."technique_id" is not null)),
	CONSTRAINT "reference_notes_body_check" CHECK ("reference_notes"."body" ~ '[^[:space:]]' and length("reference_notes"."body") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "reference_techniques" (
	"id" text PRIMARY KEY NOT NULL,
	"position_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"provenance" text NOT NULL,
	CONSTRAINT "reference_techniques_content_check" CHECK ("reference_techniques"."title" ~ '[^[:space:]]' and length("reference_techniques"."title") <= 200 and "reference_techniques"."description" ~ '[^[:space:]]' and length("reference_techniques"."description") <= 2000 and "reference_techniques"."provenance" ~ '[^[:space:]]' and length("reference_techniques"."provenance") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "reference_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"technique_id" text NOT NULL,
	"url" text NOT NULL,
	"label" text NOT NULL,
	"source_name" text NOT NULL,
	"source_title" text NOT NULL,
	"start_seconds" integer NOT NULL,
	"moment_label" text NOT NULL,
	"provenance" text NOT NULL,
	"reviewed_on" date NOT NULL,
	CONSTRAINT "reference_videos_content_check" CHECK ("reference_videos"."url" ~ '[^[:space:]]' and length("reference_videos"."url") <= 2048 and "reference_videos"."label" ~ '[^[:space:]]' and length("reference_videos"."label") <= 200 and "reference_videos"."source_name" ~ '[^[:space:]]' and length("reference_videos"."source_name") <= 200 and "reference_videos"."source_title" ~ '[^[:space:]]' and length("reference_videos"."source_title") <= 200 and "reference_videos"."moment_label" ~ '[^[:space:]]' and length("reference_videos"."moment_label") <= 200 and "reference_videos"."provenance" ~ '[^[:space:]]' and length("reference_videos"."provenance") <= 1000),
	CONSTRAINT "reference_videos_start_check" CHECK ("reference_videos"."start_seconds" between 0 and 21600),
	CONSTRAINT "reference_videos_date_check" CHECK ("reference_videos"."reviewed_on" between '0001-01-01'::date and '9999-12-31'::date)
);
--> statement-breakpoint
ALTER TABLE "reference_notes" ADD CONSTRAINT "reference_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_notes" ADD CONSTRAINT "reference_notes_position_id_reference_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."reference_positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_notes" ADD CONSTRAINT "reference_notes_technique_id_reference_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."reference_techniques"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_techniques" ADD CONSTRAINT "reference_techniques_position_id_reference_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."reference_positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_videos" ADD CONSTRAINT "reference_videos_technique_id_reference_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."reference_techniques"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reference_techniques_position_id_idx" ON "reference_techniques" USING btree ("position_id","id");--> statement-breakpoint
CREATE INDEX "reference_videos_technique_id_idx" ON "reference_videos" USING btree ("technique_id","id");