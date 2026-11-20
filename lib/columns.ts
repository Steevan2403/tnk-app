export function columnStorageKey(userId: string, table: string): string {
  const user = userId.replace(/[^A-Za-z0-9_-]/g, "") || "user";
  const name = table.replace(/[^a-z0-9-]/g, "") || "list";
  return `tnk-columns:${user}:${name}`;
}

export function hiddenColumnIds(stored: string | null, allowed: string[]): string[] {
  if (!stored) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const known = new Set(allowed);
  return parsed.filter((id): id is string => typeof id === "string" && known.has(id));
}
