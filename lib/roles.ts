export const ROLES = ["admin", "manager", "staff"] as const;

export type Role = (typeof ROLES)[number];

export function canManageBuildings(role: string): boolean {
  return role === "admin";
}

export function canAssignBuildings(role: string): boolean {
  return role === "admin";
}

export function canManageContractors(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canManageResidents(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canManageAssets(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canManageAssetCategories(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canEditCases(role: string): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canDeleteCases(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canManageCaseTypes(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canSendWorkOrders(role: string): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canEditWorkOrderTerms(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canCancelWorkOrders(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canViewOutbox(role: string): boolean {
  return role === "admin";
}

export function canManageMaintenance(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canRecordOccurrence(role: string): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canManageInspectionTemplates(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function canRunInspections(role: string): boolean {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canManageReports(role: string): boolean {
  return role === "admin" || role === "manager";
}

export function formatRole(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "staff") return "Staff";
  return role;
}
