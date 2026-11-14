"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Building2, CircleAlert, Mail, Send, Settings2, ShieldCheck, Trash2, UserPlus, UsersRound } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/components/providers";
import { EmptyState, PageHeader } from "@/components/workspace-shell";
import { useWorkspaceData } from "@/components/workspace-data";
import { ErrorBanner, FormField, SaveButton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { isManagementRole } from "@/lib/auth/roles";
import { getClientDb } from "@/lib/firebase/client";
import { isLocalMode } from "@/lib/local-mode";
import { readLocalCollection, subscribeLocalStore } from "@/lib/local-store";
import { cancelLocalInvite, createLocalInvite, updateRecord } from "@/lib/workspace-repo";
import { roleLabel } from "@/lib/utils";
import { firmSchema, inviteSchema, userRoles, type FirmInput, type InviteInput } from "@/lib/validation";
import type { TeamMember, UserRole } from "@/types/models";

const invitesResponseSchema = z.object({
  invitations: z.array(z.object({ id: z.string(), email: z.string().email(), role: z.enum(userRoles), createdAt: z.string() })),
});
type PendingInvite = z.infer<typeof invitesResponseSchema>["invitations"][number];

function initials(name: string, email: string): string {
  return (name.trim() || email).split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function FirmSettings() {
  const { user } = useAuth();
  const { firm, firmLoading, firmError } = useWorkspaceData();
  const { showToast } = useToast();
  const allowed = user ? isManagementRole(user.role) : false;
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FirmInput>({ resolver: zodResolver(firmSchema), defaultValues: { name: "", address: "", phone: "", email: "" } });

  useEffect(() => {
    if (firm) form.reset({ name: firm.name, address: firm.address, phone: firm.phone, email: firm.email });
  }, [firm, form]);

  async function save(values: FirmInput) {
    if (!user || !allowed) return;
    setError(null);
    try {
      await updateRecord("firms", user.firmId, values);
      showToast("Firm profile updated");
    } catch {
      setError("Firm settings could not be saved. Check your role and connection.");
    }
  }

  if (firmLoading) return <div className="panel p-6 text-xs text-muted">Loading firm profile…</div>;
  return <section className="panel p-5 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-mist text-forest"><Building2 size={17} /></span><div><h2 className="panel-title">Firm profile</h2><p className="mt-1 text-[10px] text-muted">Workspace details shown to your team.</p></div></div>
    {firmError || error ? <div className="mb-4"><ErrorBanner>{error ?? firmError}</ErrorBanner></div> : null}
    {!firm ? <ErrorBanner>Firm profile could not be found for this workspace.</ErrorBanner> : <form className="space-y-4" onSubmit={form.handleSubmit(save)}>
      <FormField label="Firm name" htmlFor="firm-name" error={form.formState.errors.name?.message}><input id="firm-name" className="field-control" disabled={!allowed} {...form.register("name")} /></FormField>
      <FormField label="Office address" htmlFor="firm-address" error={form.formState.errors.address?.message}><textarea id="firm-address" className="field-control" disabled={!allowed} {...form.register("address")} /></FormField>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label="Office phone" htmlFor="firm-phone" error={form.formState.errors.phone?.message}><input id="firm-phone" className="field-control" disabled={!allowed} {...form.register("phone")} /></FormField><FormField label="Office email" htmlFor="firm-email" error={form.formState.errors.email?.message}><input id="firm-email" type="email" className="field-control" disabled={!allowed} {...form.register("email")} /></FormField></div>
      {allowed ? <div className="flex justify-end border-t border-line pt-4"><SaveButton busy={form.formState.isSubmitting}><Settings2 size={14} /> Save firm details</SaveButton></div> : <p className="flex items-center gap-2 text-[10px] text-muted"><ShieldCheck size={13} /> Firm settings can be edited by a Partner or Administrator.</p>}
    </form>}
  </section>;
}

function TeamInvitations() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const localMode = isLocalMode();
  const allowed = user ? isManagementRole(user.role) : false;
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(allowed);
  const [requestError, setRequestError] = useState<string | null>(null);
  const form = useForm<InviteInput>({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "associate" } });

  useEffect(() => {
    if (!allowed || !user) { setLoading(false); return; }
    setLoading(true);

    if (localMode) {
      const sync = () => {
        const records = readLocalCollection<{ id: string; email: string; role: UserRole; createdAt: string; firmId: string }>("teamInvites")
          .filter((invite) => invite.firmId === user.firmId);
        const parsed = invitesResponseSchema.safeParse({ invitations: records });
        if (!parsed.success) {
          setRequestError("Some pending invitations could not be read.");
          setLoading(false);
          return;
        }
        setInvites(parsed.data.invitations);
        setRequestError(null);
        setLoading(false);
      };
      sync();
      return subscribeLocalStore(sync);
    }

    const invitationsQuery = query(collection(getClientDb(), "teamInvites"), where("firmId", "==", user.firmId));
    return onSnapshot(invitationsQuery, (snapshot) => {
      const records = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      const parsed = invitesResponseSchema.safeParse({ invitations: records });
      if (!parsed.success) {
        setRequestError("Some pending invitations could not be read.");
        setLoading(false);
        return;
      }
      setInvites(parsed.data.invitations);
      setRequestError(null);
      setLoading(false);
    }, () => {
      setRequestError("Could not load pending invitations.");
      setLoading(false);
    });
  }, [allowed, user, localMode]);

  async function sendInvite(values: InviteInput) {
    if (!user) return;
    setRequestError(null);
    try {
      if (localMode) {
        createLocalInvite(user.firmId, values.email, values.role);
        showToast("Invitation created", "success", `${values.email} can sign up with that email to join.`);
      } else {
        const response = await fetch("/api/team/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values), credentials: "same-origin" });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "Invitation could not be sent.";
          throw new Error(message);
        }
        showToast("Invitation created", "success", `${values.email} can sign in with Google to join.`);
      }
      form.reset({ email: "", role: "associate" });
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : "Invitation could not be sent.");
    }
  }

  async function cancelInvite(invite: PendingInvite) {
    if (!window.confirm(`Cancel the invitation for ${invite.email}?`)) return;
    try {
      if (localMode) {
        cancelLocalInvite(invite.id);
      } else {
        const response = await fetch("/api/team/invites", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: invite.id }), credentials: "same-origin" });
        if (!response.ok) throw new Error("Could not cancel that invitation.");
      }
      showToast("Invitation cancelled");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "Invitation could not be cancelled", "error");
    }
  }

  if (!allowed) return <section className="panel p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f8f2e7] text-[#a17e43]"><ShieldCheck size={17} /></span><div><h2 className="panel-title">Team management</h2><p className="mt-1 max-w-lg text-[10px] leading-5 text-muted">Partner and Administrator roles can invite colleagues. Contact a workspace administrator if you need to change team access.</p></div></div></section>;

  return <section className="panel p-5 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f8f2e7] text-[#a17e43]"><UserPlus size={17} /></span><div><h2 className="panel-title">Invite a colleague</h2><p className="mt-1 text-[10px] text-muted">{localMode ? "They can join by signing up with the invited email address." : "They can join by signing in with the invited Google account."}</p></div></div>
    {requestError ? <div className="mb-4"><ErrorBanner>{requestError}</ErrorBanner></div> : null}
    <form className="grid gap-3 sm:grid-cols-[1fr_150px_auto] sm:items-end" onSubmit={form.handleSubmit(sendInvite)}>
      <FormField label="Work email" htmlFor="invite-email" error={form.formState.errors.email?.message}><input id="invite-email" type="email" className="field-control" placeholder="colleague@firm.co.zw" {...form.register("email")} /></FormField>
      <FormField label="Workspace role" htmlFor="invite-role" error={form.formState.errors.role?.message}><select id="invite-role" className="field-control" {...form.register("role")}>{userRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></FormField>
      <SaveButton busy={form.formState.isSubmitting}><Send size={14} /> Invite</SaveButton>
    </form>
      <div className="mt-6 border-t border-line pt-4"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold text-ink">Pending invitations</p><span className="text-[9px] text-muted">{localMode ? "Stored locally" : "Live updates"}</span></div>
      {loading ? <p className="py-4 text-center text-[10px] text-muted">Loading invitations…</p> : invites.length === 0 ? <p className="py-4 text-center text-[10px] text-muted">No pending invitations.</p> : <div className="divide-y divide-line">{invites.map((invite) => <div key={invite.id} className="flex items-center gap-3 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-paper text-muted"><Mail size={14} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-ink">{invite.email}</p><p className="mt-0.5 text-[9px] text-muted">{roleLabel(invite.role)} · Invited {new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", day: "numeric", month: "short" }).format(new Date(invite.createdAt))}</p></div><span className="status status-invited">Invited</span><button className="icon-button !text-[#ad695d]" aria-label={`Cancel invitation for ${invite.email}`} onClick={() => void cancelInvite(invite)}><Trash2 size={14} /></button></div>)}</div>}
    </div>
  </section>;
}

