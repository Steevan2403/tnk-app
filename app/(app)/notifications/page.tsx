import type { Metadata } from "next";
import Link from "next/link";
import { markAllNotificationsRead, openNotification } from "@/app/actions/notifications";
import { NotificationText } from "@/components/notification-bell";
import { EmptyState } from "@/components/ui";
import { listBuildings, requireUser } from "@/lib/data";
import { prisma } from "@/lib/db";
import { parsePage } from "@/lib/cases";
import { NOTIFICATION_PAGE_SIZE, listNotifications } from "@/lib/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const buildings = await listBuildings();
  const building = buildings.find((item) => item.id === user.selectedBuildingId) ?? null;
  const params = await searchParams;
  const requested = parsePage(first(params.page));
  const listed = await listNotifications(prisma, user, requested);
  const totalPages = Math.max(1, Math.ceil(listed.total / NOTIFICATION_PAGE_SIZE));
  const page = Math.min(requested, totalPages);
  const rows = page === requested ? listed.rows : (await listNotifications(prisma, user, page)).rows;

  return (
    <section className="max-w-3xl">
      <h1 className="font-serif text-3xl">Notifications</h1>
      {building ? (
        <p className="mt-2 text-muted">{building.name}</p>
      ) : (
        <p className="mt-2 text-muted">Select a building to see notifications.</p>
      )}
      {building ? (
        <form action={markAllNotificationsRead} className="mt-4">
          <button
            type="submit"
            className="rounded text-sm font-medium text-brand-blue hover:underline outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            Mark all read
          </button>
        </form>
      ) : null}
      {building && rows.length === 0 ? <EmptyState>No notifications yet.</EmptyState> : null}
      <ul className="mt-4 space-y-3">
        {rows.map((item) => (
          <li key={item.id} className="rounded-xl border border-line bg-card">
            <form action={openNotification}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className="w-full rounded-xl px-4 py-3 text-left outline-none hover:bg-page focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                <NotificationText item={item} />
              </button>
            </form>
          </li>
        ))}
      </ul>
      {building && totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={`/notifications?page=${page - 1}`} className="text-brand-blue hover:underline">
                Previous
              </Link>
            ) : (
              <span className="text-muted">Previous</span>
            )}
            {page < totalPages ? (
              <Link href={`/notifications?page=${page + 1}`} className="text-brand-blue hover:underline">
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
