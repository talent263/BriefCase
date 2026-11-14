"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CalendarDays, ChevronLeft, ChevronRight, CirclePlus, Clock3, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ContentLoading, EmptyState, PageHeader, useGlobalSearch } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { ErrorBanner, FormField, Modal, SaveButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createRecord, deleteRecord, updateRecord } from "@/lib/workspace-repo";
import { formatDateTime, todayInHarare } from "@/lib/utils";
import { calendarSchema, eventTypes, type CalendarInput } from "@/lib/validation";
import type { CalendarEvent } from "@/types/models";

function harareDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Harare", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function inputDateTime(value?: string): string {
  if (!value) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Harare", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  }
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Harare", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function localHarareToIso(value: string): string {
  return new Date(`${value}:00+02:00`).toISOString();
}

function CalendarDialog({ event, close }: { event?: CalendarEvent; close: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm<CalendarInput>({ resolver: zodResolver(calendarSchema), defaultValues: event ? { title: event.title, location: event.location, clientName: event.clientName, eventTime: inputDateTime(event.eventTime), eventType: event.eventType } : { title: "", location: "High Court, Harare", clientName: "", eventTime: inputDateTime(), eventType: "Court hearing" } });

  async function submit(values: CalendarInput) {
    if (!user) return;
    const eventTime = localHarareToIso(values.eventTime);
    try {
      if (event) {
        await updateRecord("calendar", event.id, { ...values, eventTime });
        showToast("Calendar event updated");
      } else {
        await createRecord("calendar", { ...values, eventTime, firmId: user.firmId, createdAt: new Date().toISOString() });
        showToast("Calendar event added", "success", values.eventType);
      }
      close();
    } catch {
      setSaveError("The event could not be saved. Please try again.");
    }
  }

  return <Modal title={event ? "Edit calendar event" : "Add to the calendar"} eyebrow="Court and client dates" onClose={close}>
    <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
      {saveError ? <ErrorBanner>{saveError}</ErrorBanner> : null}
      <FormField label="Event title" htmlFor="event-title" error={form.formState.errors.title?.message}><input id="event-title" className="field-control" placeholder="e.g. Initial consultation" {...form.register("title")} /></FormField>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label="Event type" htmlFor="event-type" error={form.formState.errors.eventType?.message}><select id="event-type" className="field-control" {...form.register("eventType")}>{eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></FormField><FormField label="Date and time (Harare)" htmlFor="event-time" error={form.formState.errors.eventTime?.message}><input id="event-time" type="datetime-local" className="field-control" {...form.register("eventTime")} /></FormField></div>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label="Client" htmlFor="event-client" error={form.formState.errors.clientName?.message}><input id="event-client" className="field-control" placeholder="Client name" {...form.register("clientName")} /></FormField><FormField label="Location" htmlFor="event-location" error={form.formState.errors.location?.message}><input id="event-location" className="field-control" placeholder="High Court, Harare" {...form.register("location")} /></FormField></div>
      <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><SaveButton busy={form.formState.isSubmitting}>{event ? "Save changes" : <><Plus size={14} /> Add event</>}</SaveButton></div>
    </form>
  </Modal>;
}

export function CalendarView() {
  const { calendar } = useWorkspaceData();
  const { query } = useGlobalSearch();
  const { showToast } = useToast();
  const [cursor, setCursor] = useState(() => { const today = todayInHarare(); return new Date(`${today}T12:00:00`); });
  const [selectedDay, setSelectedDay] = useState(todayInHarare());
  const [dialog, setDialog] = useState<CalendarEvent | "new" | null>(null);
  const normalized = query.trim().toLowerCase();
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
  const monthLabel = new Intl.DateTimeFormat("en", { timeZone: "Africa/Harare", month: "long", year: "numeric" }).format(firstDay);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), 1 + index - ((firstDay.getDay() + 6) % 7), 12);
    return { date, key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, inMonth: date.getMonth() === cursor.getMonth() };
  });
  const filtered = calendar.items.filter((event) => `${event.title} ${event.location} ${event.clientName} ${event.eventType}`.toLowerCase().includes(normalized));
  const eventDaySet = useMemo(() => new Set(filtered.map((event) => harareDateKey(event.eventTime))), [filtered]);
  const selectedEvents = filtered.filter((event) => harareDateKey(event.eventTime) === selectedDay).sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  const monthEvents = filtered.filter((event) => harareDateKey(event.eventTime).startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`)).length;

  async function remove(event: CalendarEvent) {
    if (!window.confirm(`Delete “${event.title}” from the calendar?`)) return;
    try { await deleteRecord("calendar", event.id); showToast("Calendar event deleted"); }
    catch { showToast("Calendar event could not be deleted", "error"); }
  }

  function changeMonth(direction: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1, 12);
    setCursor(next);
    setSelectedDay(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  }

  if (calendar.loading) return <ContentLoading label="Loading calendar…" />;
  return <>
    <PageHeader eyebrow="Court and client dates" title="Calendar" description="Hearings, consultations and important dates, shown in Harare time." action={<button className="btn-primary" onClick={() => setDialog("new")}><CirclePlus size={15} /> Add event</button>} />
    {calendar.error ? <div className="mb-4"><ErrorBanner>{calendar.error}</ErrorBanner></div> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[1.3fr_.7fr]">
      <section className="panel p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><p className="panel-title">{monthLabel}</p><p className="mt-1 text-[10px] text-muted">{monthEvents} scheduled item{monthEvents === 1 ? "" : "s"}</p></div><div className="flex gap-1"><button className="icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={17} /></button><button className="icon-button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={17} /></button></div></div>
        <div className="grid grid-cols-7 text-center">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="pb-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#99a39e]">{day}</div>)}
          {cells.map((cell) => <button key={cell.key} onClick={() => setSelectedDay(cell.key)} className={`relative mx-auto mb-1 grid h-10 w-full max-w-[48px] place-items-center rounded-xl text-xs transition ${selectedDay === cell.key ? "bg-forest font-bold text-white" : cell.inMonth ? "text-ink hover:bg-paper" : "text-[#c2c9c4] hover:bg-paper"}`} aria-label={new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "Africa/Harare" }).format(cell.date)}><span>{cell.date.getDate()}</span>{eventDaySet.has(cell.key) ? <i className={`absolute bottom-[5px] h-1 w-1 rounded-full ${selectedDay === cell.key ? "bg-gold" : "bg-[#a8864e]"}`} /> : null}</button>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"><button className="text-[10px] font-semibold text-forest" onClick={() => { const today = todayInHarare(); setSelectedDay(today); setCursor(new Date(`${today.slice(0, 7)}-01T12:00:00`)); }}>Today</button><span className="inline-flex items-center gap-1.5 text-[9px] text-muted"><i className="h-1.5 w-1.5 rounded-full bg-[#a8864e]" />Has scheduled event</span></div>
      </section>
      <section className="panel min-h-[460px] p-5 sm:p-6">
        <div className="flex items-start justify-between"><div><p className="eyebrow">Selected day</p><p className="mt-1 font-display text-base font-bold">{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${selectedDay}T12:00:00`))}</p></div><span className="grid h-9 w-9 place-items-center rounded-lg bg-mist text-forest"><CalendarDays size={16} /></span></div>
        {selectedEvents.length === 0 ? <div className="grid min-h-[320px] place-items-center"><EmptyState title="Nothing scheduled" detail="Your hearings and consultations for this day will appear here." action={<button className="btn-secondary" onClick={() => setDialog("new")}><Plus size={13} /> Add event</button>} /></div> : <div className="mt-5 space-y-3">{selectedEvents.map((event) => <article key={event.id} className="rounded-xl border border-line p-3.5"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><span className="status status-review">{event.eventType}</span><p className="mt-2 text-xs font-bold text-ink">{event.title}</p><p className="mt-1 text-[10px] text-muted">{event.clientName}</p></div><div className="flex gap-0.5"><button className="icon-button" aria-label={`Edit ${event.title}`} onClick={() => setDialog(event)}><Pencil size={13} /></button><button className="icon-button !text-[#ad695d]" aria-label={`Delete ${event.title}`} onClick={() => void remove(event)}><Trash2 size={13} /></button></div></div><div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[10px] text-muted"><p className="flex items-center gap-1.5"><Clock3 size={12} />{formatDateTime(event.eventTime)} · Harare</p><p className="flex items-center gap-1.5"><MapPin size={12} />{event.location}</p></div></article>)}</div>}
      </section>
    </div>
    {dialog ? <CalendarDialog event={dialog === "new" ? undefined : dialog} close={() => setDialog(null)} /> : null}
  </>;
}
