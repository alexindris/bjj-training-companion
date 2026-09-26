type Location = {
  start: { line: number; column: number };
  end: { line: number; column: number };
};
type Mutant = {
  status: string;
  mutatorName: string;
  replacement: string;
  location: Location;
};
export type MutationReport = {
  files: Record<string, { source: string; mutants: Mutant[] }>;
};
type Equivalent = {
  file: string;
  mutator: string;
  location: Location;
  original: string;
  replacement: string;
  reason: string;
};
export const repository: string;
export function mutationFingerprint(): string;
export function reportHash(content: string | Uint8Array): string;
export function auditMutationReport(
  report: MutationReport,
  equivalents: Equivalent[],
): Record<string, number>;
export function auditCurrentMutationReport(): Record<string, number>;
