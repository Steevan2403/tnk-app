import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAddress } from "@/lib/buildings";
import { formatDuration, formatLocation, openSiteVisit } from "@/lib/check-in";
import { formatDateTime } from "@/lib/contractors";
import { getWorkOrderDetail, requireUser } from "@/lib/data";
import { workOrderLinks } from "@/lib/work-order-terms";
import { StatusBadge } from "@/components/ui";
import { formatWorkOrderStatus, workOrderNumber } from "@/lib/work-orders";

export const metadata: Metadata = { title: "Work order" };

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) notFound();
  const record = await getWorkOrderDetail(user.selectedBuildingId, id);
  if (!record) notFound();

  const number = workOrderNumber(record.case.number, record.suffix);
  const open = openSiteVisit(record.visits);
  const address = formatAddress(record.case.building);
  const checkInUrl = workOrderLinks(record.id, record.checkInToken).checkInUrl;

  return (
    <section className="max-w-3xl">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/work-orders" className="text-brand-blue hover:underline">
              Work Orders
            </Link>
          </li>
          <li aria-hidden="true" className="text-muted">
            /
          </li>
          <li className="text-muted">{number}</li>
        </ol>
      </nav>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Work order {number}</h1>
          <p className="mt-2 text-muted">{record.case.subject}</p>
          <div className="mt-3">
            <StatusBadge status={record.status} label={formatWorkOrderStatus(record.status)} />
          </div>
        </div>
      </div>
      {open ? (
        <p role="status" className="mt-4 rounded-lg border border-brand-green/40 bg-brand-green/10 px-4 py-3">
          <span className="font-medium">{open.contractorName}</span> is on site since {formatDateTime(open.checkedInAt)}.
        </p>
      ) : (
        <p className="mt-4 text-muted">No contractor is on site.</p>
      )}
      <dl className="mt-6 grid gap-4 rounded-xl border border-line bg-card p-4 sm:grid-cols-2 md:p-5">
        <Detail label="Building" value={record.case.building.name} />
        <Detail label="Address" value={address} />
        <Detail label="Contractor" value={record.companyName} />
        <Detail label="Contact" value={record.contactName} />
        <Detail label="Sent" value={`${formatDateTime(record.sentAt)} · ${record.sentBy.name}`} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href={`/cases/${record.case.number}`} className="text-brand-blue hover:underline">
          Case #{record.case.number}
        </Link>
        <a href={`/api/work-orders/${record.id}/pdf`} className="text-brand-blue hover:underline">
          PDF
        </a>
        <Link href={`/work-orders/${record.id}/email`} className="text-brand-blue hover:underline">
          Email
        </Link>
      </div>
      <p className="mt-3 break-all text-sm">
        <span className="text-muted">Check-in link </span>
        <a href={checkInUrl} className="text-brand-blue hover:underline">
          {checkInUrl}
        </a>
      </p>

      <section className="mt-8 rounded-xl border border-line bg-card p-4">
        <h2 className="text-lg font-semibold tracking-tight text-brand-navy">On-site history</h2>
        {record.visits.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No one has checked in yet.</p> : null}
        <ul className="mt-2 divide-y divide-line">
          {record.visits.map((visit) => {
            const checkInLocation = formatLocation(visit.checkInLatitude, visit.checkInLongitude);
            const checkOutLocation = formatLocation(visit.checkOutLatitude, visit.checkOutLongitude);
            return (
              <li key={visit.id} className="py-3">
                <p className="font-medium">{visit.contractorName}</p>
                <p className="mt-1 text-sm">Checked in {formatDateTime(visit.checkedInAt)}</p>
                {visit.checkedOutAt ? (
                  <p className="text-sm">Checked out {formatDateTime(visit.checkedOutAt)}</p>
                ) : (
                  <p className="text-sm">Still on site</p>
                )}
                <p className="text-sm text-muted">
                  Time on site: {visit.checkedOutAt ? formatDuration(visit.checkedInAt, visit.checkedOutAt) : "On site"}
                </p>
                {checkInLocation ? <p className="text-sm text-muted">Check-in location {checkInLocation}</p> : null}
                {checkOutLocation ? <p className="text-sm text-muted">Check-out location {checkOutLocation}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
