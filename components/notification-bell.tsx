"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, openNotification } from "@/app/actions/notifications";
import type { NotificationListItem } from "@/lib/notifications";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2";

export function NotificationBell({ unread, items }: { unread: number; items: NotificationListItem[] }) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const badge = unreadBadge(unread);
  const label = badge ? `Notifications, ${badge} unread` : "Notifications, no unread";

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        title={label}
        className={`touch-target relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-brand-navy shadow-sm hover:bg-page ${focusRing}`}
      >
        <Bell className="size-5" aria-hidden="true" />
        {badge ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-blue px-1 text-[10px] font-semibold leading-none text-white"
          >
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="fixed top-16 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-2 shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 px-2 py-1">
            <p className="text-sm font-semibold text-brand-navy">Notifications</p>
            <form action={markAllNotificationsRead}>
              <button type="submit" className={`rounded text-sm font-medium text-brand-blue hover:underline ${focusRing}`}>
                Mark all read
              </button>
            </form>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">No notifications.</p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <form action={openNotification}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className={`w-full rounded-lg px-2 py-2 text-left hover:bg-page ${focusRing}`}>
                      <NotificationText item={item} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line px-2 pt-2 pb-1">
            <Link href="/notifications" className={`rounded text-sm font-medium text-brand-blue hover:underline ${focusRing}`}>
              See all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationText({ item }: { item: NotificationListItem }) {
  return (
    <span className="flex gap-2">
      <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${item.unread ? "bg-brand-blue" : "bg-transparent"}`} />
      <span className="min-w-0">
        {item.unread ? <span className="sr-only">Unread. </span> : null}
        <span className={`block text-sm ${item.unread ? "font-medium text-ink" : "text-muted"}`}>{item.title}</span>
        <span className="mt-0.5 block text-xs font-normal text-muted">{item.when}</span>
      </span>
    </span>
  );
}

function unreadBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}
