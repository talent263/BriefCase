"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Download, FileArchive, FileText, Pencil, Trash2, UploadCloud } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ContentLoading, EmptyState, PageHeader, useGlobalSearch } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { ErrorBanner, FormField, Modal, SaveButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { deleteDocumentFile, downloadDocumentFile, updateRecord, uploadDocumentFile } from "@/lib/workspace-repo";
import { formatDate } from "@/lib/utils";
import type { MatterDocument } from "@/types/models";

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadDialog({ close }: { close: () => void }) {
  const { user } = useAuth();
  const { matters } = useWorkspaceData();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [matterId, setMatterId] = useState(matters.items[0]?.id ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function choose(selected: File | null) {
    setError(null);
    if (!selected) { setFile(null); return; }
    if (!selected.size) { setError("The selected file is empty."); setFile(null); return; }
    if (!allowedTypes.has(selected.type)) { setError("Choose a PDF, image, Word or Excel file."); setFile(null); return; }
    if (selected.size > 25 * 1024 * 1024) { setError("Files must be smaller than 25 MB."); setFile(null); return; }
    setFile(selected);
  }

  async function upload() {
    if (!file || !user) { setError("Choose a file to upload."); return; }
    if (!matterId) { setError("Choose a matter for this document."); return; }
    const matter = matters.items.find((item) => item.id === matterId);
    if (!matter) { setError("Choose an available matter."); return; }
    setError(null);
    setBusy(true);
    setProgress(0);
    try {
      await uploadDocumentFile({
        file,
        firmId: user.firmId,
        matterId: matter.id,
        matterNumber: matter.matterNumber,
        uploadedBy: user.uid,
        onProgress: setProgress,
      });
      showToast("Document uploaded", "success", matter.matterNumber);
      close();
    } catch {
      setError("The file could not be saved. Check your connection and try again.");
      setBusy(false);
      setProgress(null);
    }
  }

  return <Modal title="Upload a document" eyebrow="Matter files" onClose={busy ? () => undefined : close}>
    {matters.items.length === 0 ? <><p className="text-xs leading-5 text-muted">Add a matter before uploading a linked document.</p><div className="mt-5 flex justify-end"><button className="btn-secondary" onClick={close}>Close</button></div></> : <div className="space-y-4">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <FormField label="Matter" htmlFor="document-matter"><select id="document-matter" className="field-control" value={matterId} onChange={(event) => setMatterId(event.target.value)}>{matters.items.map((matter) => <option key={matter.id} value={matter.id}>{matter.matterNumber} · {matter.matterName}</option>)}</select></FormField>
      <div><span className="field-label">File</span><input ref={fileInput} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={(event) => choose(event.target.files?.[0] ?? null)} /><button disabled={busy} className="grid min-h-[130px] w-full place-items-center rounded-xl border border-dashed border-[#cbd2c9] bg-[#fbfbf8] p-5 text-center transition hover:border-[#9eb3a1] disabled:opacity-60" onClick={() => fileInput.current?.click()}><span className="grid h-9 w-9 place-items-center rounded-lg bg-mist text-forest"><UploadCloud size={17} /></span><span className="mt-2 text-[11px] font-bold text-ink">{file ? file.name : "Choose a file to upload"}</span><span className="mt-1 text-[9px] text-muted">PDF, images, Word or Excel · up to 25 MB</span></button></div>
      {progress !== null ? <div><div className="mb-1.5 flex justify-between text-[9px] text-muted"><span>{busy ? "Uploading securely…" : "Upload"}</span><span>{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-forest transition-all" style={{ width: `${progress}%` }} /></div></div> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-secondary" onClick={close} disabled={busy}>Cancel</button><button className="btn-primary" onClick={() => void upload()} disabled={busy || !file}><UploadCloud size={14} />{busy ? "Uploading…" : "Upload document"}</button></div>
    </div>}
  </Modal>;
}

function RenameDialog({ file, close }: { file: MatterDocument; close: () => void }) {
  const { showToast } = useToast();
  const [name, setName] = useState(file.fileName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = name.trim();
    if (!cleaned || cleaned.length > 180) { setError("Enter a name between 1 and 180 characters."); return; }
    setBusy(true);
    setError(null);
    try {
      await updateRecord("documents", file.id, { fileName: cleaned });
      showToast("Document renamed");
      close();
    } catch {
      setError("The document name could not be saved.");
      setBusy(false);
    }
  }

  return <Modal title="Rename document" eyebrow={file.matterNumber} onClose={busy ? () => undefined : close}>
    <form className="space-y-4" onSubmit={(event) => void save(event)}>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <FormField label="Document name" htmlFor="rename-document"><input id="rename-document" className="field-control" maxLength={180} value={name} onChange={(event) => setName(event.target.value)} /></FormField>
      <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-secondary" onClick={close} disabled={busy}>Cancel</button><SaveButton busy={busy}>Save name</SaveButton></div>
    </form>
  </Modal>;
}

export function DocumentsView() {
  const { documents } = useWorkspaceData();
  const { query } = useGlobalSearch();
  const { showToast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [rename, setRename] = useState<MatterDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => documents.items.filter((file) => `${file.fileName} ${file.matterNumber} ${file.contentType}`.toLowerCase().includes(normalized)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [documents.items, normalized]);

  async function download(file: MatterDocument) {
    setBusyId(file.id);
    try {
      await downloadDocumentFile(file);
    } catch {
      showToast("Document could not be downloaded", "error");
    } finally { setBusyId(null); }
  }

  async function remove(file: MatterDocument) {
    if (!window.confirm(`Delete “${file.fileName}” from the matter file repository?`)) return;
    setBusyId(file.id);
    try {
      await deleteDocumentFile(file);
      showToast("Document deleted");
    } catch {
      showToast("Document could not be deleted", "error");
    } finally { setBusyId(null); }
  }

  if (documents.loading) return <ContentLoading label="Loading document repository…" />;
  return <>
    <PageHeader eyebrow="Matter files" title="Documents" description="A private repository for case files, linked to the matters they support." action={<button className="btn-primary" onClick={() => setDialog(true)}><UploadCloud size={15} /> Upload document</button>} />
    {documents.error ? <div className="mb-4"><ErrorBanner>{documents.error}</ErrorBanner></div> : null}
    <div className="mb-4 flex items-center justify-between"><p className="text-[11px] text-muted"><span className="font-semibold text-ink">{visible.length}</span> documents</p><p className="text-[9px] text-muted">Encrypted storage · 25 MB maximum per file</p></div>
    <section className="panel overflow-hidden">
      {visible.length === 0 ? <EmptyState title={query ? "No matching documents" : "Your file repository is empty"} detail={query ? "Search by file name or matter reference." : "Upload a file and link it to a matter. Only workspace members can access these files."} action={!query ? <button className="btn-primary" onClick={() => setDialog(true)}><UploadCloud size={14} /> Upload document</button> : undefined} /> : <div className="divide-y divide-line">{visible.map((file) => <article key={file.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-forest">{file.contentType.startsWith("image/") ? <FileArchive size={17} /> : <FileText size={17} />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-ink">{file.fileName}</p><p className="mt-1 text-[10px] text-muted">{file.matterNumber} <span className="mx-1 text-[#c4cbc6]">·</span> {formatDate(file.createdAt)} <span className="mx-1 text-[#c4cbc6]">·</span> {fileSize(file.size)}</p></div><span className="rounded-md bg-paper px-2 py-1 text-[9px] font-semibold text-muted">{file.contentType.split("/").at(-1)?.toUpperCase() ?? "FILE"}</span><div className="flex gap-1"><button className="icon-button" aria-label={`Rename ${file.fileName}`} disabled={busyId === file.id} onClick={() => setRename(file)}><Pencil size={14} /></button><button className="btn-secondary !h-[34px] !min-h-[34px] !px-2.5 text-[10px]" disabled={busyId === file.id} onClick={() => void download(file)}><Download size={13} />{busyId === file.id ? "Opening…" : "Download"}</button><button className="icon-button !text-[#ad695d]" aria-label={`Delete ${file.fileName}`} disabled={busyId === file.id} onClick={() => void remove(file)}><Trash2 size={14} /></button></div></article>)}</div>}
    </section>
    {dialog ? <UploadDialog close={() => setDialog(false)} /> : null}
    {rename ? <RenameDialog file={rename} close={() => setRename(null)} /> : null}
  </>;
}
