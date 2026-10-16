export interface BuildResult {
  candidate: string;
  iteration: number;
  executable: string;
  companions: string[];
  unsignedHash: string;
  signedHash: string;
  buildMs: number;
}
export const runtimes: { node: string; bun: string; extension: string };
export function buildCandidate(candidate: string, iteration?: number): Promise<BuildResult>;
