import { decodeGitText } from "./git-text.ts";
export const historyBlobRequestLimit = 32;
export const historyBlobInputLimit = 8192;
type ExecuteGit = (args: readonly string[], input: string) => Buffer;

const outputLimit = 2 * 1024 * 1024;
const retainedTextLimit = 4 * 1024 * 1024;
const requestPattern = /^([a-f0-9]{40}):docs\/adr\/([0-9]{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
const invalidResponse = () => new Error("ADR history blob response is invalid");

function query(requests: readonly string[]): string {
  const input =
    requests.map((request) => `${request.slice(0, 40)}^{commit}${request.slice(40)}`).join("\n") +
    "\n";
  if (Buffer.byteLength(input, "utf8") > historyBlobInputLimit) {
    throw new Error("Invalid ADR history blob request");
  }
  return input;
}

/** Read only admitted immutable blobs; callers retain individual show for absent keys. */
export function readHistoryBlobs(
  requests: readonly string[],
  execute: ExecuteGit,
): ReadonlyMap<string, string> {
  if (
    requests.length > historyBlobRequestLimit ||
    requests.some((request) => {
      const match = typeof request === "string" ? requestPattern.exec(request) : null;
      return match?.[0] !== request || /\p{Cc}/u.test(request) || Number(match[2]) === 0;
    })
  ) {
    throw new Error("Invalid ADR history blob request");
  }
  const unique = [...new Set(requests)];
  const sources = new Map<string, string>();
  if (!unique.length) {
    return sources;
  }
  const metadata = execute(["cat-file", "--batch-check"], query(unique));
  if (metadata.length > outputLimit || !metadata.length || metadata.at(-1) !== 10) {
    throw invalidResponse();
  }
  const lines = decodeGitText(metadata).slice(0, -1).split("\n");
  if (lines.length !== unique.length) {
    throw invalidResponse();
  }
  const selected: { request: string; header: Buffer; size: number }[] = [];
  let outputBytes = 0;
  let retainedTextBytes = 0;
  for (const [index, line] of lines.entries()) {
    const match = /^[a-f0-9]{40} blob (0|[1-9][0-9]*)$/u.exec(line);
    const size = Number(match?.[1]);
    const request = unique[index];
    if (match?.[0] !== line || !Number.isSafeInteger(size) || request === undefined) {
      throw invalidResponse();
    }
    const header = Buffer.from(line + "\n", "ascii");
    const framedBytes = header.length + size + 1;
    const textBytes = 2 * (request.length + size);
    if (
      framedBytes > outputLimit - outputBytes ||
      textBytes > retainedTextLimit - retainedTextBytes
    ) {
      continue;
    }
    selected.push({ request, header, size });
    outputBytes += framedBytes;
    retainedTextBytes += textBytes;
  }
  if (!selected.length) {
    return sources;
  }
  const response = execute(["cat-file", "--batch"], query(selected.map((item) => item.request)));
  if (response.length !== outputBytes) {
    throw invalidResponse();
  }
  let offset = 0;
  for (const { request, header, size } of selected) {
    if (!response.subarray(offset, offset + header.length).equals(header)) {
      throw invalidResponse();
    }
    offset += header.length;
    const end = offset + size;
    if (response.at(end) !== 10) {
      throw invalidResponse();
    }
    // Validate byte framing before the shared fatal, BOM-preserving Git text decoding.
    sources.set(request, decodeGitText(response.subarray(offset, end)));
    offset = end + 1;
  }
  if (offset !== response.length) {
    throw invalidResponse();
  }
  return sources;
}
