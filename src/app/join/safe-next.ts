/** Only ever send people to a page on this site. */
export function safeNext(raw: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/shop";
}
