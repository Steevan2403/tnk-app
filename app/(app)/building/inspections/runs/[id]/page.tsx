import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { completeInspection, createInspectionCases, removeInspectionPhoto, reopenInspection } from "@/app/actions/inspections";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ItemAnswer } from "@/components/inspection-item-form";
import { requireUser } from "@/lib/data";
import { getRun } from "@/lib/inspection-data";
import { formatAddress } from "@/lib/buildings";
import { formatInspectionType, formatSydneyDate, progressCount, resultCounts } from "@/lib/inspections";
import { formatDateTime } from "@/lib/cases";
import { canEditCases, canManageInspectionTemplates, canRunInspections } from "@/lib/roles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  if (!user.selectedBuildingId) return { title: "Inspection" };
  const run = await getRun(user.selectedBuildingId, (await params).id);
  return { title: run?.name ?? "Inspection" };
}

export default async function InspectionRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId || !canRunInspections(user.role)) notFound();
  const run = await getRun(user.selectedBuildingId, id);
  if (!run) notFound();

  const query = await searchParams;
  const photoError = first(query.photo);
  const error = first(query.error);
  const emailed = first(query.emailed) === "1";
  const items = run.areas.flatMap((area) => area.items);
  const progress = progressCount(items);
  const counts = resultCounts(items);
  const readOnly = run.status === "completed";
  const canReopen = canManageInspectionTemplates(user.role);
  const canCreateCase = canEditCases(user.role);
  const unanswered = counts.unanswered;
  const failedWithoutCase = items.filter((item) => item.result === "fail" && !item.linkedCase).length;
  const width = progress.total === 0 ? 0 : Math.round((progress.answered / progress.total) * 100);

  return (
    <section>
      <Link
        href={readOnly ? "/building/inspections?tab=completed" : "/building/inspections?tab=progress"}
        className="text-sm text-brand-blue hover:underline"
      >
        Inspections
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{run.name}</h1>
          <p className="mt-2 text-muted">
            {formatInspectionType(run.type)} · {run.building.name}
            {run.type === "private_lot" ? ` · Apartment ${run.apartment?.number ?? "not recorded"}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            {run.inspector.name} · {formatSydneyDate(run.inspectedAt)}
            {run.completedAt ? ` · Completed ${formatDateTime(run.completedAt)}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">{formatAddress(run.building)}</p>
        </div>
        {readOnly ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <a href={`/api/inspections/${run.id}/pdf?download=1`} className="text-brand-blue hover:underline">
              Download PDF
            </a>
            {canReopen ? (
              <Link href={`/building/inspections/runs/${run.id}/email`} className="text-brand-blue hover:underline">
                Email report
              </Link>
            ) : null}
            {canReopen ? (
              <form action={reopenInspection}>
                <input type="hidden" name="runId" value={run.id} />
                <ConfirmSubmit
                  label="Reopen inspection"
                  message="Reopen this inspection for editing?"
                  className="text-brand-blue hover:underline"
                />
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {emailed ? <p className="mt-4 rounded-md bg-card px-3 py-2 text-sm ring-1 ring-line">The report is in the outbox.</p> : null}
      {error === "save" ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          That answer could not be saved.
        </p>
      ) : null}
      {error === "confirm" ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Confirm completion when some items are unanswered.
        </p>
      ) : null}
      {error === "type" ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Add the Repair & maintenance case type before creating a case.
        </p>
      ) : null}
      {error === "case" ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          A case could not be created for every failed item.
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-line bg-card p-4">
        <p className="text-sm font-medium">
          {counts.pass} pass · {counts.fail} fail · {counts.na} not applicable
          {readOnly ? ` · ${counts.unanswered} unanswered` : ""}
        </p>
        <div
          role="progressbar"
          aria-label="Inspection progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.answered}
          className="mt-3 h-3 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full bg-brand-blue" style={{ width: `${width}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {progress.answered} of {progress.total} items answered
        </p>
        {readOnly && canCreateCase && failedWithoutCase > 0 ? (
          <form action={createInspectionCases} className="mt-4">
            <input type="hidden" name="runId" value={run.id} />
            <input type="hidden" name="mode" value="all" />
            <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
              Create cases for all failed items
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        {run.areas.map((area) => {
          const areaItems = area.items;
          const areaProgress = progressCount(areaItems);
          return (
            <details key={area.id} open className="rounded-xl border border-line bg-card">
              <summary className="cursor-pointer px-4 py-3 text-lg font-medium">
                {area.name}
                <span className="ml-2 text-sm font-normal text-muted">
                  {areaProgress.answered} of {areaProgress.total}
                </span>
              </summary>
              <div className="space-y-4 px-4 pb-4">
                {area.items.map((item) => (
                  <article
                    key={`${item.id}-${item.result ?? ""}-${item.comment ?? ""}-${item.photos.length}`}
                    id={`item-${item.id}`}
                    aria-label={item.name}
                    className="scroll-mt-24 rounded-lg border border-line p-3"
                  >
                    <h2 className="text-base font-medium">{item.name}</h2>
                    {item.guidance ? <p className="mt-1 text-sm text-muted">{item.guidance}</p> : null}
                    <ItemAnswer runId={run.id} item={item} readOnly={readOnly} />
                    {photoError === item.id ? (
                      <p role="alert" className="mt-2 text-sm text-danger">
                        That photo could not be saved. Use a PNG, JPEG, WebP, or GIF under 10 MB.
                      </p>
                    ) : null}
                    {item.photos.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-3">
                        {item.photos.map((photo) => (
                          <li key={photo.id} className="space-y-1">
                            {/* Local inspection photos are served by this app. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/inspection-photos/${photo.id}`} alt={photo.name} className="h-24 w-24 rounded-md object-cover" />
                            {readOnly ? null : (
                              <form action={removeInspectionPhoto}>
                                <input type="hidden" name="runId" value={run.id} />
                                <input type="hidden" name="photoId" value={photo.id} />
                                <button type="submit" className="text-sm text-danger">
                                  Remove photo
                                </button>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {item.result === "fail" && item.linkedCase ? (
                      <p className="mt-3 text-sm">
                        <Link href={`/cases/${item.linkedCase.number}`} className="text-brand-blue hover:underline">
                          Case #{item.linkedCase.number}
                        </Link>
                      </p>
                    ) : null}
                    {item.result === "fail" && !item.linkedCase && canCreateCase ? (
                      <form action={createInspectionCases} className="mt-3">
                        <input type="hidden" name="runId" value={run.id} />
                        <input type="hidden" name="mode" value="one" />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button type="submit" aria-label={`Create case for ${item.name}`} className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
                          Create case
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {readOnly ? null : (
        <form action={completeInspection} className="mt-6">
          <input type="hidden" name="runId" value={run.id} />
          <input type="hidden" name="confirmed" value="yes" />
          {unanswered > 0 ? (
            <ConfirmSubmit
              label="Complete inspection"
              message={`${unanswered} ${unanswered === 1 ? "item has" : "items have"} no result. Complete the inspection with those items unanswered?`}
              className="w-full rounded-md bg-brand-navy px-4 py-3 text-base font-medium text-white hover:bg-brand-blue sm:w-auto"
            />
          ) : (
            <button type="submit" className="w-full rounded-md bg-brand-navy px-4 py-3 text-base font-medium text-white hover:bg-brand-blue sm:w-auto">
              Complete inspection
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
