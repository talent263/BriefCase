"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  UsersRound,
  WalletCards,
  X,
  Building2,
  Plus,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers";
import { WorkspaceDataProvider, useWorkspaceData } from "@/components/workspace-data";
import { useToast } from "@/components/toast";
import { formatDate, formatDateTime, roleLabel } from "@/lib/utils";
import { cx } from "@/lib/utils";
import type { CalendarEvent, Client, Matter, Task } from "@/types/models";

interface SearchContextValue {
  query: string;
  setQuery: (value: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useGlobalSearch(): SearchContextValue {
  const value = useContext(SearchContext);
  if (!value) throw new Error("useGlobalSearch must be used within WorkspaceShell.");
  return value;
}

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Matters", href: "/dashboard/matters", icon: BriefcaseBusiness },
  { label: "Clients", href: "/dashboard/clients", icon: UsersRound },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Documents", href: "/dashboard/documents", icon: FileText },
  { label: "Billing", href: "/dashboard/billing", icon: WalletCards },
  { label: "Team & Settings", href: "/dashboard/team", icon: Settings2 },
];

function initials(displayName: string, email: string): string {
  const base = displayName.trim() || email;
  return base.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function SideNavigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="sidebar-scroll flex flex-col px-4 py-5">
      <div className="flex items-center gap-3 px-2 pb-8 pt-1">
        <div className="brand-mark"><BriefcaseBusiness size={18} /></div>
        <div>
          <div className="font-display text-[15px] font-extrabold tracking-[-.04em] text-white">briefcase</div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.19em] text-white/45">Moyo & Partners</div>
        </div>
      </div>

