import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/contractors";
import { parsePage } from "@/lib/cases";
import { listOutbox, requireUser } from "@/lib/data";
import { canViewOutbox } from "@/lib/roles";
import { withStoredSizes } from "@/lib/storage";
import { PAGE_SIZE, formatFileSize } from "@/lib/work-orders";

export const metadata: Metadata = { title: "Outbox" };

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewOutbox(user.role)) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Outbox</h1>
        <p className="mt-4 text-muted">Only an admin can view the outbox.</p>
      </section>
    );
  }

  if (!user.selectedBuildingId) {
    return (
      <section>
        <h1 className="font-serif text-3xl">Outbox</h1>
        <p className="mt-4 text-muted">Select a building to see its mail.</p>
      </section>
    );
  }

  const params = await searchParams;
  const requested = parsePage(first(params.page));
  const listed = await listOutbox(requested, user);
  const totalPages = Math.max(1, Math.ceil(listed.total / PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const rows = page === requested ? listed.rows : (await listOutbox(page, user)).rows;
  const messages = await Promise.all(
    rows.map(async (message) => ({ ...message, attachments: await withStoredSizes(message.attachments) })),
  );

  return (
    <section>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/settings" className="text-brand-blue hover:underline">
              Settings
            </Link>
          </li>
          <li aria-hidden="true" className="text-muted">
            /
          </li>
          <li className="text-muted">Outbox</li>
        </ol>
      </nav>
      <h1 className="mt-3 font-serif text-3xl">Outbox</h1>
      <p className="mt-2 text-muted">Mail written on this server. Nothing here is sent to a real inbox.</p>
      <p className="mt-4 text-sm text-muted">{listed.total === 1 ? "1 message" : `${listed.total} messages`}</p>
      {rows.length === 0 ? <EmptyState>No messages yet.</EmptyState> : null}
      <ul className="mt-4 space-y-4">
        {messages.map((message) => (
          <li key={message.id}>
            <article aria-label={message.subject} className="rounded-xl border border-line bg-card p-4">
              <p className="text-sm text-muted">{formatDateTime(message.createdAt)}</p>
              <p className="mt-2">
                <span className="text-muted">To </span>
                {message.toAddress}
              </p>
              <h2 className="mt-2 text-lg font-medium">{message.subject}</h2>
              <p className="mt-3 whitespace-pre-wrap">{message.body}</p>
              {message.attachments.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {message.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a href={`/api/outbox-files/${attachment.id}`} className="text-brand-blue hover:underline">
                        {attachment.name}
                      </a>
                      <span className="text-sm text-muted"> · {formatFileSize(attachment.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No attachments.</p>
              )}
            </article>
          </li>
        ))}
      </ul>
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={`/settings/outbox?page=${page - 1}`} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {page < totalPages ? (
              <Link href={`/settings/outbox?page=${page + 1}`} className="text-brand-blue hover:underline">
                Next
              </Link>
            ) : (
              <span className="text-muted">Next</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
