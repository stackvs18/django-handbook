// A small line-based diff (longest common subsequence), enough for the
// playground's "what changed" views of source files and responses.

export type DiffLine = { type: "same" | "add" | "del"; text: string; a?: number; b?: number };
export type Hunk = { header: string; lines: DiffLine[] };

const MAX_CELLS = 4_000_000;

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");

  // Trim the common head and tail first: most edits are small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const head: DiffLine[] = a.slice(0, start).map((text, i) => ({ type: "same", text, a: i + 1, b: i + 1 }));
  const tail: DiffLine[] = a.slice(endA).map((text, i) => ({
    type: "same",
    text,
    a: endA + i + 1,
    b: endB + i + 1,
  }));

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  const middle: DiffLine[] = [];

  if (n * m > MAX_CELLS) {
    midA.forEach((text, i) => middle.push({ type: "del", text, a: start + i + 1 }));
    midB.forEach((text, j) => middle.push({ type: "add", text, b: start + j + 1 }));
  } else {
    // lcs[i][j] = LCS length of midA[i:] and midB[j:]
    const width = m + 1;
    const lcs = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * width + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * width + j + 1] + 1
            : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        middle.push({ type: "same", text: midA[i], a: start + i + 1, b: start + j + 1 });
        i++;
        j++;
      } else if (j < m && (i >= n || lcs[i * width + j + 1] >= lcs[(i + 1) * width + j])) {
        middle.push({ type: "add", text: midB[j], b: start + j + 1 });
        j++;
      } else {
        middle.push({ type: "del", text: midA[i], a: start + i + 1 });
        i++;
      }
    }
  }

  return [...head, ...middle, ...tail];
}

/** Group a diff into hunks with `context` unchanged lines around each change. */
export function toHunks(lines: DiffLine[], context = 3): Hunk[] {
  const changed = lines.map((l) => l.type !== "same");
  if (!changed.some(Boolean)) return [];

  const keep = new Array(lines.length).fill(false);
  changed.forEach((isChange, idx) => {
    if (!isChange) return;
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true;
  });

  const hunks: Hunk[] = [];
  let current: DiffLine[] | null = null;
  lines.forEach((line, idx) => {
    if (keep[idx]) {
      current ??= [];
      current.push(line);
    } else if (current) {
      hunks.push(makeHunk(current));
      current = null;
    }
  });
  if (current) hunks.push(makeHunk(current));
  return hunks;
}

function makeHunk(lines: DiffLine[]): Hunk {
  const firstA = lines.find((l) => l.a !== undefined)?.a ?? 0;
  const firstB = lines.find((l) => l.b !== undefined)?.b ?? 0;
  const countA = lines.filter((l) => l.type !== "add").length;
  const countB = lines.filter((l) => l.type !== "del").length;
  return { header: `@@ -${firstA},${countA} +${firstB},${countB} @@`, lines };
}

export function diffStats(lines: DiffLine[]) {
  return {
    added: lines.filter((l) => l.type === "add").length,
    removed: lines.filter((l) => l.type === "del").length,
  };
}
