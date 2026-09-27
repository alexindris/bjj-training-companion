import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  goals,
  goalObservations,
  profiles,
  trainingSessions,
} from "@/db/schema";
import type { ClassInput } from "@/lib/training-validation";

export type Goal = typeof goals.$inferSelect;
export type TrainingClass = typeof trainingSessions.$inferSelect;
export type GoalObservation = typeof goalObservations.$inferSelect;
export type TrainingClassDetail = {
  class: TrainingClass;
  goal: Goal | null;
  observation: GoalObservation | null;
};

export class TrainingNotFoundError extends Error {
  constructor() {
    super("Training record not found");
    this.name = "TrainingNotFoundError";
  }
}

export async function listGoals(userId: string): Promise<Goal[]> {
  return db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.createdAt), desc(goals.id));
}

export async function getActiveGoal(userId: string): Promise<Goal | null> {
  const rows = await db
    .select({ goal: goals })
    .from(profiles)
    .innerJoin(
      goals,
      and(
        eq(goals.id, profiles.activeGoalId),
        eq(goals.userId, profiles.userId),
      ),
    )
    .where(eq(profiles.userId, userId))
    .limit(1);
  return rows[0]?.goal ?? null;
}

export async function createOwnedGoal(
  userId: string,
  input: { title: string; notes: string },
): Promise<Goal> {
  const [goal] = await db
    .insert(goals)
    .values({
      id: randomUUID(),
      userId,
      title: input.title,
      notes: input.notes,
    })
    .returning();
  if (!goal) throw new Error("Goal creation failed");
  return goal;
}

export async function selectOwnedGoal(
  userId: string,
  goalId: string | null,
): Promise<boolean> {
  if (goalId !== null) {
    const owned = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.id, goalId)))
      .limit(1);
    if (owned.length === 0) return false;
  }
  const updated = await db
    .update(profiles)
    .set({ activeGoalId: goalId })
    .where(eq(profiles.userId, userId))
    .returning({ userId: profiles.userId });
  return updated.length === 1;
}

export async function saveOwnedClass(userId: string, input: ClassInput) {
  return db.transaction(async (transaction) => {
    const [inserted] = await transaction
      .insert(trainingSessions)
      .values({
        id: randomUUID(),
        userId,
        submissionId: input.submissionId,
        date: input.date,
        mode: input.mode,
        technique: input.technique,
      })
      .onConflictDoNothing({
        target: [trainingSessions.userId, trainingSessions.submissionId],
      })
      .returning({ id: trainingSessions.id });
    if (!inserted) {
      const [original] = await transaction
        .select({ id: trainingSessions.id })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.userId, userId),
            eq(trainingSessions.submissionId, input.submissionId),
          ),
        )
        .limit(1);
      if (!original) throw new Error("Class save failed");
      return { classId: original.id, alreadySaved: true };
    }
    if (input.goalId !== null) {
      const [goal] = await transaction
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.id, input.goalId)))
        .limit(1);
      if (!goal) throw new TrainingNotFoundError();
      await transaction.insert(goalObservations).values({
        id: randomUUID(),
        userId,
        classId: inserted.id,
        goalId: goal.id,
        outcome: input.outcome!,
        opportunities: input.opportunities,
        attempts: input.attempts,
        successes: input.successes,
        obstacle: input.obstacle,
        nextCue: input.nextCue,
      });
    }
    return { classId: inserted.id, alreadySaved: false };
  });
}

export async function listOwnedHistory(userId: string, page: number) {
  if (!Number.isInteger(page) || page < 0 || page > 10000)
    throw new Error("Invalid history page");
  const rows = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.userId, userId))
    .orderBy(
      desc(trainingSessions.date),
      desc(trainingSessions.createdAt),
      desc(trainingSessions.id),
    )
    .limit(26)
    .offset(page * 25);
  return { classes: rows.slice(0, 25), hasMore: rows.length > 25 };
}

export async function getOwnedClass(
  userId: string,
  classId: string,
): Promise<TrainingClassDetail | null> {
  const [detail] = await db
    .select({
      class: trainingSessions,
      goal: goals,
      observation: goalObservations,
    })
    .from(trainingSessions)
    .leftJoin(
      goalObservations,
      and(
        eq(goalObservations.classId, trainingSessions.id),
        eq(goalObservations.userId, trainingSessions.userId),
      ),
    )
    .leftJoin(
      goals,
      and(
        eq(goals.id, goalObservations.goalId),
        eq(goals.userId, trainingSessions.userId),
      ),
    )
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.id, classId),
      ),
    )
    .limit(1);
  return detail ?? null;
}
