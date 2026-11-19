import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { addCaseToCalendar, deleteCase, deleteCaseFile, setCaseStatus, toggleCaseStar } from "@/app/actions/cases";
import { CaseFileForm, CommentForm } from "@/components/case-record-forms";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SelectField } from "@/components/field";
import { MoreActions } from "@/components/more-actions";
import { PriorityBadge } from "@/components/priority-badge";
import { EmptyState, Panel, StatusBadge } from "@/components/ui";
import { sanitizeCaseHtml } from "@/lib/case-html";
import {
  CASE_FILE_KINDS,
  CASE_STATUSES,
  caseStatusSurface,
  fileKindLabel,
  formatArea,
  formatCalendarDate,
  formatDateTime,
  formatIsoDate,
  formatStatus,
  isCaseOverdue,
  parseCaseNumber,
  type CaseFileKind,
} from "@/lib/cases";
import { openSiteVisit, siteVisitActivity } from "@/lib/check-in";
import { formatWorkOrderStatus, omittedAttachmentNotice, workOrderNumber } from "@/lib/work-orders";
import { caseNeighbors, caseStarred, getCaseByNumber, requireUser, type CaseDetail } from "@/lib/data";
import { caseCalendarHref, caseCalendarOffer } from "@/lib/maintenance";
import { canDeleteCases, canEditCases } from "@/lib/roles";

