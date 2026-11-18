import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { startInspection } from "@/app/actions/inspections";
import { SelectField, TextField } from "@/components/field";
import { formatIsoDate } from "@/lib/contractors";
import { requireUser } from "@/lib/data";
import { getTemplate, listInspectionApartments } from "@/lib/inspection-data";
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
  const apartments = template.type === "private_lot" ? await listInspectionApartments(user.selectedBuildingId) : [];
  const itemCount = template.areas.reduce((sum, area) => sum + area.items.length, 0);

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
        <form action={startInspection} className="mt-6 max-w-xl space-y-4">
          <input type="hidden" name="templateId" value={template.id} />
          <TextField
            label="Inspection date"
            name="inspectedAt"
            type="date"
            defaultValue={formatIsoDate(sydneyToday())}
            required
            error={error === "date" ? "Enter a valid inspection date." : undefined}
          />
          {template.type === "private_lot" ? (
            apartments.length === 0 ? (
              <p className="text-muted">Add an apartment before starting a private lot inspection.</p>
            ) : (
              <SelectField
                label="Apartment"
                name="apartmentId"
                defaultValue=""
                required
                error={error === "apartment" ? "Choose an apartment." : undefined}
              >
                <option value="">Choose an apartment</option>
                {apartments.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>
                    Apartment {apartment.number}
                  </option>
                ))}
              </SelectField>
            )
          ) : null}
          {template.type === "private_lot" && apartments.length === 0 ? null : (
            <button type="submit" className="rounded-md bg-brand-navy px-4 py-3 text-base font-medium text-white hover:bg-brand-blue">
              Start inspection
            </button>
          )}
        </form>
      )}
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
