"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CalendarDays, ChevronDown, CirclePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ContentLoading, EmptyState, PageHeader, useGlobalSearch } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { ErrorBanner, FormField, Modal, SaveButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createMatterRecord, deleteRecord, updateRecord } from "@/lib/workspace-repo";
import { formatDate, matterStatusLabel, todayInHarare } from "@/lib/utils";
import { matterSchema, matterStatuses, practiceAreas, type MatterInput } from "@/lib/validation";
import type { Client, Matter, MatterStatus } from "@/types/models";

interface MatterDialogProps {
  matter?: Matter;
  clients: Client[];
  matters: Matter[];
  onClose: () => void;
  onSaved: (matter: Matter) => void;
  onOptimistic: (matter: Matter) => void;
  onRollback: (id: string) => void;
}

function MatterDialog({ matter, clients, matters, onClose, onSaved, onOptimistic, onRollback }: MatterDialogProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm<MatterInput>({
    resolver: zodResolver(matterSchema),
    defaultValues: matter ? {
      matterName: matter.matterName,
      clientName: matter.clientName,
      practiceArea: matter.practiceArea,
      status: matter.status,
      nextDate: matter.nextDate,
    } : { matterName: "", clientName: "", practiceArea: "Litigation", status: "open", nextDate: todayInHarare() },
  });

  async function submit(values: MatterInput) {
    if (!user) return;
    setSaveError(null);
    const now = new Date().toISOString();
    if (matter) {
      try {
        await updateRecord("matters", matter.id, {
          matterName: values.matterName,
          clientName: values.clientName,
          practiceArea: values.practiceArea,
          status: values.status,
          nextDate: values.nextDate,
        });
        showToast("Matter updated");
        onClose();
      } catch {
        setSaveError("The matter could not be updated. Check your connection and try again.");
      }
      return;
    }

    const optimisticId = `pending-${Date.now()}`;
    const year = new Date().getFullYear();
    const current = matters.reduce((max, item) => {
      const candidate = Number(item.matterNumber.split("-").at(-1));
      return Number.isFinite(candidate) ? Math.max(max, candidate) : max;
    }, 0);
    const optimisticMatter: Matter = {
      id: optimisticId,
      matterNumber: `EST-${year}-${String(current + 1).padStart(3, "0")}`,
      ...values,
      firmId: user.firmId,
      createdAt: now,
    };
    onOptimistic(optimisticMatter);

    try {
      const nextMatter = await createMatterRecord(user.firmId, values, matters);
      onRollback(optimisticId);
      onSaved({ ...optimisticMatter, id: nextMatter.id, matterNumber: nextMatter.matterNumber });
      showToast("Matter created", "success", nextMatter.matterNumber);
      onClose();
    } catch {
      onRollback(optimisticId);
      setSaveError("The matter could not be saved. Check your connection and try again.");
    }
  }

  return (
    <Modal title={matter ? "Edit matter" : "Create a matter"} eyebrow="Matter register" onClose={onClose}>
      <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
        {saveError ? <ErrorBanner>{saveError}</ErrorBanner> : null}
        <FormField label="Matter name" htmlFor="matterName" error={form.formState.errors.matterName?.message}><input id="matterName" className="field-control" placeholder="e.g. Moyo v City of Harare" {...form.register("matterName")} /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Client" htmlFor="clientName" error={form.formState.errors.clientName?.message}><input id="clientName" className="field-control" list="matter-client-options" placeholder="Select or enter a client" {...form.register("clientName")} /><datalist id="matter-client-options">{clients.map((client) => <option key={client.id} value={client.name} />)}</datalist></FormField>
          <FormField label="Practice area" htmlFor="practiceArea" error={form.formState.errors.practiceArea?.message}><select id="practiceArea" className="field-control" {...form.register("practiceArea")}>{practiceAreas.map((area) => <option key={area} value={area}>{area}</option>)}</select></FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Status" htmlFor="status" error={form.formState.errors.status?.message}><select id="status" className="field-control" {...form.register("status")}>{matterStatuses.map((status) => <option key={status} value={status}>{matterStatusLabel(status)}</option>)}</select></FormField>
          <FormField label="Next date" htmlFor="nextDate" error={form.formState.errors.nextDate?.message}><input id="nextDate" type="date" className="field-control" {...form.register("nextDate")} /></FormField>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><SaveButton busy={form.formState.isSubmitting}>{matter ? "Save changes" : <><Plus size={14} /> Create matter</>}</SaveButton></div>
      </form>
    </Modal>
  );
}

