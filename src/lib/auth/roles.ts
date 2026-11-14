import type { UserRole } from "@/types/models";

export function isUserRole(value: unknown): value is UserRole {
  return value === "administrator" || value === "partner" || value === "associate";
}

export function isManagementRole(role: UserRole): boolean {
  return role === "administrator" || role === "partner";
}
