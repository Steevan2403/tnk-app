import { randomBytes } from "node:crypto";
import { workOrderNumber } from "./work-orders";

export const CHECK_IN_NAME_MAX = 120;
export const INVALID_CHECK_IN_LINK =
  "This check-in link is not valid. It can be used for more than one visit until the work order is completed or cancelled.";

export type SiteAction = "check_in" | "check_out";

export type SiteVisitInput = {
  id: string;
  contractorName: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
};

export type SiteVisitOrder = {
  id: string;
  suffix: string;
  caseNumber: number;
  visits: SiteVisitInput[];
};

export function newCheckInToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isCheckInToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,128}$/.test(value);
}

export function isSiteAction(value: string): value is SiteAction {
  return value === "check_in" || value === "check_out";
}

export function prefilledContractorName(contactName: string | null | undefined, companyName: string | null | undefined): string {
  const contact = contactName?.trim() ?? "";
  if (contact) return contact.slice(0, CHECK_IN_NAME_MAX);
  return (companyName?.trim() ?? "").slice(0, CHECK_IN_NAME_MAX);
}

export function workOrderClosedMessage(status: string): string | null {
  if (status === "completed") return "This work order is completed. On-site check-in is closed.";
  if (status === "cancelled") return "This work order is cancelled. On-site check-in is closed.";
  return null;
}

export function decideSiteAction(input: {
  status: string;
  action: SiteAction;
  hasOpenVisit: boolean;
  name: string;
}): { ok: true; name: string } | { ok: false; error: string } {
  const closed = workOrderClosedMessage(input.status);
  if (closed) return { ok: false, error: closed };
  if (input.action === "check_in") {
    if (input.hasOpenVisit) return { ok: false, error: "You are already checked in. Check out when you leave." };
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Enter your name." };
    if (name.length > CHECK_IN_NAME_MAX) return { ok: false, error: `Use ${CHECK_IN_NAME_MAX} characters or fewer.` };
    return { ok: true, name };
  }
  if (!input.hasOpenVisit) return { ok: false, error: "Check in before checking out." };
  return { ok: true, name: "" };
}

export function optionalLocation(
  latitude: string,
  longitude: string,
): { latitude: number; longitude: number } | null {
  const latText = latitude.trim();
  const lngText = longitude.trim();
  if (!latText || !lngText) return null;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function formatDuration(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "Under 1 minute";
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function formatLocation(latitude: number | null, longitude: number | null): string | null {
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function openSiteVisit<T extends { checkedOutAt: Date | null }>(visits: T[]): T | null {
  return visits.find((visit) => visit.checkedOutAt == null) ?? null;
}

export function siteVisitActivity(orders: SiteVisitOrder[]): {
  id: string;
  at: Date;
  actorName: string;
  summary: string;
  href: string;
}[] {
  const lines: { id: string; at: Date; actorName: string; summary: string; href: string }[] = [];
  for (const order of orders) {
    const number = workOrderNumber(order.caseNumber, order.suffix);
    const href = `/work-orders/${order.id}`;
    for (const visit of order.visits) {
      lines.push({
        id: `${visit.id}:in`,
        at: visit.checkedInAt,
        actorName: visit.contractorName,
        summary: `Checked in to work order ${number}.`,
        href,
      });
      if (visit.checkedOutAt) {
        lines.push({
          id: `${visit.id}:out`,
          at: visit.checkedOutAt,
          actorName: visit.contractorName,
          summary: `Checked out of work order ${number} after ${formatDuration(visit.checkedInAt, visit.checkedOutAt)}.`,
          href,
        });
      }
    }
  }
  return lines;
}
