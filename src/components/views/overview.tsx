"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Banknote, BriefcaseBusiness, Check, CheckSquare, ChevronRight, CircleDollarSign, Plus, UsersRound } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ContentLoading, EmptyState } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { useToast } from "@/components/toast";
import { updateRecord } from "@/lib/workspace-repo";
import { dateKeyInHarare, formatDate, formatMoney, todayInHarare } from "@/lib/utils";
import type { CalendarEvent, Invoice, Matter, Task } from "@/types/models";

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Harare", hour: "numeric", hour12: false }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function MonthBars({ invoices }: { invoices: Invoice[] }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const matching = invoices.filter((invoice) => invoice.createdAt.startsWith(key));
      return {
        label: new Intl.DateTimeFormat("en", { month: "short", timeZone: "Africa/Harare" }).format(date),
        total: matching.reduce((sum, invoice) => sum + invoice.amount, 0),
        collected: matching.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + invoice.amount, 0),
        key,
      };
    });
  }, [invoices]);
  const max = Math.max(1, ...months.map((month) => month.total));
  return <div className="flex h-[174px] items-end justify-between gap-3 px-1 pt-3">
    {months.map((month, index) => {
      const totalHeight = month.total ? Math.max(10, (month.total / max) * 125) : 5;
      const collectedHeight = month.total ? Math.min(totalHeight, Math.max(month.collected ? 8 : 0, (month.collected / max) * 125)) : 0;
      return <div className="flex h-full flex-1 flex-col items-center justify-end gap-2" key={month.key}>
        <div className="flex h-[130px] w-full max-w-[38px] items-end rounded-t-md bg-[#f2f3ee]">
          <div className="relative flex w-full flex-col justify-end" style={{ height: `${totalHeight}px` }}>
            <div className={`chart-bar ${index === 5 ? "chart-bar-current" : ""} h-full w-full opacity-70`} />
            {collectedHeight > 0 ? <div className="absolute bottom-0 left-0 right-0 rounded-t-[4px] bg-[#d7b981]" style={{ height: `${collectedHeight}px` }} /> : null}
          </div>
        </div>
        <span className="text-[9px] font-medium text-muted">{month.label}</span>
      </div>;
    })}
  </div>;
}

