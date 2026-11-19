import type { NotificationKind, Prisma, PrismaClient } from "@prisma/client";
import { canUseBuilding } from "./buildings";
import { formatDateTime } from "./contractors";

export const NOTIFICATION_PAGE_SIZE = 20;

const PREVIEW_LIMIT = 10;

export type NotificationPerson = {
  id: string;
  role: string;
  buildingIds: readonly string[];
};

export type NotificationViewer = NotificationPerson & {
  selectedBuildingId: string | null;
};

export type NotificationListItem = {
  id: string;
  title: string;
  when: string;
  unread: boolean;
};

type NotificationDb = Prisma.TransactionClient | PrismaClient;

// People who can open the building, except the person who did the action.
// A contractor check-in has no user, so actorId is null and every member is included.
export function notificationRecipients(
  people: readonly NotificationPerson[],
  buildingId: string,
  actorId: string | null,
): string[] {
  return people
    .filter((person) => person.id !== actorId && canUseBuilding(person.role, buildingId, person.buildingIds))
    .map((person) => person.id);
}

export function accessibleBuildingId(user: NotificationViewer): string | null {
  if (!user.selectedBuildingId) return null;
  if (!canUseBuilding(user.role, user.selectedBuildingId, user.buildingIds)) return null;
  return user.selectedBuildingId;
}

export async function notifyBuilding(
  db: NotificationDb,
  input: {
    buildingId: string;
    actorId: string | null;
    kind: NotificationKind;
    title: string;
    link: string;
  },
): Promise<void> {
  const people = await db.user.findMany({
    select: {
      id: true,
      role: true,
      memberships: { select: { buildingId: true } },
    },
  });
  const recipients = notificationRecipients(
    people.map((person) => ({
      id: person.id,
      role: person.role,
      buildingIds: person.memberships.map((membership) => membership.buildingId),
    })),
    input.buildingId,
    input.actorId,
  );
  if (recipients.length === 0) return;
  await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      buildingId: input.buildingId,
      kind: input.kind,
      title: input.title,
      link: input.link,
    })),
  });
}

export async function notificationPreview(
  db: PrismaClient,
  user: NotificationViewer,
): Promise<{ unread: number; items: NotificationListItem[] }> {
  const buildingId = accessibleBuildingId(user);
  if (!buildingId) return { unread: 0, items: [] };
  const where = { userId: user.id, buildingId };
  const [unread, rows] = await Promise.all([
    db.notification.count({ where: { ...where, readAt: null } }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PREVIEW_LIMIT,
      select: { id: true, title: true, createdAt: true, readAt: true },
    }),
  ]);
  return { unread, items: rows.map(present) };
}

export async function listNotifications(
  db: PrismaClient,
  user: NotificationViewer,
  page: number,
): Promise<{ total: number; rows: NotificationListItem[] }> {
  const buildingId = accessibleBuildingId(user);
  if (!buildingId) return { total: 0, rows: [] };
  const where = { userId: user.id, buildingId };
  const [total, rows] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * NOTIFICATION_PAGE_SIZE,
      take: NOTIFICATION_PAGE_SIZE,
      select: { id: true, title: true, createdAt: true, readAt: true },
    }),
  ]);
  return { total, rows: rows.map(present) };
}

function present(row: { id: string; title: string; createdAt: Date; readAt: Date | null }): NotificationListItem {
  return {
    id: row.id,
    title: row.title,
    when: formatDateTime(row.createdAt),
    unread: row.readAt == null,
  };
}
