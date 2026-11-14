"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/components/providers";
import { getClientDb } from "@/lib/firebase/client";
import { isLocalMode } from "@/lib/local-mode";
import {
  localCollectionState,
  readLocalCollection,
  subscribeLocalStore,
} from "@/lib/local-store";
import type {
  CalendarEvent,
  Client,
  CollectionState,
  FirmProfile,
  Invoice,
  Matter,
  MatterDocument,
  TeamMember,
  Task,
} from "@/types/models";

interface WorkspaceDataValue {
  matters: CollectionState<Matter>;
  clients: CollectionState<Client>;
  tasks: CollectionState<Task>;
  invoices: CollectionState<Invoice>;
  calendar: CollectionState<CalendarEvent>;
  documents: CollectionState<MatterDocument>;
  team: CollectionState<TeamMember>;
  firm: FirmProfile | null;
  firmLoading: boolean;
  firmError: string | null;
}

type WorkspaceCollection = "matters" | "clients" | "tasks" | "invoices" | "calendar" | "documents" | "team";

const emptyState = <T,>(): CollectionState<T> => ({ items: [], loading: true, error: null });
const initialData: WorkspaceDataValue = {
  matters: emptyState<Matter>(),
  clients: emptyState<Client>(),
  tasks: emptyState<Task>(),
  invoices: emptyState<Invoice>(),
  calendar: emptyState<CalendarEvent>(),
  documents: emptyState<MatterDocument>(),
  team: emptyState<TeamMember>(),
  firm: null,
  firmLoading: true,
  firmError: null,
};

const WorkspaceDataContext = createContext<WorkspaceDataValue | null>(null);

function subscribeCollection<T extends { id: string }>(
  db: ReturnType<typeof getClientDb>,
  collectionName: WorkspaceCollection,
  firmId: string,
  onChange: (state: CollectionState<T>) => void,
) {
  const source = collection(db, collectionName);
  const tenantQuery = query(source, where("firmId", "==", firmId));
  return onSnapshot(
    tenantQuery,
    (snapshot) => {
      const items = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id } as T));
      onChange({ items, loading: false, error: null });
    },
    () => onChange({ items: [], loading: false, error: `Could not load ${collectionName}. Check your workspace access.` }),
  );
}

function readLocalFirm(firmId: string): FirmProfile | null {
  const firms = readLocalCollection<FirmProfile>("firms").filter((firm) => firm.firmId === firmId || firm.id === firmId);
  return firms[0] ?? null;
}

function filterFirm<T extends { firmId: string }>(items: T[], firmId: string): T[] {
  return items.filter((item) => item.firmId === firmId);
}

export function WorkspaceDataProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const [data, setData] = useState<WorkspaceDataValue>(initialData);
  const localMode = isLocalMode();

  useEffect(() => {
    if (status !== "ready" || !user) {
      setData({ ...initialData, firmLoading: status === "loading" });
      return;
    }

    if (localMode) {
      const sync = () => {
        setData({
          matters: localCollectionState(filterFirm(readLocalCollection<Matter>("matters"), user.firmId)),
          clients: localCollectionState(filterFirm(readLocalCollection<Client>("clients"), user.firmId)),
          tasks: localCollectionState(filterFirm(readLocalCollection<Task>("tasks"), user.firmId)),
          invoices: localCollectionState(filterFirm(readLocalCollection<Invoice>("invoices"), user.firmId)),
          calendar: localCollectionState(filterFirm(readLocalCollection<CalendarEvent>("calendar"), user.firmId)),
          documents: localCollectionState(filterFirm(readLocalCollection<MatterDocument>("documents"), user.firmId)),
          team: localCollectionState(filterFirm(readLocalCollection<TeamMember>("team"), user.firmId)),
          firm: readLocalFirm(user.firmId),
          firmLoading: false,
          firmError: null,
        });
      };
      sync();
      return subscribeLocalStore(sync);
    }

    setData(initialData);
    const db = getClientDb();
    const update = <K extends keyof WorkspaceDataValue>(key: K, value: WorkspaceDataValue[K]) => {
      setData((previous) => ({ ...previous, [key]: value }));
    };
    const unsubscribers = [
      subscribeCollection<Matter>(db, "matters", user.firmId, (value) => update("matters", value)),
      subscribeCollection<Client>(db, "clients", user.firmId, (value) => update("clients", value)),
      subscribeCollection<Task>(db, "tasks", user.firmId, (value) => update("tasks", value)),
      subscribeCollection<Invoice>(db, "invoices", user.firmId, (value) => update("invoices", value)),
      subscribeCollection<CalendarEvent>(db, "calendar", user.firmId, (value) => update("calendar", value)),
      subscribeCollection<MatterDocument>(db, "documents", user.firmId, (value) => update("documents", value)),
      subscribeCollection<TeamMember>(db, "team", user.firmId, (value) => update("team", value)),
    ];
    const firmRef = collection(db, "firms");
    const firmQuery = query(firmRef, where("firmId", "==", user.firmId));
    const unsubscribeFirm = onSnapshot(
      firmQuery,
      (snapshot) => {
        const record = snapshot.docs[0];
        if (!record) {
          update("firm", null);
          update("firmLoading", false);
          return;
        }
        const profile = { ...record.data(), id: record.id } as FirmProfile;
        update("firm", profile);
        update("firmLoading", false);
        update("firmError", null);
      },
      () => {
        update("firmError", "Could not load firm settings.");
        update("firmLoading", false);
      },
    );
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribeFirm();
    };
  }, [status, user, localMode]);

  const value = useMemo(() => data, [data]);
  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}

export function useWorkspaceData(): WorkspaceDataValue {
  const value = useContext(WorkspaceDataContext);
  if (!value) throw new Error("useWorkspaceData must be used within WorkspaceDataProvider.");
  return value;
}
