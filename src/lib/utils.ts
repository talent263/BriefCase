import type { InvoiceStatus, MatterStatus, UserRole } from "@/types/models";

export function formatMoney(amount: number): string {
  return `US$ ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

export function formatDateTime(value: string): string {
  return formatDate(value, { hour: "2-digit", minute: "2-digit" });
}

export function todayInHarare(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dateKeyInHarare(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function matterStatusLabel(status: MatterStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function invoiceStatusClass(status: InvoiceStatus): string {
  if (status === "Paid") return "status status-paid";
  if (status === "Overdue") return "status status-overdue";
  return "status status-sent";
}