const FILE_LABELS: Record<CaseFileKind, string> = {
  photo: "Photo",
  video: "Video",
  quote: "Quote",
  invoice: "Invoice",
  document: "Document",
};

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const number = parseCaseNumber((await params).number);
  const user = await requireUser();
  if (!user.selectedBuildingId || number == null) return { title: "Case" };
  const record = await getCaseByNumber(user.selectedBuildingId, number);
  return { title: record ? `#${record.number} ${record.subject}` : "Case" };
}

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const number = parseCaseNumber((await params).number);
  const query = await searchParams;
  if (!user.selectedBuildingId || number == null) notFound();

  const record = await getCaseByNumber(user.selectedBuildingId, number);
  if (!record) notFound();

  const [neighbors, starred] = await Promise.all([
    caseNeighbors(user.selectedBuildingId, number),
    caseStarred(user.id, record.id),
  ]);
  const canEdit = canEditCases(user.role);
  const canDelete = canDeleteCases(user.role);
  const calendarOffer = caseCalendarOffer(user.role, record.maintenanceEvent?.id ?? null);
  const calendarOn = formatIsoDate(record.occurrenceOn ?? record.dueDate);
  const statusSurface = caseStatusSurface(canEdit);
  const replyTo = first(query.reply);
  const mailNotice = omittedAttachmentNotice(first(query.sent), many(query.omitted));
  const overdue = isCaseOverdue(record);
  const description = sanitizeCaseHtml(record.descriptionHtml);
  const topComments = record.comments.filter((comment) => !comment.parentId);
  const replies = record.comments.filter((comment) => comment.parentId);

  return (
    <section>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/cases" className="text-brand-blue hover:underline">
              Cases
            </Link>
          </li>
          <li aria-hidden="true" className="text-muted">
            /
          </li>
          <li className="text-muted">#{record.number}</li>
        </ol>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">{record.subject}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-muted">
            <span>Case #{record.number}</span>
            {statusSurface === "badge" ? (
              <span data-case-status="badge">
                <StatusBadge status={record.status} label={formatStatus(record.status)} />
              </span>
            ) : null}
            <PriorityBadge priority={record.priority} />
          </p>
          {record.maintenanceEvent && record.occurrenceOn ? (
            <p className="mt-2 text-sm text-muted">
              From maintenance{" "}
              <Link
                href={`/calendar?event=${record.maintenanceEvent.id}&on=${formatIsoDate(record.occurrenceOn)}`}
                className="text-brand-blue hover:underline"
              >
                {record.maintenanceEvent.subject}
              </Link>{" "}
              · due {formatCalendarDate(record.occurrenceOn)}
            </p>
          ) : null}
          {record.inspectionItem ? (
            <p className="mt-2 text-sm text-muted">
              From inspection{" "}
              <Link href={`/building/inspections/runs/${record.inspectionItem.area.run.id}`} className="text-brand-blue hover:underline">
                {record.inspectionItem.area.run.name}
              </Link>{" "}
              · {record.inspectionItem.area.name} · {record.inspectionItem.name}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-3 text-sm">
            {neighbors.previousNumber ? (
              <Link href={`/cases/${neighbors.previousNumber}`} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {neighbors.nextNumber ? (
              <Link href={`/cases/${neighbors.nextNumber}`} className="text-brand-blue hover:underline">
                Next
              </Link>
            ) : (
              <span className="text-muted">Next</span>
            )}
          </div>
          <form action={toggleCaseStar}>
            <input type="hidden" name="number" value={record.number} />
            <input type="hidden" name="returnTo" value={`/cases/${record.number}`} />
            <button type="submit" aria-pressed={starred} className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue">
              {starred ? "Starred" : "Star"}
            </button>
          </form>
          {calendarOffer === "linked" && record.maintenanceEvent ? (
            <Link
              href={caseCalendarHref(record.maintenanceEvent.id, calendarOn)}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue"
            >
              On calendar
            </Link>
          ) : null}
          {calendarOffer === "add" ? (
            <form action={addCaseToCalendar}>
              <input type="hidden" name="number" value={record.number} />
              <button
                type="submit"
                className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue"
              >
                Add to calendar
              </button>
            </form>
          ) : null}
          {canEdit ? (
            <Link href={`/cases/${record.number}/work-order`} className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue">
              Send work order
            </Link>
          ) : null}
          {canEdit ? (
            <Link href={`/cases/${record.number}/edit`} className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue">
              Edit
            </Link>
          ) : null}
          {canDelete ? (
            <MoreActions>
              <form action={deleteCase}>
                <input type="hidden" name="number" value={record.number} />
                <ConfirmSubmit
                  role="menuitem"
                  label="Delete case"
                  message="Delete this case, including its files, comments, and activity?"
                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-red-50"
                />
              </form>
            </MoreActions>
          ) : null}
        </div>
      </div>

      {mailNotice ? (
        <p role="status" className="mt-4 rounded-lg border border-line bg-card px-4 py-3 text-sm">
          {mailNotice}
        </p>
      ) : null}

      {statusSurface === "dropdown" ? (
        <form action={setCaseStatus} data-case-status="dropdown" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="number" value={record.number} />
          <input type="hidden" name="returnTo" value={`/cases/${record.number}`} />
          <SelectField label="Status" name="status" defaultValue={record.status}>
            {CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </SelectField>
          <button type="submit" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue">
            Update status
          </button>
        </form>
      ) : null}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Case information">
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Type" value={record.type.name} />
            <Field label="Purchase order" value={blank(record.purchaseOrderNumber)} />
            <Field label="Start date" value={formatCalendarDate(record.startDate)} />
            <Field label="Due date">
              <time dateTime={formatIsoDate(record.dueDate)} className={overdue ? "font-medium text-danger" : undefined}>
                {formatCalendarDate(record.dueDate)}
                {overdue ? " · Overdue" : ""}
              </time>
            </Field>
            <Field label="Priority">
              <PriorityBadge priority={record.priority} />
            </Field>
            <Field label="Management report" value={record.includeInReport ? "Included" : "Not included"} />
            <Field label="Completed" value={record.completedAt ? formatDateTime(record.completedAt) : "—"} />
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Opened</dt>
              <dd className="mt-1">
                {record.createdBy.name} · {formatDateTime(record.createdAt)}
              </dd>
            </div>
          </dl>
        </Panel>

        <div className="space-y-6">
          <Panel title="Job area">
            <p className="mt-3 text-sm text-muted">{formatArea(record.area)}</p>
            {record.area === "asset" ? <AssetLinks record={record} /> : null}
            {record.area === "apartment" ? <ApartmentLink record={record} /> : null}
            {record.area === "none" ? <p className="mt-3">{formatArea(record.area)}</p> : null}
          </Panel>
          <Panel title="Assigned contractors">
            <Assigned record={record} />
          </Panel>
        </div>

        <Panel title="Job">
          <h3 className="mt-3 text-lg font-medium">{record.subject}</h3>
          {description ? (
            <div className="case-html mt-3" dangerouslySetInnerHTML={{ __html: description }} />
          ) : (
            <p className="mt-3 text-muted">No description.</p>
          )}
        </Panel>

        <Panel title="Internal notes">
          {record.internalNotes ? (
            <p className="mt-3 whitespace-pre-wrap">{record.internalNotes}</p>
          ) : (
            <p className="mt-3 text-muted">No internal notes.</p>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Work orders">
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {record.workOrders.length === 0
                ? "No work orders yet."
                : record.workOrders.length === 1
                  ? "1 sent"
                  : `${record.workOrders.length} sent`}
            </p>
            {canEdit ? (
              <Link href={`/cases/${record.number}/work-order`} className="text-sm text-brand-blue hover:underline">
                Send work order
              </Link>
            ) : null}
          </div>
          {record.workOrders.length > 0 ? (
            <ul className="mt-2 divide-y divide-line">
              {record.workOrders.map((order) => {
                const number = workOrderNumber(record.number, order.suffix);
                const onSite = openSiteVisit(order.visits);
                return (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/work-orders/${order.id}`} className="font-medium text-brand-blue hover:underline">
                        {number}
                      </Link>
                      <p className="text-sm text-muted">
                        {order.company?.name ?? order.companyName} · {order.contact?.name ?? order.contactName} ·{" "}
                        {formatWorkOrderStatus(order.status)} · {formatDateTime(order.sentAt)}
                      </p>
                      {onSite ? <p className="text-sm text-brand-green">On site · {onSite.contractorName}</p> : null}
                    </div>
                    <a href={`/api/work-orders/${order.id}/pdf`} className="text-sm text-brand-blue hover:underline">
                      PDF
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Panel>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        {CASE_FILE_KINDS.map((kind) => (
          <FileSection
            key={kind}
            kind={kind}
            record={record}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Comments">
          {topComments.length === 0 ? <EmptyState>No comments yet.</EmptyState> : null}
          <ul className="mt-2 divide-y divide-line">
            {topComments.map((comment) => (
              <li key={comment.id} className="py-3">
                <CommentBody name={comment.author.name} time={comment.createdAt} body={comment.body} />
                <ul className="mt-2 ml-6 space-y-3 border-l border-line pl-4">
                  {replies
                    .filter((reply) => reply.parentId === comment.id)
                    .map((reply) => (
                      <li key={reply.id}>
                        <CommentBody name={reply.author.name} time={reply.createdAt} body={reply.body} />
                      </li>
                    ))}
                </ul>
                {canEdit && replyTo === comment.id ? (
                  <CommentForm caseNumber={record.number} parentId={comment.id} />
                ) : canEdit ? (
                  <Link href={`/cases/${record.number}?reply=${comment.id}`} className="mt-2 inline-block text-sm text-brand-blue hover:underline">
                    Reply
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? <CommentForm caseNumber={record.number} /> : null}
        </Panel>

        <Panel title="Activity">
          <CaseActivity record={record} />
        </Panel>
      </div>
    </section>
  );
}

function AssetLinks({ record }: { record: CaseDetail }) {
  if (record.assets.length === 0) return <p className="mt-3 text-muted">No assets linked.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {[...record.assets]
        .sort((a, b) => a.asset.name.localeCompare(b.asset.name, "en"))
        .map((link) => (
          <li key={link.asset.id}>
            <Link href={`/building/assets/${link.asset.id}`} className="text-brand-blue hover:underline">
              {link.asset.name}
            </Link>
          </li>
        ))}
    </ul>
  );
}

function ApartmentLink({ record }: { record: CaseDetail }) {
  if (!record.apartment) return <p className="mt-3 text-muted">Apartment removed.</p>;
  return (
    <p className="mt-3">
      <Link href={`/residents/apartments/${record.apartment.id}`} className="text-brand-blue hover:underline">
        Apartment {record.apartment.number}
      </Link>
    </p>
  );
}

function Assigned({ record }: { record: CaseDetail }) {
  if (record.companies.length === 0) return <p className="mt-3 text-muted">No contractor assigned.</p>;
  const companies = [...record.companies].sort((a, b) => a.company.name.localeCompare(b.company.name, "en"));
  return (
    <ul className="mt-3 space-y-3">
      {companies.map((link) => {
        const people = record.contacts
          .filter((contact) => contact.contact.companyId === link.company.id)
          .sort((a, b) => a.contact.name.localeCompare(b.contact.name, "en"));
        return (
          <li key={link.company.id}>
            <Link href={`/contractors/${link.company.id}`} className="font-medium text-brand-blue hover:underline">
              {link.company.name}
            </Link>
            {people.length > 0 ? (
              <ul className="mt-1 text-sm">
                {people.map((person) => (
                  <li key={person.contact.id}>{person.contact.name}</li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function FileSection({
  kind,
  record,
  canEdit,
  canDelete,
}: {
  kind: CaseFileKind;
  record: CaseDetail;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const files = record.files.filter((file) => file.kind === kind);
  const title = `${FILE_LABELS[kind]}s`;
  return (
    <Panel title={title}>
      {files.length === 0 ? <EmptyState>No {fileKindLabel(kind)}s yet.</EmptyState> : null}
      {kind === "photo" && files.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((file) => (
            <li key={file.id}>
              <a href={`/api/case-files/${file.id}`}>
                <GalleryImage name={file.name} src={`/api/case-files/${file.id}`} />
              </a>
              <p className="mt-2 truncate text-sm">{file.name}</p>
              {canDelete ? <RemoveFile caseNumber={record.number} fileId={file.id} name={file.name} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {kind === "video" && files.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {files.map((file) => (
            <li key={file.id}>
              <video controls src={`/api/case-files/${file.id}`} className="w-full max-w-md rounded-md" />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a href={`/api/case-files/${file.id}`} className="text-sm text-brand-blue hover:underline">
                  Download {file.name}
                </a>
                {canDelete ? <RemoveFile caseNumber={record.number} fileId={file.id} name={file.name} /> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {kind !== "photo" && kind !== "video" && files.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted">
                  {file.uploadedBy.name} · {formatCalendarDate(file.uploadedAt)}
                </p>
              </div>
              <div className="flex gap-3">
                <a href={`/api/case-files/${file.id}`} className="text-sm text-brand-blue hover:underline">
                  Download
                </a>
                {canDelete ? <RemoveFile caseNumber={record.number} fileId={file.id} name={file.name} /> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? <CaseFileForm caseNumber={record.number} kind={kind} label={FILE_LABELS[kind]} /> : null}
    </Panel>
  );
}

function RemoveFile({ caseNumber, fileId, name }: { caseNumber: number; fileId: string; name: string }) {
  return (
    <form action={deleteCaseFile}>
      <input type="hidden" name="number" value={caseNumber} />
      <input type="hidden" name="fileId" value={fileId} />
      <button type="submit" aria-label={`Remove ${name}`} className="text-sm text-danger hover:underline">
        Remove
      </button>
    </form>
  );
}

function CommentBody({ name, time, body }: { name: string; time: Date; body: string }) {
  return (
    <div>
      <p className="text-sm text-muted">
        {name} · {formatDateTime(time)}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1">{children ?? value}</dd>
    </div>
  );
}

function CaseActivity({ record }: { record: CaseDetail }) {
  const lines = [
    ...record.activities.map((activity) => ({
      id: activity.id,
      at: activity.createdAt,
      actorName: activity.actor.name,
      summary: activity.summary,
    })),
    ...siteVisitActivity(
      record.workOrders.map((order) => ({
        id: order.id,
        suffix: order.suffix,
        caseNumber: record.number,
        visits: order.visits,
      })),
    ),
  ].sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));

  if (lines.length === 0) return <EmptyState>No activity yet.</EmptyState>;
  return (
    <ul className="mt-2 divide-y divide-line">
      {lines.map((activity) => (
        <li key={activity.id} className="py-3">
          <p>{activity.summary}</p>
          <p className="text-sm text-muted">
            {activity.actorName} · {formatDateTime(activity.at)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function GalleryImage({ name, src }: { name: string; src: string }) {
  return (
    // The file route checks the signed-in user, which the image optimizer does not.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="aspect-square w-full rounded-md object-cover" />
  );
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

function many(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw.map((item) => item.trim()).filter(Boolean);
}

function blank(value: string | null): string {
  return value && value.trim() ? value : "—";
}
