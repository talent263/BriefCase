export type UserRole = "administrator" | "partner" | "associate";
export type MatterStatus = "open" | "review" | "waiting";
export type PracticeArea =
  | "Corporate"
  | "Conveyancing"
  | "Labour"
  | "Family law"
  | "Private client"
  | "Litigation";
export type ClientType = "Individual" | "Company";
export type InvoiceStatus = "Sent" | "Overdue" | "Paid";
export type EventType = "Court hearing" | "Consultation" | "Filing deadline" | "Meeting";

export interface WorkspaceUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  firmId: string;
  role: UserRole;
}

export interface Matter {
  id: string;
  matterNumber: string;
  matterName: string;
  clientName: string;
  practiceArea: PracticeArea;
  status: MatterStatus;
  nextDate: string;
  firmId: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  email: string;
  phone: string;
  address: string;
  firmId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  matterId: string;
  matterNumber: string;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
  firmId: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  matterId: string;
  clientName: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  firmId: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  clientName: string;
  eventTime: string;
  eventType: EventType;
  firmId: string;
  createdAt: string;
}

export interface MatterDocument {
  id: string;
  fileName: string;
  matterId: string;
  matterNumber: string;
  storagePath: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  firmId: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: UserRole;
  status: "active" | "invited";
  firmId: string;
  createdAt: string;
}

export interface FirmProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  firmId: string;
}

export interface CollectionState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}
