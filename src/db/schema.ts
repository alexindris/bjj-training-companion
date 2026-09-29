import {
  index,
  pgTable,
  text,
  timestamp,
  boolean,
  check,
  date,
  integer,
  uuid,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_sessions_user_idx").on(table.userId)],
);

export const account = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_accounts_user_idx").on(table.userId)],
);

export const verification = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("en"),
    timezone: text("timezone").notNull().default("UTC"),
    trainingMode: text("training_mode").notNull().default("gi"),
    activeGoalId: text("active_goal_id"),
  },
  (table) => [
    check("profiles_locale_check", sql`${table.locale} in ('en', 'es')`),
    check(
      "profiles_training_mode_check",
      sql`${table.trainingMode} in ('gi', 'no-gi')`,
    ),
    foreignKey({
      columns: [table.userId, table.activeGoalId],
      foreignColumns: [goals.userId, goals.id],
      name: "profiles_owned_active_goal_fk",
    }),
  ],
);

// Shared original English fixtures. No third-party corpus is imported.
export const referencePositions = pgTable("reference_positions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  provenance: text("provenance").notNull(),
});

export const referenceTechniques = pgTable(
  "reference_techniques",
  {
    id: text("id").primaryKey(),
    positionId: text("position_id")
      .notNull()
      .references(() => referencePositions.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    provenance: text("provenance").notNull(),
  },
  (table) => [
    index("reference_techniques_position_id_idx").on(
      table.positionId,
      table.id,
    ),
    check(
      "reference_techniques_content_check",
      sql`${table.title} ~ '[^[:space:]]' and length(${table.title}) <= 200 and ${table.description} ~ '[^[:space:]]' and length(${table.description}) <= 2000 and ${table.provenance} ~ '[^[:space:]]' and length(${table.provenance}) <= 1000`,
    ),
  ],
);

export const referenceVideos = pgTable(
  "reference_videos",
  {
    id: text("id").primaryKey(),
    techniqueId: text("technique_id")
      .notNull()
      .references(() => referenceTechniques.id, { onDelete: "restrict" }),
    url: text("url").notNull(),
    label: text("label").notNull(),
    sourceName: text("source_name").notNull(),
    sourceTitle: text("source_title").notNull(),
    startSeconds: integer("start_seconds").notNull(),
    momentLabel: text("moment_label").notNull(),
    provenance: text("provenance").notNull(),
    reviewedOn: date("reviewed_on", { mode: "string" }).notNull(),
  },
  (table) => [
    index("reference_videos_technique_id_idx").on(table.techniqueId, table.id),
    check(
      "reference_videos_content_check",
      sql`${table.url} ~ '[^[:space:]]' and length(${table.url}) <= 2048 and ${table.label} ~ '[^[:space:]]' and length(${table.label}) <= 200 and ${table.sourceName} ~ '[^[:space:]]' and length(${table.sourceName}) <= 200 and ${table.sourceTitle} ~ '[^[:space:]]' and length(${table.sourceTitle}) <= 200 and ${table.momentLabel} ~ '[^[:space:]]' and length(${table.momentLabel}) <= 200 and ${table.provenance} ~ '[^[:space:]]' and length(${table.provenance}) <= 1000`,
    ),
    check(
      "reference_videos_start_check",
      sql`${table.startSeconds} between 0 and 21600`,
    ),
    check(
      "reference_videos_date_check",
      sql`${table.reviewedOn} between '0001-01-01'::date and '9999-12-31'::date`,
    ),
  ],
);

export const referenceNotes = pgTable(
  "reference_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    positionId: text("position_id").references(() => referencePositions.id, {
      onDelete: "restrict",
    }),
    techniqueId: text("technique_id").references(() => referenceTechniques.id, {
      onDelete: "restrict",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("reference_notes_owner_position_unique").on(
      table.userId,
      table.positionId,
    ),
    unique("reference_notes_owner_technique_unique").on(
      table.userId,
      table.techniqueId,
    ),
    check(
      "reference_notes_target_xor_check",
      sql`(${table.positionId} is not null) <> (${table.techniqueId} is not null)`,
    ),
    check(
      "reference_notes_body_check",
      sql`${table.body} ~ '[^[:space:]]' and length(${table.body}) <= 5000`,
    ),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("goals_owner_id_unique").on(table.userId, table.id),
    index("goals_owner_created_idx").on(
      table.userId,
      table.createdAt,
      table.id,
    ),
    check(
      "goals_title_check",
      sql`${table.title} ~ '[^[:space:]]' and length(${table.title}) <= 200`,
    ),
    check(
      "goals_notes_check",
      sql`${table.notes} is null or length(${table.notes}) <= 5000`,
    ),
  ],
);

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").notNull(),
    date: date("training_date", { mode: "string" }).notNull(),
    mode: text("training_mode").notNull(),
    technique: text("class_technique").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("training_sessions_owner_id_unique").on(table.userId, table.id),
    unique("training_sessions_submission_unique").on(
      table.userId,
      table.submissionId,
    ),
    index("training_sessions_history_idx").on(
      table.userId,
      table.date.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    check(
      "training_sessions_mode_check",
      sql`${table.mode} in ('gi', 'no-gi')`,
    ),
    check(
      "training_sessions_technique_check",
      sql`${table.technique} ~ '[^[:space:]]' and length(${table.technique}) <= 2000`,
    ),
    check(
      "training_sessions_date_check",
      sql`${table.date} between '0001-01-01'::date and '9999-12-31'::date`,
    ),
  ],
);

export const goalObservations = pgTable(
  "goal_observations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    classId: text("class_id").notNull(),
    goalId: text("goal_id").notNull(),
    outcome: text("outcome").notNull(),
    opportunities: integer("opportunities"),
    attempts: integer("attempts"),
    successes: integer("successes"),
    obstacle: text("obstacle"),
    nextCue: text("next_cue"),
  },
  (table) => [
    unique("goal_observations_class_unique").on(table.classId),
    index("goal_observations_owner_goal_idx").on(table.userId, table.goalId),
    foreignKey({
      columns: [table.userId, table.classId],
      foreignColumns: [trainingSessions.userId, trainingSessions.id],
      name: "goal_observations_owned_class_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId, table.goalId],
      foreignColumns: [goals.userId, goals.id],
      name: "goal_observations_owned_goal_fk",
    }),
    check(
      "goal_observations_outcome_check",
      sql`${table.outcome} in ('no_opportunity', 'tried', 'worked_on_something_else')`,
    ),
    check(
      "goal_observations_counts_check",
      sql`(${table.opportunities} is null or ${table.opportunities} between 0 and 9999) and (${table.attempts} is null or ${table.attempts} between 0 and 9999) and (${table.successes} is null or ${table.successes} between 0 and 9999)`,
    ),
    check(
      "goal_observations_counts_outcome_check",
      sql`${table.outcome} = 'tried' or (${table.opportunities} is null and ${table.attempts} is null and ${table.successes} is null)`,
    ),
    check(
      "goal_observations_counts_order_check",
      sql`(${table.attempts} is null or ${table.opportunities} is null or ${table.attempts} <= ${table.opportunities}) and (${table.successes} is null or ${table.attempts} is null or ${table.successes} <= ${table.attempts}) and (${table.successes} is null or ${table.opportunities} is null or ${table.successes} <= ${table.opportunities})`,
    ),
    check(
      "goal_observations_text_check",
      sql`(${table.obstacle} is null or length(${table.obstacle}) <= 5000) and (${table.nextCue} is null or length(${table.nextCue}) <= 5000)`,
    ),
  ],
);
