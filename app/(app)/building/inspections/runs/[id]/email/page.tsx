import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmailReportForm } from "@/components/inspection-email-form";
import { requireUser } from "@/lib/data";
import { getRun } from "@/lib/inspection-data";
import { formatSydneyDate, inspectionPdfName, reportMessage } from "@/lib/inspections";
import { canManageInspectionTemplates, canRunInspections } from "@/lib/roles";

export const metadata: Metadata = { title: "Email inspection report" };

export default async function InspectionEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canRunInspections(user.role) || !canManageInspectionTemplates(user.role) || !user.selectedBuildingId) {
    redirect("/building/inspections");
  }
  const run = await getRun(user.selectedBuildingId, (await params).id);
  if (!run || run.status !== "completed") notFound();

  const pdfName = inspectionPdfName(run.name);
  const message = reportMessage({
    inspectionName: run.name,
    buildingName: run.building.name,
    inspectorName: run.inspector.name,
    completedLabel: run.completedAt ? formatSydneyDate(run.completedAt) : formatSydneyDate(run.inspectedAt),
    pdfName,
  });

  return (
    <section>
      <Link href={`/building/inspections/runs/${run.id}`} className="text-sm text-brand-blue hover:underline">
        {run.name}
      </Link>
      <h1 className="mt-3 font-serif text-3xl">Email report</h1>
      <p className="mt-2 max-w-2xl text-muted">This queues the report in the outbox. It is not sent to a real inbox.</p>
      <EmailReportForm runId={run.id} subject={message.subject} body={message.body} />
    </section>
  );
}
