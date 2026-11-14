import { z } from "zod";

export const practiceAreas = [
  "Corporate",
  "Conveyancing",
  "Labour",
  "Family law",
  "Private client",
  "Litigation",
] as const;

export const matterStatuses = ["open", "review", "waiting"] as const;
export const userRoles = ["administrator", "partner", "associate"] as const;
export const invoiceStatuses = ["Sent", "Overdue", "Paid"] as const;
export const eventTypes = ["Court hearing", "Consultation", "Filing deadline", "Meeting"] as const;

const requiredText = (label: string, max = 180) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const matterSchema = z.object({
  matterName: requiredText("Matter name"),
  clientName: requiredText("Client"),
  practiceArea: z.enum(practiceAreas),
  status: z.enum(matterStatuses),
  nextDate: z.string().min(1, "Next date is required"),
});

export const clientSchema = z.object({
  name: requiredText("Client name"),
  type: z.enum(["Individual", "Company"]),
  email: z.string().trim().email("Enter a valid email address").max(180),
  phone: requiredText("Phone number", 40),
  address: requiredText("Address", 240),
});

export const taskSchema = z.object({
  title: requiredText("Task title"),
  matterId: requiredText("Matter"),
  assignedTo: requiredText("Assignee"),
  dueDate: z.string().min(1, "Due date is required"),
});

export const calendarSchema = z.object({
  title: requiredText("Event title"),
  location: requiredText("Location"),
  clientName: requiredText("Client"),
  eventTime: z.string().min(1, "Date and time are required"),
  eventType: z.enum(eventTypes),
});

export const invoiceSchema = z.object({
  matterId: requiredText("Matter"),
  amount: z.number().positive("Amount must be greater than zero").max(10_000_000),
  status: z.enum(invoiceStatuses),
  dueDate: z.string().min(1, "Due date is required"),
});

export const firmSchema = z.object({
  name: requiredText("Firm name"),
  address: requiredText("Address", 240),
  phone: requiredText("Phone number", 40),
  email: z.string().trim().email("Enter a valid email address").max(180),
});

export const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(180),
  role: z.enum(userRoles),
});

export type MatterInput = z.infer<typeof matterSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type CalendarInput = z.infer<typeof calendarSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type FirmInput = z.infer<typeof firmSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
