/**
 * Parse a single-range HTTP Range header ("bytes=0-99", "bytes=100-", "bytes=-500").
 * Returns inclusive [start, end], null when there is no usable header (serve the whole file),
 * or "unsatisfiable" when the range falls outside the file (respond 416).
 * Multi-range requests are treated as no header; browsers don't send them for media.
 */
export function parseRange(header: string | null, size: number): [number, number] | null | "unsatisfiable" {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (match[1] === "" && match[2] === "")) return null;

  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }

  if (start >= size || start > end) return "unsatisfiable";
  return [start, end];
}
