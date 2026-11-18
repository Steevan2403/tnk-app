import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/contractors";
import { getWorkOrderMessage, requireUser } from "@/lib/data";
import { workOrderNumber } from "@/lib/work-orders";

export const metadata: Metadata = { title: "Work order email" };

export default async function WorkOrderEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!user.selectedBuildingId) notFound();
  const record = await getWorkOrderMessage(user.selectedBuildingId, id);
  if (!record) notFound();
  const number = workOrderNumber(record.case.number, record.suffix);
  const message = record.messages[0];

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
      <h1 className="mt-3 font-serif text-3xl">Email for {number}</h1>
      <p className="mt-2 text-muted">{record.case.subject}</p>
      {!message ? (
        <p className="mt-6 text-muted">No email was recorded for this work order.</p>
      ) : (
        <article className="mt-6 rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-muted">{formatDateTime(message.createdAt)}</p>
          <p className="mt-3">
            <span className="text-muted">To </span>
            {message.toAddress}
          </p>
          <h2 className="mt-3 text-lg font-medium">{message.subject}</h2>
          <p className="mt-3 whitespace-pre-wrap">{message.body}</p>
          {message.attachments.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {message.attachments.map((attachment) => (
                <li key={attachment.id}>
                  <a href={`/api/work-orders/${record.id}/pdf`} className="text-brand-blue hover:underline">
                    {attachment.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      )}
    </section>
  );
}
