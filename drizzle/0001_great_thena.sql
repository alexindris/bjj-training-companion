CREATE TABLE "goal_observations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"class_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"outcome" text NOT NULL,
	"opportunities" integer,
	"attempts" integer,
	"successes" integer,
	"obstacle" text,
	"next_cue" text,
	CONSTRAINT "goal_observations_class_unique" UNIQUE("class_id"),
	CONSTRAINT "goal_observations_outcome_check" CHECK ("goal_observations"."outcome" in ('no_opportunity', 'tried', 'worked_on_something_else')),
	CONSTRAINT "goal_observations_counts_check" CHECK (("goal_observations"."opportunities" is null or "goal_observations"."opportunities" between 0 and 9999) and ("goal_observations"."attempts" is null or "goal_observations"."attempts" between 0 and 9999) and ("goal_observations"."successes" is null or "goal_observations"."successes" between 0 and 9999)),
	CONSTRAINT "goal_observations_counts_outcome_check" CHECK ("goal_observations"."outcome" = 'tried' or ("goal_observations"."opportunities" is null and "goal_observations"."attempts" is null and "goal_observations"."successes" is null)),
	CONSTRAINT "goal_observations_counts_order_check" CHECK (("goal_observations"."attempts" is null or "goal_observations"."opportunities" is null or "goal_observations"."attempts" <= "goal_observations"."opportunities") and ("goal_observations"."successes" is null or "goal_observations"."attempts" is null or "goal_observations"."successes" <= "goal_observations"."attempts") and ("goal_observations"."successes" is null or "goal_observations"."opportunities" is null or "goal_observations"."successes" <= "goal_observations"."opportunities")),
	CONSTRAINT "goal_observations_text_check" CHECK (("goal_observations"."obstacle" is null or length("goal_observations"."obstacle") <= 5000) and ("goal_observations"."next_cue" is null or length("goal_observations"."next_cue") <= 5000))
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "goals_title_check" CHECK ("goals"."title" ~ '[^[:space:]]' and length("goals"."title") <= 200),
	CONSTRAINT "goals_notes_check" CHECK ("goals"."notes" is null or length("goals"."notes") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"submission_id" uuid NOT NULL,
	"training_date" date NOT NULL,
	"training_mode" text NOT NULL,
	"class_technique" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_sessions_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "training_sessions_submission_unique" UNIQUE("user_id","submission_id"),
	CONSTRAINT "training_sessions_mode_check" CHECK ("training_sessions"."training_mode" in ('gi', 'no-gi')),
	CONSTRAINT "training_sessions_technique_check" CHECK ("training_sessions"."class_technique" ~ '[^[:space:]]' and length("training_sessions"."class_technique") <= 2000),
	CONSTRAINT "training_sessions_date_check" CHECK ("training_sessions"."training_date" between '0001-01-01'::date and '9999-12-31'::date)
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "active_goal_id" text;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_owned_class_fk" FOREIGN KEY ("user_id","class_id") REFERENCES "public"."training_sessions"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_owned_goal_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_observations_owner_goal_idx" ON "goal_observations" USING btree ("user_id","goal_id");--> statement-breakpoint
CREATE INDEX "goals_owner_created_idx" ON "goals" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "training_sessions_history_idx" ON "training_sessions" USING btree ("user_id","training_date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_owned_active_goal_fk" FOREIGN KEY ("user_id","active_goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE no action ON UPDATE no action;