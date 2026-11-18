export const ROLES = ["admin", "manager", "staff"] as const;

export type Role = (typeof ROLES)[number];

export function canManageBuildings(role: string): boolean {
  return role === "admin";
}

export function formatRole(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "staff") return "Staff";
  return role;
}