export function OverviewPage() {
  const { user } = useAuth();
  const { matters, clients, tasks, invoices, calendar } = useWorkspaceData();
  const { showToast } = useToast();
  const busy = matters.loading && clients.loading && tasks.loading && invoices.loading;
  const openMatters = matters.items.filter((matter) => matter.status === "open").length;
  const paidTotal = invoices.items.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const outstanding = invoices.items.filter((invoice) => invoice.status !== "Paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const today = todayInHarare();
  const dueTasks = [...tasks.items].filter((task) => !task.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const upcomingEvents = [...calendar.items].filter((event) => dateKeyInHarare(event.eventTime) >= today).sort((a, b) => a.eventTime.localeCompare(b.eventTime)).slice(0, 4);
  const recentMatters = [...matters.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  async function toggleTask(task: Task) {
    try {
      await updateRecord("tasks", task.id, { completed: true });
      showToast("Task completed", "success", task.title);
    } catch {
      showToast("Task could not be updated", "error");
    }
  }

  if (busy) return <ContentLoading label="Preparing your overview…" />;
  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p><h1 className="page-title mt-2">{greeting()}, {user?.displayName.split(" ")[0]}.</h1><p className="mt-2 text-xs text-muted">Here is what is moving across your practice today.</p></div>
      <div className="flex gap-2"><Link href="/dashboard/tasks" className="btn-secondary"><CheckSquare size={14} /> Add a task</Link><Link href="/dashboard/matters" className="btn-primary"><Plus size={14} /> New matter</Link></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="Open matters" value={String(openMatters)} caption={`${matters.items.length} total in the register`} icon={<BriefcaseBusiness size={17} />} tint="forest" />
      <StatCard title="Active clients" value={String(clients.items.length)} caption="In your client directory" icon={<UsersRound size={17} />} tint="gold" />
      <StatCard title="Collected" value={formatMoney(paidTotal)} caption={`${invoices.items.filter((item) => item.status === "Paid").length} invoices paid`} icon={<CircleDollarSign size={17} />} tint="green" />
      <StatCard title="Outstanding" value={formatMoney(outstanding)} caption={`${invoices.items.filter((item) => item.status !== "Paid").length} invoices awaiting payment`} icon={<Banknote size={17} />} tint="sand" />
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.32fr_.88fr]">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="panel-title">Billing activity</p><p className="mt-1 text-[10px] text-muted">Invoices issued over the past six months</p></div><div className="flex items-center gap-3 text-[9px] text-muted"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#b7c9bc]" />Billed</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-gold" />Collected</span></div></div>
        {invoices.items.length ? <MonthBars invoices={invoices.items} /> : <div className="grid h-[174px] place-items-center text-center"><p className="text-xs text-muted">Your billing activity will appear here as invoices are added.</p></div>}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-3"><span className="text-[10px] text-muted">Total billed</span><span className="text-xs font-bold text-ink">{formatMoney(invoices.items.reduce((sum, invoice) => sum + invoice.amount, 0))}</span><Link href="/dashboard/billing" className="inline-flex items-center gap-1 text-[10px] font-bold text-forest">View billing <ArrowRight size={12} /></Link></div>
      </section>
      <section className="panel p-5 sm:p-6">
        <div className="flex items-start justify-between"><div><p className="panel-title">Upcoming dates</p><p className="mt-1 text-[10px] text-muted">Hearings and client commitments</p></div><Link href="/dashboard/calendar" className="icon-button -mr-2 -mt-1" aria-label="Open calendar"><ArrowRight size={15} /></Link></div>
        {upcomingEvents.length ? <div className="mt-4 divide-y divide-line">{upcomingEvents.map((event: CalendarEvent) => <div className="flex gap-3 py-3 first:pt-1 last:pb-0" key={event.id}><div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-paper py-1.5"><span className="text-[8px] font-bold uppercase text-[#9a8560]">{new Intl.DateTimeFormat("en", { timeZone: "Africa/Harare", month: "short" }).format(new Date(event.eventTime))}</span><span className="mt-0.5 font-display text-base font-bold">{new Intl.DateTimeFormat("en", { timeZone: "Africa/Harare", day: "numeric" }).format(new Date(event.eventTime))}</span></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-ink">{event.title}</p><p className="mt-1 truncate text-[10px] text-muted">{event.eventType} · {event.location}</p></div><span className="mt-0.5 text-[9px] text-muted">{new Intl.DateTimeFormat("en", { timeZone: "Africa/Harare", hour: "2-digit", minute: "2-digit" }).format(new Date(event.eventTime))}</span></div>)}</div> : <div className="grid h-[150px] place-items-center text-center"><p className="max-w-[210px] text-xs leading-5 text-muted">No hearings or consultations scheduled yet.<br /><Link className="mt-1 inline-block font-semibold text-forest" href="/dashboard/calendar">Add a calendar event</Link></p></div>}
      </section>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.32fr_.88fr]">
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 sm:px-6"><div><p className="panel-title">Recent matters</p><p className="mt-1 text-[10px] text-muted">Your latest matters and next steps</p></div><Link href="/dashboard/matters" className="inline-flex items-center gap-1 text-[10px] font-bold text-forest">All matters <ChevronRight size={13} /></Link></div>
        {recentMatters.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Matter</th><th>Client</th><th>Status</th><th>Next date</th></tr></thead><tbody>{recentMatters.map((matter: Matter) => <tr key={matter.id}><td><span className="table-primary">{matter.matterName}</span><span className="table-secondary">{matter.matterNumber}</span></td><td className="!text-ink">{matter.clientName}</td><td><span className={`status status-${matter.status}`}>{matter.status}</span></td><td>{formatDate(matter.nextDate)}</td></tr>)}</tbody></table></div> : <EmptyState title="No matters yet" detail="Add a matter to see your current work here." action={<Link className="btn-primary" href="/dashboard/matters"><Plus size={14} /> Create a matter</Link>} />}
      </section>
      <section className="panel p-5 sm:p-6">
        <div className="flex items-start justify-between"><div><p className="panel-title">My task list</p><p className="mt-1 text-[10px] text-muted">{dueTasks.length} tasks need your attention</p></div><Link href="/dashboard/tasks" className="icon-button -mr-2 -mt-1" aria-label="Open tasks"><ArrowRight size={15} /></Link></div>
        {dueTasks.length ? <div className="mt-3 divide-y divide-line">{dueTasks.map((task: Task) => <div className="flex items-start gap-2.5 py-3 first:pt-2 last:pb-0" key={task.id}><button className="mt-0.5 grid h-[17px] w-[17px] shrink-0 place-items-center rounded border border-[#cbd1c9] text-white transition hover:border-forest hover:bg-forest" onClick={() => void toggleTask(task)} aria-label={`Complete ${task.title}`}><Check size={11} /></button><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold leading-4 text-ink">{task.title}</p><p className="mt-1 truncate text-[9px] text-muted">{task.matterNumber} · {task.assignedTo}</p></div><span className="mt-0.5 whitespace-nowrap text-[9px] text-muted">{formatDate(task.dueDate, { day: "numeric", month: "short" })}</span></div>)}</div> : <div className="grid h-[145px] place-items-center"><div className="text-center"><div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-mist text-forest"><CheckSquare size={16} /></div><p className="mt-2 text-xs font-semibold">A clear list</p><p className="mt-1 text-[10px] text-muted">Tasks due soon will show up here.</p></div></div>}
      </section>
    </div>
  </>;
}

function StatCard({ title, value, caption, icon, tint }: { title: string; value: string; caption: string; icon: ReactNode; tint: "forest" | "gold" | "green" | "sand" }) {
  const colors = { forest: "text-forest bg-mist", gold: "text-[#a17e43] bg-[#f8f2e7]", green: "text-[#51795b] bg-[#edf4ed]", sand: "text-[#a36d42] bg-[#f8f0e7]" };
  return <article className="stat-card"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold text-muted">{title}</p><p className="stat-value mt-2">{value}</p></div><span className={`stat-icon ${colors[tint]}`}>{icon}</span></div><p className="stat-caption mt-3">{caption}</p></article>;
}
