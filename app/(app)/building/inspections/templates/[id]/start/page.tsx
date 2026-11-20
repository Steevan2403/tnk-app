import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { startInspection } from "@/app/actions/inspections";
import { TextField } from "@/components/field";
import { JobAreaPicker } from "@/components/job-pickers";
import { isCaseArea, type CaseArea } from "@/lib/cases";
import { formatIsoDate } from "@/lib/contractors";
import { requireUser } from "@/lib/data";
import { getTemplate, listInspectionApartments, listInspectionAssets } from "@/lib/inspection-data";
import { formatInspectionType } from "@/lib/inspections";
import { sydneyToday } from "@/lib/maintenance";
import { canRunInspections } from "@/lib/roles";

export const metadata: Metadata = { title: "Start inspection" };

export default async function StartInspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canRunInspections(user.role) || !user.selectedBuildingId) redirect("/building/inspections");
  const template = await getTemplate(user.selectedBuildingId, (await params).id);
  if (!template) notFound();
  const query = await searchParams;
  const error = first(query.error);
  const areaQuery = first(query.area);
  const area: CaseArea = isCaseArea(areaQuery) ? areaQuery : "none";
  const [assets, apartments] = await Promise.all([
    listInspectionAssets(user.selectedBuildingId),
    listInspectionApartments(user.selectedBuildingId),
  ]);
  const itemCount = template.areas.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <section>
      <Link href="/building/inspections" className="text-sm text-brand-blue hover:underline">
        Inspections
      </Link>
      <h1 className="mt-3 font-serif text-3xl">Start inspection</h1>
      <p className="mt-2 text-muted">
        {template.name} · {formatInspectionType(template.type)}
      </p>
      {template.description ? <p className="mt-2 max-w-2xl">{template.description}</p> : null}
      {itemCount === 0 ? <p className="mt-6 text-muted">Add items to this template before starting an inspection.</p> : null}
      {error === "empty" ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Add items to this template before starting an inspection.
        </p>
      ) : null}
      {itemCount === 0 ? null : (
        <form action={startInspection} className="form-card mt-6 max-w-xl space-y-4">
          <input type="hidden" name="templateId" value={template.id} />
          <TextField
            label="Inspection date"
            name="inspectedAt"
            type="date"
            defaultValue={formatIsoDate(sydneyToday())}
            required
            error={error === "date" ? "Enter a valid inspection date." : undefined}
          />
          <JobAreaPicker
            assets={assets}
            apartments={apartments}
            area={area}
            assetIds={[]}
            apartmentId=""
            errors={{
              area: error === "area" ? "Choose a job area." : undefined,
              assetIds: error === "asset" ? "Choose an asset in this building." : undefined,
              apartmentId: error === "apartment" ? "Choose an apartment in this building." : undefined,
            }}
          />
          <button type="submit" className="rounded-md bg-brand-navy px-4 py-3 text-base font-medium text-white hover:bg-brand-blue">
            Start inspection
          </button>
        </form>
      )}
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