      <div className="sidebar-label mb-2">Workspace</div>
      <nav className="flex flex-col gap-1">
        {navigation.map(({ label, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={close} className={cx("sidebar-link", active && "sidebar-link-active")}>
              <Icon size={16} strokeWidth={active ? 2.1 : 1.8} />
              <span>{label}</span>
              {label === "Tasks" ? <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/70">LIVE</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8">
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[.055] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-white/85"><Building2 size={14} className="text-gold" /> Harare workspace</div>
          <p className="text-[10px] leading-relaxed text-white/50">Your firm matters and client records stay within this workspace.</p>
        </div>
        <div className="sidebar-footer flex items-center gap-2.5 pt-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d7b981] text-[10px] font-bold text-forest">{user ? initials(user.displayName, user.email) : "MP"}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-white">{user?.displayName}</p>
            <p className="mt-0.5 truncate text-[9px] capitalize text-white/45">{user ? roleLabel(user.role) : "Team member"}</p>
          </div>
          <button className="icon-button text-white/60 hover:bg-white/10 hover:text-white" aria-label="Sign out" onClick={() => void handleSignOut()}><LogOut size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { matters, clients } = useWorkspaceData();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const normalized = value.trim().toLowerCase();
  const matchesMatters = normalized ? matters.items.filter((item) => `${item.matterNumber} ${item.matterName} ${item.clientName} ${item.practiceArea}`.toLowerCase().includes(normalized)).slice(0, 4) : [];
  const matchesClients = normalized ? clients.items.filter((item) => `${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(normalized)).slice(0, 4) : [];
  const router = useRouter();

  useEffect(() => {
    function onOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function select(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative w-full max-w-[410px]" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#89958f]" size={15} />
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => { onChange(event.target.value); setOpen(true); }}
          placeholder="Search matters, clients..."
          className="h-[38px] w-full rounded-lg border border-[#e4e6df] bg-white pl-9 pr-14 text-[11px] text-ink outline-none transition focus:border-[#b5c3b7] focus:ring-2 focus:ring-forest/5"
          aria-label="Search matters and clients"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#e3e5df] px-1.5 py-0.5 text-[9px] text-[#9aa39e]">⌘ K</span>
      </div>
      {open && normalized ? (
        <div className="search-results">
          {matchesMatters.length === 0 && matchesClients.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted">No matters or clients match “{value}”.</div>
          ) : (
            <>
              {matchesMatters.length > 0 ? <div className="px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[.14em] text-[#9aa39e]">Matters</div> : null}
              {matchesMatters.map((item: Matter) => (
                <button key={item.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-paper" onClick={() => select(`/dashboard/matters?q=${encodeURIComponent(item.matterNumber)}`)}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-mist text-forest"><BriefcaseBusiness size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{item.matterName}</span><span className="mt-0.5 block text-[10px] text-muted">{item.matterNumber} · {item.clientName}</span></span>
                  <ChevronRight size={14} className="text-[#a7b0ab]" />
                </button>
              ))}
              {matchesClients.length > 0 ? <div className="border-t border-line px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[.14em] text-[#9aa39e]">Clients</div> : null}
              {matchesClients.map((item: Client) => (
                <button key={item.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-paper" onClick={() => select(`/dashboard/clients?q=${encodeURIComponent(item.name)}`)}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f6f0e5] text-[#9a7a43]"><CircleUserRound size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{item.name}</span><span className="mt-0.5 block text-[10px] text-muted">{item.email}</span></span>
                  <ChevronRight size={14} className="text-[#a7b0ab]" />
                </button>
              ))}
            </>
          )}
          <div className="border-t border-line bg-[#fbfbf8] px-3 py-2 text-[9px] text-muted">Search also filters the current view</div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationMenu({ onClose }: { onClose: () => void }) {
  const { tasks, calendar } = useWorkspaceData();
  const today = new Date();
  const upcomingTasks = tasks.items.filter((task) => !task.completed && new Date(`${task.dueDate}T23:59:59`).getTime() >= today.getTime()).slice(0, 3);
  const upcomingEvents = calendar.items.filter((event) => new Date(event.eventTime).getTime() >= today.getTime()).slice(0, 3);
  const total = upcomingTasks.length + upcomingEvents.length;
  return (
    <div className="popover p-1.5">
      <div className="flex items-center justify-between px-3 py-2.5"><span className="font-display text-xs font-bold">Notifications</span><button className="text-[10px] font-semibold text-forest" onClick={onClose}>Done</button></div>
      <div className="max-h-[300px] overflow-y-auto">
        {total === 0 ? <p className="px-3 py-7 text-center text-xs text-muted">You are all caught up.</p> : null}
        {upcomingEvents.map((event: CalendarEvent) => <div key={event.id} className="flex gap-2.5 border-t border-line px-3 py-3"><span className="mt-0.5 text-[#a27d42]"><CalendarDays size={15} /></span><div><p className="text-[11px] font-semibold text-ink">{event.title}</p><p className="mt-1 text-[10px] text-muted">{formatDateTime(event.eventTime)} · {event.location}</p></div></div>)}
        {upcomingTasks.map((task: Task) => <div key={task.id} className="flex gap-2.5 border-t border-line px-3 py-3"><span className="mt-0.5 text-forest"><CheckSquare size={15} /></span><div><p className="text-[11px] font-semibold text-ink">{task.title}</p><p className="mt-1 text-[10px] text-muted">Task due {formatDate(task.dueDate)}</p></div></div>)}
      </div>
    </div>
  );
}

function ProfileDrawer({ close }: { close: () => void }) {
  const { user, signOut } = useAuth();
  const { firm, team } = useWorkspaceData();
  const router = useRouter();
  async function leave() {
    await signOut();
    router.replace("/login");
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="modal-card !ml-auto !mr-0 !h-full !max-h-none !w-full !max-w-[420px] !rounded-none !rounded-l-2xl" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="flex items-start justify-between border-b border-line p-6"><div><p className="eyebrow">Account</p><h2 id="profile-title" className="mt-2 font-display text-xl font-bold">Your profile</h2></div><button className="icon-button" onClick={close} aria-label="Close profile"><X size={18} /></button></div>
        <div className="p-6">
          <div className="flex items-center gap-3 rounded-xl bg-paper p-4"><div className="grid h-12 w-12 place-items-center rounded-full bg-forest text-sm font-bold text-white">{user ? initials(user.displayName, user.email) : "MP"}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{user?.displayName}</p><p className="mt-1 truncate text-xs text-muted">{user?.email}</p><span className="mt-2 inline-flex text-[10px] font-semibold capitalize text-forest">{user ? roleLabel(user.role) : ""}</span></div></div>
          <div className="mt-6 space-y-4"><div><p className="eyebrow">Workspace</p><p className="mt-1.5 text-sm font-semibold">{firm?.name ?? "Moyo & Partners"}</p><p className="mt-1 text-xs text-muted">{firm?.address ?? "Harare, Zimbabwe"}</p></div><div><p className="eyebrow">Colleagues</p><p className="mt-1.5 text-sm font-semibold">{team.items.length} active team members</p></div></div>
          <div className="mt-8 flex flex-col gap-2"><Link href="/dashboard/team" className="btn-secondary w-full" onClick={close}><Settings2 size={15} /> Manage workspace</Link><button className="btn-secondary w-full !justify-start !text-[#a14a3d]" onClick={() => void leave()}><LogOut size={15} /> Sign out</button></div>
        </div>
      </section>
    </div>
  );
}

function WorkspaceChrome({ children }: { children: ReactNode }) {
  const { user, status, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileSearchOpen(true);
        const input = document.querySelector<HTMLInputElement>('input[aria-label="Search matters and clients"]');
        input?.focus();
      }
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setMobileOpen(false);
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const pageLabel = useMemo(() => {
    const segment = pathname.split("/").filter(Boolean).at(-1) ?? "dashboard";
    return segment === "dashboard" ? "Overview" : segment.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  }, [pathname]);

  useEffect(() => {
    if (error) showToast(error, "error");
  }, [error, showToast]);

  if (status === "loading" || status === "signed-out") {
    return <div className="grid min-h-screen place-items-center bg-paper"><div className="flex flex-col items-center"><div className="brand-mark !border-forest !text-forest"><BriefcaseBusiness size={18} /></div><p className="mt-4 text-xs font-semibold text-muted">Opening your workspace…</p></div></div>;
  }
  if (status === "unconfigured") return <div className="grid min-h-screen place-items-center bg-paper p-8 text-center text-sm text-muted">Firebase is not configured. Add your Firebase web app keys, or set NEXT_PUBLIC_AUTH_MODE=local for browser testing.</div>;
  if (!user) return null;

  return (
    <WorkspaceDataProvider>
      <SearchContext.Provider value={{ query, setQuery }}>
        <div className="app-grid flex">
          <aside className="sidebar sidebar-desktop hidden shrink-0 md:block"><SideNavigation /></aside>
          {mobileOpen ? <div className="mobile-drawer md:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileOpen(false); }}><div className="mobile-drawer-panel"><div className="flex justify-end px-4 pt-3"><button className="icon-button text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div><SideNavigation close={() => setMobileOpen(false)} /></div></div> : null}
          <div className="workspace-main flex min-h-screen min-w-0 flex-1 flex-col">
            <header className="topbar flex items-center gap-3 px-4 md:px-7">
              <button className="icon-button md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
              <div className="hidden min-w-[126px] items-center gap-2 sm:flex"><span className="text-[10px] font-medium text-[#9aa39e]">Workspace</span><ChevronRight size={12} className="text-[#b4bcb7]" /><span className="text-[11px] font-semibold text-ink">{pageLabel}</span></div>
              <div className="mobile-search mx-auto flex w-full max-w-[410px] flex-1 justify-center"><SearchBox value={query} onChange={setQuery} /></div>
              <div className="ml-auto flex items-center gap-1 sm:ml-0">
                <button className="icon-button md:hidden" onClick={() => setMobileSearchOpen((open) => !open)} aria-label="Search matters and clients"><Search size={17} /></button>
                <div className="relative"><button className="icon-button relative" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}><Bell size={17} /><span className="absolute right-[7px] top-[6px] h-1.5 w-1.5 rounded-full bg-[#c49c55] ring-2 ring-[#fafaf7]" /></button>{notificationsOpen ? <NotificationMenu onClose={() => setNotificationsOpen(false)} /> : null}</div>
                <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
                <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-[#f0f1ec]" onClick={() => setProfileOpen(true)} aria-label="Open profile"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e4e9df] text-[10px] font-bold text-forest">{initials(user.displayName, user.email)}</span><span className="hidden min-w-0 sm:block"><span className="block max-w-[105px] truncate text-[10px] font-semibold text-ink">{user.displayName}</span><span className="mt-0.5 block text-[9px] capitalize text-muted">{roleLabel(user.role)}</span></span></button>
              </div>
              {mobileSearchOpen ? <div className="absolute left-4 right-4 top-[calc(100%+7px)] z-50 flex gap-2 rounded-xl border border-line bg-white p-2 shadow-float md:hidden"><SearchBox value={query} onChange={setQuery} /><button className="icon-button shrink-0" onClick={() => setMobileSearchOpen(false)} aria-label="Close search"><X size={17} /></button></div> : null}
            </header>
            <main className="flex-1"><div className="page-wrap">{children}</div></main>
          </div>
        </div>
        {profileOpen ? <ProfileDrawer close={() => setProfileOpen(false)} /> : null}
      </SearchContext.Provider>
    </WorkspaceDataProvider>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return <WorkspaceChrome>{children}</WorkspaceChrome>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}<h1 className="page-title">{title}</h1>{description ? <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">{description}</p> : null}</div>{action}</div>;
}

export function ContentLoading({ label = "Loading workspace data…" }: { label?: string }) {
  return <div className="panel grid min-h-[240px] place-items-center"><div className="flex items-center gap-2 text-xs text-muted"><Clock3 size={15} className="animate-pulse" />{label}</div></div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="max-w-sm"><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-mist text-forest"><FileText size={18} /></div><h3 className="mt-3 font-display text-sm font-bold">{title}</h3><p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>{action ? <div className="mt-4">{action}</div> : null}</div></div>;
}

export function SearchFilter({ children }: { children: Array<{ text: string; node: ReactNode }> }): ReactNode {
  const { query } = useGlobalSearch();
  const filtered = query.trim() ? children.filter((item) => item.text.toLowerCase().includes(query.trim().toLowerCase())) : children;
  return filtered.map((item) => item.node);
}

export function QuickAdd({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="btn-secondary"><Plus size={14} />{label}</Link>;
}
