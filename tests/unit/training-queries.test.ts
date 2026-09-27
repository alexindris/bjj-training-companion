import { beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({
  session: vi.fn(),
  profile: vi.fn(),
  goals: vi.fn(),
  focus: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({
  getSession: boundary.session,
  getOwnProfile: boundary.profile,
}));
vi.mock("@/lib/training-store", () => ({
  listGoals: boundary.goals,
  getActiveGoal: boundary.focus,
}));
vi.mock("@/i18n/navigation", () => ({ redirect: boundary.redirect }));
vi.mock("next/navigation", () => ({ notFound: boundary.notFound }));
import { getTrainingContext } from "@/lib/training-queries";
const redirectError = new Error("redirect");
const missingError = new Error("not found");
beforeEach(() => {
  vi.resetAllMocks();
  boundary.session.mockResolvedValue({
    user: { id: "verified", name: "Synthetic" },
  });
  boundary.profile.mockResolvedValue({ trainingMode: "no-gi" });
  boundary.goals.mockResolvedValue([{ id: "own-goal" }]);
  boundary.focus.mockResolvedValue({ id: "own-goal" });
  boundary.redirect.mockImplementation(() => {
    throw redirectError;
  });
  boundary.notFound.mockImplementation(() => {
    throw missingError;
  });
});
it.each(["en", "es"])(
  "reads all training defaults for the verified account in %s",
  async (locale) => {
    const result = await getTrainingContext(locale);
    expect(result).toEqual({
      session: { user: { id: "verified", name: "Synthetic" } },
      profile: { trainingMode: "no-gi" },
      goals: [{ id: "own-goal" }],
      activeGoal: { id: "own-goal" },
    });
    for (const read of [boundary.profile, boundary.goals, boundary.focus])
      expect(read).toHaveBeenCalledExactlyOnceWith("verified");
  },
);
it("rejects an unsupported route locale before any private read", async () => {
  await expect(getTrainingContext("fr")).rejects.toBe(missingError);
  expect(boundary.session).not.toHaveBeenCalled();
});
it("redirects unauthenticated requests without reading private defaults", async () => {
  boundary.session.mockResolvedValue(null);
  await expect(getTrainingContext("es")).rejects.toBe(redirectError);
  expect(boundary.redirect).toHaveBeenCalledExactlyOnceWith({
    href: "/sign-in",
    locale: "es",
  });
  expect(boundary.profile).not.toHaveBeenCalled();
  expect(boundary.goals).not.toHaveBeenCalled();
  expect(boundary.focus).not.toHaveBeenCalled();
});
it("propagates verification errors before private reads", async () => {
  boundary.session.mockRejectedValue(new Error("auth failed"));
  await expect(getTrainingContext("en")).rejects.toThrow("auth failed");
  expect(boundary.goals).not.toHaveBeenCalled();
});
