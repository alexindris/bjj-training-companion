import { expect, test } from "vitest";
import { choose, classify, nested, optional, switchValue } from "./mapping";

test("execute deliberately partial and full paths for mapping verification", () => {
  expect(classify(1)).toBe("positive");
  expect(choose(1)).toBe("positive");
  expect(choose(0)).toBe("nonpositive");
  expect(nested(1)).toBe("present");
  expect(optional()).toBe(0);
  expect(optional({ count: 1 })).toBe(1);
  expect(switchValue(1)).toBe(11);
});
