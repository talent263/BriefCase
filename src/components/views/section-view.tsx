"use client";

import { BillingView } from "@/components/views/billing";
import { CalendarView } from "@/components/views/calendar";
import { ClientsView } from "@/components/views/clients";
import { DocumentsView } from "@/components/views/documents";
import { MattersView } from "@/components/views/matters";
import { TasksView } from "@/components/views/tasks";
import { TeamView } from "@/components/views/team";

export function SectionView({ section }: { section: string }) {
  switch (section) {
    case "matters": return <MattersView />;
    case "clients": return <ClientsView />;
    case "calendar": return <CalendarView />;
    case "tasks": return <TasksView />;
    case "documents": return <DocumentsView />;
    case "billing": return <BillingView />;
    case "team": return <TeamView />;
    default: return null;
  }
}
