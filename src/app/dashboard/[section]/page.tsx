import { notFound } from "next/navigation";
import { SectionView } from "@/components/views/section-view";

const allowedSections = new Set(["matters", "clients", "calendar", "tasks", "documents", "billing", "team"]);

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!allowedSections.has(section)) notFound();
  return <SectionView section={section} />;
}
