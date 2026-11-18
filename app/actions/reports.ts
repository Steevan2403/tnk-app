"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseReportRecipient } from "@/lib/inspections";
import { mailboxFor } from "@/lib/work-order-draft";
import { requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { createGeneratedReport } from "@/lib/report-data";
import { periodLabel, parseReportRequest, selectReportCases, type ReportSelection } from "@/lib/reports";
import { canManageReports } from "@/lib/roles";
import { copyStoredFile, removeUpload } from "@/lib/storage";

export type ReportFormState = { error?: string };

const denied = "You do not have permission to generate a report.";

function refresh() {
  revalidatePath("/building/reports");
  revalidatePath("/dashboard");
}

async function current() {
  const user = await requireUser();
  if (!user.selectedBuildingId) return null;
  return { ...user, buildingId: user.selectedBuildingId };
}

export async function generateReport(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  const user = await current();
  if (!user || !canManageReports(user.role)) return { error: denied };
  const parsed = parseReportRequest(formData);
  if (!parsed.ok) return { error: parsed.error };

  const cases = await prisma.case.findMany({
    where: { buildingId: user.buildingId },
    select: {
      id: true,
      number: true,
      startDate: true,
      subject: true,
      typeId: true,
      status: true,
      priority: true,
      includeInReport: true,
      apartmentId: true,
      type: { select: { name: true } },
      companies: { select: { companyId: true } },
      assets: { select: { assetId: true } },
    },
  });
  const selection: ReportSelection = { ...parsed.value.selection, excludedIds: [] };
  const eligible = selectReportCases(
    cases.map((item) => ({
      id: item.id,
      number: item.number,
      startDate: item.startDate,
      subject: item.subject,
      typeId: item.typeId,
      typeName: item.type.name,
      status: item.status,
      priority: item.priority,
      includeInReport: item.includeInReport,
      companyIds: item.companies.map((company) => company.companyId),
      assetIds: item.assets.map((asset) => asset.assetId),
      apartmentId: item.apartmentId,
    })),
    selection,
  );
  const picked = new Set(parsed.value.caseIds);
  selection.excludedIds = eligible.filter((item) => !picked.has(item.id)).map((item) => item.id);

  try {
    await createGeneratedReport({
      buildingId: user.buildingId,
      userId: user.id,
      userName: user.name,
      selection,
      sections: parsed.value.sections,
      format: parsed.value.format,
    });
  } catch (error) {
    console.error(error);
    return { error: "The report could not be generated." };
  }

  refresh();
  redirect("/building/reports?generated=1");
}

export async function deleteGeneratedReport(formData: FormData): Promise<void> {
  const user = await current();
  const id = String(formData.get("id") ?? "").trim();
  if (!user || !canManageReports(user.role)) redirect("/building/reports");
  const report = await prisma.generatedReport.findFirst({
    where: { id, buildingId: user.buildingId },
    select: { id: true, storedName: true },
  });
  if (!report) redirect("/building/reports");
  await prisma.generatedReport.delete({ where: { id: report.id } });
  await removeUpload(report.storedName);
  refresh();
  redirect("/building/reports");
}

export async function emailGeneratedReport(formData: FormData): Promise<void> {
  const user = await current();
  const id = String(formData.get("id") ?? "").trim();
  if (!user || !canManageReports(user.role)) redirect("/building/reports");
  const to = parseReportRecipient(String(formData.get("to") ?? ""));
  if (!to) redirect("/building/reports?error=email");
  const report = await prisma.generatedReport.findFirst({
    where: { id, buildingId: user.buildingId },
    select: {
      fileName: true,
      storedName: true,
      periodFrom: true,
      periodTo: true,
      building: { select: { name: true } },
    },
  });
  if (!report) redirect("/building/reports");
  const storedName = await copyStoredFile(report.storedName);
  if (!storedName) redirect("/building/reports?error=email");
  const period = periodLabel(report.periodFrom, report.periodTo);
  try {
    await mailboxFor(prisma).save({
      to,
      subject: `Management report for ${report.building.name}`,
      body: [
        `Management report for ${report.building.name}.`,
        "",
        period,
        "",
        `The file is attached (${report.fileName}).`,
        "",
        "TNK Property Services",
      ].join("\n"),
      attachmentNames: [report.fileName],
      attachments: [{ name: report.fileName, storedName }],
    });
  } catch (error) {
    await removeUpload(storedName);
    console.error(error);
    redirect("/building/reports?error=email");
  }
  revalidatePath("/settings/outbox");
  redirect("/building/reports?emailed=1");
}
