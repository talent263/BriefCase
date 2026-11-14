"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Check, Circle, CirclePlus, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ContentLoading, EmptyState, PageHeader, useGlobalSearch } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { ErrorBanner, FormField, Modal, SaveButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createRecord, deleteRecord, updateRecord } from "@/lib/workspace-repo";
import { formatDate, todayInHarare } from "@/lib/utils";
import { taskSchema, type TaskInput } from "@/lib/validation";
import type { Task } from "@/types/models";

function TaskDialog({ close }: { close: () => void }) {
  const { user } = useAuth();
  const { matters, team } = useWorkspaceData();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm<TaskInput>({ resolver: zodResolver(taskSchema), defaultValues: { title: "", matterId: matters.items[0]?.id ?? "", assignedTo: user?.displayName ?? "", dueDate: todayInHarare() } });

  async function submit(values: TaskInput) {
    if (!user) return;
    const matter = matters.items.find((item) => item.id === values.matterId);
    if (!matter) { setSaveError("Choose a matter for this task."); return; }
    try {
      await createRecord("tasks", { ...values, matterNumber: matter.matterNumber, completed: false, firmId: user.firmId, createdAt: new Date().toISOString() });
      showToast("Task added", "success", matter.matterNumber);
      close();
    } catch {
      setSaveError("The task could not be saved. Please try again.");
    }
  }

  return <Modal title="Add a task" eyebrow="Work planning" onClose={close}>
    {matters.items.length === 0 ? <><p className="text-xs leading-5 text-muted">Add a matter before creating a task linked to its work.</p><div className="mt-5 flex justify-end"><button className="btn-secondary" onClick={close}>Close</button></div></> : <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
      {saveError ? <ErrorBanner>{saveError}</ErrorBanner> : null}
      <FormField label="Task" htmlFor="task-title" error={form.formState.errors.title?.message}><input id="task-title" className="field-control" placeholder="e.g. Prepare court bundle" {...form.register("title")} /></FormField>
      <FormField label="Matter" htmlFor="task-matter" error={form.formState.errors.matterId?.message}><select id="task-matter" className="field-control" {...form.register("matterId")}>{matters.items.map((matter) => <option key={matter.id} value={matter.id}>{matter.matterNumber} · {matter.matterName}</option>)}</select></FormField>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label="Assigned to" htmlFor="task-assignee" error={form.formState.errors.assignedTo?.message}><input id="task-assignee" list="task-team-options" className="field-control" {...form.register("assignedTo")} /><datalist id="task-team-options">{team.items.map((member) => <option key={member.id} value={member.displayName} />)}</datalist></FormField><FormField label="Due date" htmlFor="task-due" error={form.formState.errors.dueDate?.message}><input id="task-due" type="date" className="field-control" {...form.register("dueDate")} /></FormField></div>
      <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><SaveButton busy={form.formState.isSubmitting}><Plus size={14} /> Add task</SaveButton></div>
    </form>}
  </Modal>;
}

export function TasksView() {
  const { tasks } = useWorkspaceData();
  const { query } = useGlobalSearch();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => tasks.items.filter((task) => (showCompleted || !task.completed) && `${task.title} ${task.matterNumber} ${task.assignedTo}`.toLowerCase().includes(normalized)).sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate)), [tasks.items, showCompleted, normalized]);

  async function toggle(task: Task) {
    try { await updateRecord("tasks", task.id, { completed: !task.completed }); showToast(task.completed ? "Task reopened" : "Task completed"); }
    catch { showToast("Task could not be updated", "error"); }
  }

  async function remove(task: Task) {
    if (!window.confirm(`Delete the task “${task.title}”?`)) return;
    try { await deleteRecord("tasks", task.id); showToast("Task deleted"); }
    catch { showToast("Task could not be deleted", "error"); }
  }

  if (tasks.loading) return <ContentLoading label="Loading task list…" />;
  return <>
    <PageHeader eyebrow="Work planning" title="Tasks" description="Keep the next action visible and share progress across your team." action={<button className="btn-primary" onClick={() => setDialog(true)}><CirclePlus size={15} /> Add task</button>} />
    {tasks.error ? <div className="mb-4"><ErrorBanner>{tasks.error}</ErrorBanner></div> : null}
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6"><div><p className="panel-title">Task list</p><p className="mt-1 text-[10px] text-muted">{tasks.items.filter((task) => !task.completed).length} outstanding · {tasks.items.filter((task) => task.completed).length} completed</p></div><label className="flex items-center gap-2 text-[10px] font-medium text-muted"><input type="checkbox" className="rounded border-[#cbd1c9] text-forest focus:ring-forest" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Show completed</label></div>
      {visible.length === 0 ? <EmptyState title={query ? "No matching tasks" : "No tasks on your list"} detail={query ? "Try a different search term." : "Add a task and link it to a matter to get started."} action={!query ? <button className="btn-primary" onClick={() => setDialog(true)}><Plus size={14} /> Add a task</button> : undefined} /> : <div className="divide-y divide-line px-5 sm:px-6">{visible.map((task) => <article key={task.id} className="flex items-start gap-3 py-4 first:pt-4">
        <button onClick={() => void toggle(task)} className={`mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border transition ${task.completed ? "border-forest bg-forest text-white" : "border-[#cbd1c9] text-transparent hover:border-forest"}`} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>{task.completed ? <Check size={12} /> : <Circle size={14} />}</button>
        <div className="min-w-0 flex-1"><p className={`text-xs font-semibold ${task.completed ? "text-muted line-through" : "text-ink"}`}>{task.title}</p><p className="mt-1.5 text-[10px] text-muted">{task.matterNumber} <span className="mx-1 text-[#c4cbc6]">·</span> Assigned to {task.assignedTo}</p></div>
        <div className="flex items-center gap-3"><span className="whitespace-nowrap text-[10px] text-muted">Due {formatDate(task.dueDate)}</span><span className={`status ${task.completed ? "status-paid" : "status-review"}`}>{task.completed ? "Done" : "Pending"}</span><button className="icon-button !text-[#ad695d]" aria-label={`Delete ${task.title}`} onClick={() => void remove(task)}><Trash2 size={14} /></button></div>
      </article>)}</div>}
    </section>
    {dialog ? <TaskDialog close={() => setDialog(false)} /> : null}
  </>;
}