export function MattersView() {
  const { matters, clients } = useWorkspaceData();
  const { query } = useGlobalSearch();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState<Matter | null | "new">(null);
  const [optimistic, setOptimistic] = useState<Matter[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | MatterStatus>("all");
  const allMatters = useMemo(() => [...optimistic, ...matters.items].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index), [optimistic, matters.items]);
  const visible = allMatters.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const value = `${item.matterNumber} ${item.matterName} ${item.clientName} ${item.practiceArea} ${item.status}`.toLowerCase();
    return matchesStatus && value.includes(query.trim().toLowerCase());
  });

  async function removeMatter(item: Matter) {
    if (!window.confirm(`Delete ${item.matterNumber} — ${item.matterName}?`)) return;
    try {
      await deleteRecord("matters", item.id);
      showToast("Matter deleted");
    } catch {
      showToast("Matter could not be deleted", "error");
    }
  }

  if (matters.loading) return <ContentLoading label="Loading matter register…" />;
  return (
    <>
      <PageHeader eyebrow="Case management" title="Matters" description="A clear view of active work, upcoming dates and the people you represent." action={<button className="btn-primary" onClick={() => setDialog("new")}><CirclePlus size={15} /> New matter</button>} />
      {matters.error ? <div className="mb-4"><ErrorBanner>{matters.error}</ErrorBanner></div> : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-muted"><span className="font-semibold text-ink">{visible.length}</span> matters <span className="mx-1 h-3 w-px bg-line" /> <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#749579]" />{allMatters.filter((item) => item.status === "open").length} open</span></div>
        <label className="relative"><span className="sr-only">Filter by status</span><select className="field-control !h-[36px] !min-h-[36px] !w-[142px] appearance-none !pr-8 text-[10px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | MatterStatus)}><option value="all">All statuses</option>{matterStatuses.map((status) => <option key={status} value={status}>{matterStatusLabel(status)}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" /></label>
      </div>
      <section className="panel overflow-hidden">
        {matters.error && allMatters.length === 0 ? <EmptyState title="Matter register unavailable" detail="Check your Firebase connection and workspace permissions." /> : visible.length === 0 ? <EmptyState title={query ? "No matching matters" : "Your matter register is ready"} detail={query ? "Try another search or clear your filters." : "Create your first matter to begin tracking client work and upcoming dates."} action={!query ? <button className="btn-primary" onClick={() => setDialog("new")}><Plus size={14} /> Create a matter</button> : undefined} /> : (
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Matter</th><th>Client</th><th>Practice area</th><th>Status</th><th>Next date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {visible.map((item) => <tr key={item.id}>
              <td><span className="table-primary">{item.matterName}</span><span className="table-secondary">{item.matterNumber}</span></td>
              <td className="!text-ink">{item.clientName}</td><td>{item.practiceArea}</td>
              <td><span className={`status status-${item.status}`}>{matterStatusLabel(item.status)}</span></td>
              <td><span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-muted" />{formatDate(item.nextDate)}</span></td>
              <td><div className="flex justify-end gap-1"><button className="icon-button" aria-label={`Edit ${item.matterName}`} onClick={() => setDialog(item)}><Pencil size={14} /></button><button className="icon-button !text-[#ad695d]" aria-label={`Delete ${item.matterName}`} onClick={() => void removeMatter(item)}><Trash2 size={14} /></button></div></td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
      {dialog ? <MatterDialog matter={dialog === "new" ? undefined : dialog} clients={clients.items} matters={allMatters} onClose={() => setDialog(null)} onSaved={() => {}} onOptimistic={(item) => setOptimistic((current) => [item, ...current])} onRollback={(id) => setOptimistic((current) => current.filter((item) => item.id !== id))} /> : null}
    </>
  );
}
