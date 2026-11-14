"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Banknote, CirclePlus, Download, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ContentLoading, EmptyState, PageHeader, useGlobalSearch } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { ErrorBanner, FormField, Modal, SaveButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createRecord, deleteRecord, updateRecord } from "@/lib/workspace-repo";
import { formatDate, formatMoney, invoiceStatusClass, todayInHarare } from "@/lib/utils";
import { invoiceSchema, invoiceStatuses, type InvoiceInput } from "@/lib/validation";
import type { Invoice, InvoiceStatus } from "@/types/models";

function InvoiceDialog({ invoice, close }: { invoice?: Invoice; close: () => void }) {
  const { user } = useAuth();
  const { matters } = useWorkspaceData();
  const { showToast } = useToast();
  const [saveError, setSaveError] = useState<string | null>(null);
  const form = useForm<InvoiceInput>({ resolver: zodResolver(invoiceSchema), defaultValues: invoice ? { matterId: invoice.matterId, amount: invoice.amount, status: invoice.status, dueDate: invoice.dueDate } : { matterId: matters.items[0]?.id ?? "", amount: 0, status: "Sent", dueDate: todayInHarare() } });

  async function submit(values: InvoiceInput) {
    if (!user) return;
    const matter = matters.items.find((item) => item.id === values.matterId);
    if (!matter) { setSaveError("Choose a matter for this invoice."); return; }
    try {
      if (invoice) {
        await updateRecord("invoices", invoice.id, { amount: values.amount, status: values.status, dueDate: values.dueDate });
        showToast("Invoice updated", "success", invoice.invoiceNumber);
      } else {
        const year = new Date().getFullYear();
        const sequence = String(Date.now()).slice(-6);
        const invoiceNumber = `INV-${year}-${sequence}`;
        await createRecord("invoices", { invoiceNumber, matterId: matter.id, clientName: matter.clientName, amount: values.amount, status: values.status, dueDate: values.dueDate, firmId: user.firmId, createdAt: new Date().toISOString() });
        showToast("Invoice created", "success", invoiceNumber);
      }
      close();
    } catch {
      setSaveError("The invoice could not be saved. Please try again.");
    }
  }

  return <Modal title={invoice ? "Edit invoice" : "Create an invoice"} eyebrow="Client billing" onClose={close}>
    {matters.items.length === 0 && !invoice ? <><p className="text-xs leading-5 text-muted">Add a matter before you create an invoice.</p><div className="mt-5 flex justify-end"><button className="btn-secondary" onClick={close}>Close</button></div></> : <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
      {saveError ? <ErrorBanner>{saveError}</ErrorBanner> : null}
      <FormField label="Matter" htmlFor="invoice-matter" error={form.formState.errors.matterId?.message}><select id="invoice-matter" className="field-control" {...form.register("matterId")} disabled={Boolean(invoice)}>{matters.items.map((matter) => <option key={matter.id} value={matter.id}>{matter.matterNumber} · {matter.matterName}</option>)}</select></FormField>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label="Amount (US$)" htmlFor="invoice-amount" error={form.formState.errors.amount?.message}><input id="invoice-amount" type="number" min="0.01" step="0.01" className="field-control" placeholder="0.00" {...form.register("amount", { valueAsNumber: true })} /></FormField><FormField label="Due date" htmlFor="invoice-due" error={form.formState.errors.dueDate?.message}><input id="invoice-due" type="date" className="field-control" {...form.register("dueDate")} /></FormField></div>
      <FormField label="Status" htmlFor="invoice-status" error={form.formState.errors.status?.message}><select id="invoice-status" className="field-control" {...form.register("status")}>{invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></FormField>
      <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-secondary" onClick={close}>Cancel</button><SaveButton busy={form.formState.isSubmitting}>{invoice ? "Save changes" : <><Plus size={14} /> Create invoice</>}</SaveButton></div>
    </form>}
  </Modal>;
}

export function BillingView() {
  const { invoices } = useWorkspaceData();
  const { query } = useGlobalSearch();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState<Invoice | "new" | null>(null);
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => invoices.items.filter((invoice) => `${invoice.invoiceNumber} ${invoice.clientName} ${invoice.status} ${invoice.amount}`.toLowerCase().includes(normalized)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [invoices.items, normalized]);
  const paid = invoices.items.filter((invoice) => invoice.status === "Paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const awaiting = invoices.items.filter((invoice) => invoice.status !== "Paid").reduce((sum, invoice) => sum + invoice.amount, 0);

  async function changeStatus(invoice: Invoice, status: InvoiceStatus) {
    try { await updateRecord("invoices", invoice.id, { status }); showToast("Invoice status updated"); }
    catch { showToast("Invoice status could not be updated", "error"); }
  }

  async function remove(invoice: Invoice) {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber}?`)) return;
    try { await deleteRecord("invoices", invoice.id); showToast("Invoice deleted"); }
    catch { showToast("Invoice could not be deleted", "error"); }
  }

  if (invoices.loading) return <ContentLoading label="Loading billing…" />;
  return <>
    <PageHeader eyebrow="Accounts" title="Billing" description="Track fees billed, payments received and outstanding client invoices in US dollars." action={<button className="btn-primary" onClick={() => setDialog("new")}><CirclePlus size={15} /> New invoice</button>} />
    {invoices.error ? <div className="mb-4"><ErrorBanner>{invoices.error}</ErrorBanner></div> : null}
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <BillingMetric label="Total billed" value={formatMoney(invoices.items.reduce((sum, invoice) => sum + invoice.amount, 0))} caption={`${invoices.items.length} invoices`} icon={<ReceiptText size={16} />} />
      <BillingMetric label="Collected" value={formatMoney(paid)} caption={`${invoices.items.filter((invoice) => invoice.status === "Paid").length} paid`} icon={<Banknote size={16} />} />
      <BillingMetric label="Outstanding" value={formatMoney(awaiting)} caption={`${invoices.items.filter((invoice) => invoice.status !== "Paid").length} awaiting payment`} icon={<Download size={16} />} />
    </div>
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6"><div><p className="panel-title">Invoices</p><p className="mt-1 text-[10px] text-muted">US dollars · Harare date display</p></div><span className="text-[10px] text-muted">{visible.length} records</span></div>
      {visible.length === 0 ? <EmptyState title={query ? "No matching invoices" : "No invoices yet"} detail={query ? "Try another invoice number or client." : "Create an invoice and track its payment status from here."} action={!query ? <button className="btn-primary" onClick={() => setDialog("new")}><Plus size={14} /> Create an invoice</button> : undefined} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Due date</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((invoice) => <tr key={invoice.id}><td><span className="table-primary">{invoice.invoiceNumber}</span><span className="table-secondary">{invoice.matterId}</span></td><td className="!text-ink">{invoice.clientName}</td><td className="!font-semibold !text-ink">{formatMoney(invoice.amount)}</td><td>{formatDate(invoice.dueDate)}</td><td><label><span className="sr-only">Invoice status</span><select className={`appearance-none border-0 bg-transparent p-0 pr-1 text-[10px] font-bold focus:ring-0 ${invoiceStatusClass(invoice.status).includes("paid") ? "text-[#4e7a56]" : invoice.status === "Overdue" ? "text-[#ae594c]" : "text-[#997742]"}`} value={invoice.status} onChange={(event) => void changeStatus(invoice, event.target.value as InvoiceStatus)}>{invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></td><td><div className="flex justify-end gap-1"><button className="icon-button" aria-label={`Edit invoice ${invoice.invoiceNumber}`} onClick={() => setDialog(invoice)}><ReceiptText size={14} /></button><button className="icon-button !text-[#ad695d]" aria-label={`Delete invoice ${invoice.invoiceNumber}`} onClick={() => void remove(invoice)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {dialog ? <InvoiceDialog invoice={dialog === "new" ? undefined : dialog} close={() => setDialog(null)} /> : null}
  </>;
}

function BillingMetric({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: ReactNode }) {
  return <article className="stat-card"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold text-muted">{label}</p><p className="stat-value mt-2 !text-[24px]">{value}</p></div><span className="stat-icon">{icon}</span></div><p className="stat-caption mt-3">{caption}</p></article>;
}
