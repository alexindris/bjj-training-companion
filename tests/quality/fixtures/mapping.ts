export function classify(value: number): string {
  if (value > 0) return "positive";
  return "nonpositive";
}

export const choose = (value: number): string =>
  value > 0 ? "positive" : "nonpositive";

export function nested(value: number): string {
  const describe = (candidate: number) => (candidate ? "present" : "absent");
  return describe(value);
}

export const unused = (): string => "unexecuted";

export function optional(value: { count?: number } = {}): number {
  return value?.count ?? 0;
}

export function switchValue(value: number): number {
  switch (value) {
    case 1:
      return 11;
    case 2:
      return 22;
    default:
      return 0;
  }
}