function TeamMembers() {
  const { team, team: state } = useWorkspaceData();
  if (state.loading) return <div className="panel p-6 text-xs text-muted">Loading your colleagues…</div>;
  const people = [...team.items].sort((a, b) => a.displayName.localeCompare(b.displayName));
  return <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6"><div><h2 className="panel-title">Your colleagues</h2><p className="mt-1 text-[10px] text-muted">People with access to this workspace.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[9px] font-semibold text-muted"><UsersRound size={12} />{people.length} members</span></div>
    {people.length === 0 ? <EmptyState title="No team members found" detail="Your workspace team will appear here." /> : <div className="divide-y divide-line">{people.map((member: TeamMember) => <div key={member.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-mist text-[10px] font-bold text-forest">{initials(member.displayName, member.email)}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-ink">{member.displayName}</p><p className="mt-0.5 truncate text-[9px] text-muted">{member.email}</p></div><span className="status status-open">{roleLabel(member.role)}</span><span className={`status ${member.status === "active" ? "status-active" : "status-invited"}`}>{member.status}</span></div>)}</div>}
  </section>;
}

export function TeamView() {
  return <>
    <PageHeader eyebrow="Workspace administration" title="Team & settings" description="Manage your firm details and the colleagues who can access this workspace." />
    <div className="grid items-start gap-4 xl:grid-cols-[.92fr_1.08fr]">
      <div className="space-y-4"><FirmSettings /><TeamInvitations /></div>
      <div className="space-y-4"><TeamMembers /><div className="rounded-xl border border-[#e7e9e2] bg-[#f1f2ed] p-4"><div className="flex items-start gap-2.5"><CircleAlert size={14} className="mt-0.5 shrink-0 text-[#9a8560]" /><p className="text-[10px] leading-5 text-[#75817b]">Workspace membership is isolated by firm. Invited colleagues must sign in using the exact email address that received the invitation.</p></div></div></div>
    </div>
  </>;
}
