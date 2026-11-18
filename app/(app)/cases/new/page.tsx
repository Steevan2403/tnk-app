import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseForm } from "@/components/case-form";
import { defaultCaseDates } from "@/lib/cases";
import { parseDateOnly } from "@/lib/contractors";
import { listCaseFormOptions, requireUser } from "@/lib/data";
import { maintenanceCaseSource } from "@/lib/maintenance-data";
import { canEditCases } from "@/lib/roles";

export const metadata: Metadata = { title: "New case" };

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canEditCases(user.role) || !user.selectedBuildingId) redirect("/cases");
  const params = await searchParams;
  const date = typeof params.date === "string" && parseDateOnly(params.date) ? params.date : "";
  const eventId = typeof params.event === "string" ? params.event : "";
  const on = typeof params.on === "string" ? params.on : "";
  const source = eventId && on ? await maintenanceCaseSource(user.selectedBuildingId, eventId, on) : null;
  const options = await listCaseFormOptions(user.selectedBuildingId, source?.draft.companyIds ?? []);
  const dates = source
    ? { startDate: source.draft.startDate, dueDate: source.draft.dueDate }
    : date
      ? { startDate: date, dueDate: date }
      : defaultCaseDates();

  return (
    <section>
      <Link href="/cases" className="text-sm text-brand-blue hover:underline">
        All cases
      </Link>
      <h1 className="mt-3 font-serif text-3xl">New case</h1>
      {options.types.length === 0 ? (
        <p className="mt-6 text-muted">Add a case type before adding a case.</p>
      ) : (
        <CaseForm
          types={options.types}
          assets={options.assets}
          apartments={options.apartments}
          companies={options.companies}
          dates={dates}
          draft={source?.draft}
          source={source ? { eventId: source.eventId, occursOn: source.occursOn } : undefined}
        />
      )}
    </section>
  );
}
