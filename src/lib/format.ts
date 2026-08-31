const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

const round = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

/** Human-readable byte size: B / KB / MB / GB. The one canonical formatter. */
export function humanBytes(n: number): string {
  if (n < KB) return `${n} B`;
  if (n < MB) return `${round(n / KB)} KB`;
  if (n < GB) return `${round(n / MB)} MB`;
  return `${round(n / GB)} GB`;
}
