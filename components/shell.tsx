"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { selectBuilding } from "@/app/actions/buildings";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { buildingNavIsCurrent } from "@/lib/building-hub";
import { formatAddress, type BuildingRecord } from "@/lib/buildings";
import type { NotificationListItem } from "@/lib/notifications";
import { formatRole } from "@/lib/roles";

const PRIMARY_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: FolderKanban },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/building", label: "Building", icon: Building2 },
];

const SECONDARY_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/residents", label: "Residents", icon: Users },
  { href: "/contractors", label: "Contractors", icon: HardHat },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({
  user,
  buildings,
  selected,
  notifications,
  children,
}: {
  user: { name: string; role: string };
  buildings: BuildingRecord[];
  selected: BuildingRecord | null;
  notifications: { unread: number; items: NotificationListItem[] };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="app-shell min-h-dvh bg-page md:fixed md:inset-0 md:flex md:overflow-hidden">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-brand-navy/50 md:hidden"
          aria-label="Dismiss menu"
          title="Dismiss menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`${open ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"} w-72 min-h-0 flex-col bg-brand-navy text-white shadow-xl md:static md:flex md:shadow-none`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <Link href="/dashboard" onClick={close} className="min-w-0">
            <Image
              src="/brand/tnk-logo-white.svg"
              alt="TNK Property Services"
              width={407}
              height={126}
              unoptimized
              priority
              className="h-11 w-auto max-w-full"
            />
          </Link>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm text-white hover:bg-white/10 md:hidden"
            onClick={close}
          >
            <X className="size-4" aria-hidden="true" />
            Close
          </button>
        </div>
        <div className="px-3 pb-3">
          <BuildingSwitcher buildings={buildings} selected={selected} onNavigate={close} />
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-6" aria-label="Main">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
          ))}
          <div className="my-3 border-t border-white/15" />
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
          ))}
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex items-center gap-3 border-b border-line bg-white px-4 py-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-medium text-brand-navy shadow-sm md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-4" aria-hidden="true" />
            Menu
          </button>
          <GlobalSearch key={`${selected?.id ?? "none"}:${pathname}`} />
          <NotificationBell key={pathname} unread={notifications.unread} items={notifications.items} />
          <UserMenu name={user.name} role={user.role} />
        </header>
        <main id="content" tabIndex={-1} ref={mainRef} className="flex-1 px-4 py-6 md:min-h-0 md:overflow-y-auto md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  onNavigate: () => void;
}) {
  const active =
    href === "/building"
      ? buildingNavIsCurrent(pathname)
      : pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
        active ? "bg-white text-brand-navy shadow-sm" : "text-white hover:bg-white/10"
      }`}
    >
      <Icon className={`size-4 shrink-0 ${active ? "text-[#047857]" : "text-white"}`} aria-hidden="true" />
      {label}
    </Link>
  );
}

function BuildingSwitcher({
  buildings,
  selected,
  onNavigate,
}: {
  buildings: BuildingRecord[];
  selected: BuildingRecord | null;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onNavigate();
  };

  return (
    <div className="rounded-xl bg-white/10">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-full rounded-xl px-2 py-2 text-left hover:bg-white/10"
      >
        <span className="sr-only">Switch building. </span>
        <span className="flex items-center gap-2">
          <BuildingPhoto name={selected?.name ?? "Building"} photoUrl={selected?.photoUrl ?? null} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{selected?.name ?? "No building selected"}</span>
            <span className="block truncate text-xs text-white">{selected ? formatAddress(selected) : "Choose a building"}</span>
          </span>
          <ChevronDown className={`size-4 shrink-0 text-white ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <div className="space-y-1 border-t border-white/15 px-2 py-2">
          {buildings.length === 0 ? <p className="px-2 py-1 text-sm text-white">No buildings yet.</p> : null}
          {buildings.map((building) => (
            <form key={building.id} action={selectBuilding} onSubmit={close}>
              <input type="hidden" name="buildingId" value={building.id} />
              <button
                type="submit"
                className={`w-full rounded-lg px-2 py-2 text-left hover:bg-white/10 ${selected?.id === building.id ? "bg-white/10" : ""}`}
                aria-current={selected?.id === building.id ? "true" : undefined}
              >
                <span className="block text-sm">{building.name}</span>
                <span className="block text-xs text-white">{formatAddress(building)}</span>
              </button>
            </form>
          ))}
          <Link
            href="/buildings"
            onClick={close}
            className="block rounded-lg bg-white px-2 py-2 text-sm font-medium text-brand-navy hover:bg-brand-blue hover:text-white"
          >
            Manage buildings
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function BuildingPhoto({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      // User-supplied photo URLs are not limited to one host, so the optimizer cannot whitelist them.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-sm font-semibold text-white"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-2 py-1.5 text-sm shadow-sm">
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white"
        >
          {initials(name)}
        </span>
        <span className="hidden max-w-40 truncate font-medium sm:inline">{name}</span>
        <span className="sm:hidden">Account</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-line bg-card p-3 shadow-lg">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted">{formatRole(role)}</p>
        <form action={signOutAction} className="mt-3 border-t border-line pt-3">
          <button type="submit" className="inline-flex items-center gap-2 text-sm font-medium text-brand-blue hover:underline">
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0] ?? "").join("");
  return letters.toUpperCase() || "T";
}
