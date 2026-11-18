import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MaintenanceFileDeletes, MaintenanceForm, type MaintenanceFormValues } from "@/components/maintenance-form";
import { formatIsoDate } from "@/lib/contractors";
import { listCaseFormOptions, requireUser } from "@/lib/data";
import { isFrequency, sydneyToday } from "@/lib/maintenance";
import { getMaintenance } from "@/lib/maintenance-data";
import { canManageMaintenance } from "@/lib/roles";
import type { CaseArea } from "@/lib/cases";

export const metadata: Metadata = { title: "Edit maintenance" };

export default async function EditMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageMaintenance(user.role) || !user.selectedBuildingId) redirect("/maintenance");
  const { id } = await params;
  const event = await getMaintenance(user.selectedBuildingId, id);
  if (!event || !isFrequency(event.frequency)) notFound();
  const options = await listCaseFormOptions(
    user.selectedBuildingId,
    event.companies.map((link) => link.companyId),
  );
  const values: MaintenanceFormValues = {
    id: event.id,
    subject: event.subject,
    description: event.description,
    notes: event.notes ?? "",
    startDate: formatIsoDate(event.startDate),
    endDate: event.endDate ? formatIsoDate(event.endDate) : "",
    noEnd: event.endDate == null,
    frequency: event.frequency,
    intervalMonths: event.intervalMonths ? String(event.intervalMonths) : "",
    remindContractor: event.remindContractor,
    reminderDays: String(event.reminderDays),
    area: event.area as CaseArea,
    assetIds: event.assets.map((link) => link.assetId),
    apartmentId: event.apartmentId ?? "",
    companyIds: event.companies.map((link) => link.companyId),
    contactIds: event.contacts.map((link) => link.contactId),
    files: event.files.map((file) => ({ id: file.id, name: file.name, kind: file.kind })),
  };

  return (
    <section>
      <Link href="/maintenance" className="text-sm text-brand-blue hover:underline">
        All maintenance
      </Link>
      <h1 className="mt-3 font-serif text-3xl">Edit maintenance</h1>
      <MaintenanceForm
        assets={options.assets}
        apartments={options.apartments}
        companies={options.companies}
        startDate={formatIsoDate(sydneyToday())}
        event={values}
      />
      <MaintenanceFileDeletes files={values.files} />
    </section>
  );
}
