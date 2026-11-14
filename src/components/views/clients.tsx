"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Building2, CirclePlus, Mail, MapPin, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ContentLoading, EmptyState, PageHeader, useGlobalSearch } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { ErrorBanner, FormField, Modal, SaveButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createRecord, deleteRecord, updateRecord } from "@/lib/workspace-repo";
import { clientSchema, type ClientInput } from "@/lib/validation";
import type { Client } from "@/types/models";

function ClientDialog({ client, close }: { client?: Client; close: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? { name: client.name, type: client.type, email: client.email, phone: client.phone, address: client.address } : { name: "", type: "Individual", email: "", phone: "", address: "" },
  });

  async function submit(values: ClientInput) {
    if (!user) return;
    try {
      if (client) {
        await updateRecord("clients", client.id, values);
        showToast("Client updated");
      } else {
        await createRecord("clients", { ...values, firmId: user.firmId, createdAt: new Date().toISOString() });
        showToast("Client added", "success", values.name);
      }
      close();
    } catch {
      setSaveError("The client could not be saved. Please try again.");
    }
  }

  return <Modal title={client ? "Edit client" : "Add a client"} eyebrow="Client directory" onClose={close}>
    <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
      {saveError ? <ErrorBanner>{saveError}</ErrorBanner> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <FormField label="Full name or company" htmlFor="client-name" error={form.formState.errors.name?.message}><input id="client-name" className="field-control" placeholder="Client name" {...form.register("name")} /></FormField>
        <FormField label="Client type" htmlFor="client-type" error={form.formState.errors.type?.message}><select id="client-type" className="field-control" {...form.register("type")}><option value="Individual">Individual</option><option value="Company">Company</option></select></FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Email address" htmlFor="client-email" error={form.formState.errors.email?.message}><input id="client-email" type="email" className="field-control" placeholder="name@example.com" {...form.register("email")} /></FormField>
        <FormField label="Phone number" htmlFor="client-phone" error={form.formState.errors.phone?.message}><input id="client-phone" className="field-control" placeholder="+263 ..." {...form.register("phone")} /></FormField>
      </div>
      <FormField label="Address" htmlFor="client-address" error={form.formState.errors.address?.message}><textarea id="client-address" className="field-control" placeholder="Street, suburb, city" {...form.register("address")} /></FormField>
      <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><SaveButton busy={form.formState.isSubmitting}>{client ? "Save changes" : <><Plus size={14} /> Add client</>}</SaveButton></div>
    </form>
  </Modal>;
}

export function ClientsView() {
  const { clients, matters } = useWorkspaceData();
  const { query } = useGlobalSearch();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState<Client | "new" | null>(null);
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => clients.items.filter((client) => `${client.name} ${client.email} ${client.phone} ${client.address}`.toLowerCase().includes(normalized)), [clients.items, normalized]);

  async function removeClient(client: Client) {
    const linked = matters.items.filter((matter) => matter.clientName.toLowerCase() === client.name.toLowerCase()).length;
    const warning = linked ? `This client is linked to ${linked} matter${linked === 1 ? "" : "s"}. Delete the directory entry?` : `Delete ${client.name} from the client directory?`;
    if (!window.confirm(warning)) return;
    try {
      await deleteRecord("clients", client.id);
      showToast("Client deleted");
    } catch {
      showToast("Client could not be deleted", "error");
    }
  }

  if (clients.loading) return <ContentLoading label="Loading client directory…" />;
  return <>
    <PageHeader eyebrow="Relationships" title="Clients" description="Keep client details close to the work and matters they are connected to." action={<button className="btn-primary" onClick={() => setDialog("new")}><CirclePlus size={15} /> Add client</button>} />
    {clients.error ? <div className="mb-4"><ErrorBanner>{clients.error}</ErrorBanner></div> : null}
    <div className="mb-4 flex items-center gap-2 text-[11px] text-muted"><span className="font-semibold text-ink">{visible.length}</span> clients in your directory</div>
    {visible.length === 0 ? <section className="panel"><EmptyState title={query ? "No matching clients" : "Start your client directory"} detail={query ? "Try a different name or email address." : "Add your first client to connect people and organizations to matters."} action={!query ? <button className="btn-primary" onClick={() => setDialog("new")}><Plus size={14} /> Add a client</button> : undefined} /></section> : (
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {visible.map((client) => {
          const linked = matters.items.filter((matter) => matter.clientName.toLowerCase() === client.name.toLowerCase());
          return <article className="panel p-5" key={client.id}>
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-forest">{client.type === "Company" ? <Building2 size={18} /> : <UserRound size={18} />}</span><div className="min-w-0 flex-1"><p className="truncate font-display text-sm font-bold">{client.name}</p><p className="mt-1 text-[10px] text-muted">{client.type} · {linked.length} linked matter{linked.length === 1 ? "" : "s"}</p></div><div className="flex gap-0.5"><button className="icon-button" aria-label={`Edit ${client.name}`} onClick={() => setDialog(client)}><Pencil size={14} /></button><button className="icon-button !text-[#ad695d]" aria-label={`Delete ${client.name}`} onClick={() => void removeClient(client)}><Trash2 size={14} /></button></div></div>
            <div className="mt-5 space-y-2.5 border-t border-line pt-4 text-[11px] text-[#64716c]"><p className="flex min-w-0 items-center gap-2"><Mail size={13} className="shrink-0 text-[#96a19c]" /><span className="truncate">{client.email}</span></p><p className="flex items-center gap-2"><Phone size={13} className="shrink-0 text-[#96a19c]" />{client.phone}</p><p className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 shrink-0 text-[#96a19c]" /><span>{client.address}</span></p></div>
            {linked.length > 0 ? <div className="mt-4 flex flex-wrap gap-1.5">{linked.slice(0, 3).map((matter) => <span key={matter.id} className="rounded-md bg-paper px-2 py-1 text-[9px] font-semibold text-forest">{matter.matterNumber}</span>)}</div> : null}
          </article>;
        })}
      </div>
    )}
    {dialog ? <ClientDialog client={dialog === "new" ? undefined : dialog} close={() => setDialog(null)} /> : null}
  </>;
}
