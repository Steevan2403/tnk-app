import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaseForm, type CaseFormValues } from "@/components/case-form";
import { defaultCaseDates, formatIsoDate, parseCaseNumber } from "@/lib/cases";
import { getCaseByNumber, listCaseFormOptions, requireUser } from "@/lib/data";
import { canEditCases } from "@/lib/roles";

export const metadata: Metadata = { title: "Edit case" };

export default async function EditCasePage({ params }: { params: Promise<{ number: string }> }) {
  const user = await requireUser();
  const number = parseCaseNumber((await params).number);
  if (!user.selectedBuildingId || number == null) notFound();
  if (!canEditCases(user.role)) redirect(`/cases/${number}`);

  const record = await getCaseByNumber(user.selectedBuildingId, number);
  if (!record) notFound();

  const options = await listCaseFormOptions(
    user.selectedBuildingId,
    record.companies.map((link) => link.company.id),
  );
  const values: CaseFormValues = {
    number: record.number,
    typeId: record.typeId,
    purchaseOrderNumber: record.purchaseOrderNumber ?? "",
    startDate: formatIsoDate(record.startDate),
    dueDate: formatIsoDate(record.dueDate),
    priority: record.priority,
    status: record.status,
    area: record.area,
    assetIds: record.assets.map((link) => link.asset.id),
    apartmentId: record.apartmentId ?? "",
    companyIds: record.companies.map((link) => link.company.id),
    contactIds: record.contacts.map((link) => link.contact.id),
    subject: record.subject,
    descriptionHtml: record.descriptionHtml,
    internalNotes: record.internalNotes ?? "",
    includeInReport: record.includeInReport,
  };

  return (
    <section>
      <Link href={`/cases/${record.number}`} className="text-sm text-brand-blue hover:underline">
        Case #{record.number}
      </Link>
      <h1 className="mt-3 font-serif text-3xl">Edit case</h1>
      <CaseForm
        types={options.types}
        assets={options.assets}
        apartments={options.apartments}
        companies={options.companies}
        dates={defaultCaseDates()}
        caseRecord={values}
      />
    </section>
  );
}
