"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOutAction } from "@/app/actions/auth";
import { selectBuilding } from "@/app/actions/buildings";
import { formatAddress, type BuildingRecord } from "@/lib/buildings";
import { formatRole } from "@/lib/roles";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/work-orders", label: "Work Orders" },
  { href: "/calendar", label: "Calendar" },
  { href: "/maintenance", label: "Maintenance" },
];

const BUILDING_NAV = [
  { href: "/building/assets", label: "Assets" },
  { href: "/building/inspections", label: "Inspections" },
  { href: "/building/reports", label: "Reports" },
];

const SECONDARY_NAV = [
  { href: "/residents", label: "Residents" },
  { href: "/contractors", label: "Contractors" },
  { href: "/settings", label: "Settings" },
];

export function Shell({
  user,
  buildings,
  selected,
  children,
}: {
  user: { name: string; role: string };
  buildings: BuildingRecord[];
  selected: BuildingRecord | null;
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="app-shell min-h-dvh bg-page md:fixed md:inset-0 md:flex md:overflow-hidden">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-brand-navy/40 md:hidden"
          aria-label="Dismiss menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={`${open ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"} w-72 min-h-0 flex-col bg-brand-navy text-white md:static md:flex`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <Link href="/dashboard" onClick={close} className="min-w-0">
            <Image
              src="/brand/tnk-logo-white.svg"
              alt="TNK Property Services"
              width={407}
              height={126}
              unoptimized
              className="h-12 w-auto max-w-full sm:h-14"
            />
          </Link>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-white md:hidden"
            onClick={close}
          >
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
          <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-white uppercase">
            Building
          </p>
          {BUILDING_NAV.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} nested />
          ))}
          <div className="pt-3">
            {SECONDARY_NAV.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} onNavigate={close} />
            ))}
          </div>
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-page px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-line bg-card px-3 py-2 text-sm md:hidden"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="search"
              placeholder="Search"
              aria-label="Search"
              className="w-full max-w-md rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/40"
            />
          </div>
          <UserMenu name={user.name} role={user.role} />
        </header>
        <main ref={mainRef} className="flex-1 px-4 py-6 md:min-h-0 md:overflow-y-auto md:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  pathname,
  onNavigate,
  nested = false,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate: () => void;
  nested?: boolean;
}) {
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`block rounded-md py-2 text-sm ${nested ? "px-6" : "px-3"} ${
        active ? "bg-white text-brand-navy" : "text-white hover:bg-brand-blue hover:text-white"
      }`}
    >
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
    <div className="rounded-lg bg-white/5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-full rounded-lg px-2 py-2 text-left hover:bg-brand-blue"
      >
        <span className="sr-only">Switch building. </span>
        <span className="flex items-center gap-2">
          <BuildingPhoto name={selected?.name ?? "Building"} photoUrl={selected?.photoUrl ?? null} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {selected?.name ?? "No building selected"}
            </span>
            <span className="block truncate text-xs text-white">
              {selected ? formatAddress(selected) : "Choose a building"}
            </span>
          </span>
        </span>
      </button>
      {open ? (
        <div className="space-y-1 border-t border-white/10 px-2 py-2">
          {buildings.length === 0 ? <p className="px-2 py-1 text-sm text-white">No buildings yet.</p> : null}
          {buildings.map((building) => (
            <form key={building.id} action={selectBuilding} onSubmit={close}>
              <input type="hidden" name="buildingId" value={building.id} />
              <button
                type="submit"
                className="w-full rounded-md px-2 py-2 text-left hover:bg-brand-blue"
                aria-current={selected?.id === building.id ? "true" : undefined}
              >
                <span className="block text-sm">{building.name}</span>
                <span className="block text-xs text-white">{formatAddress(building)}</span>
              </button>
            </form>
          ))}
          <Link href="/buildings" onClick={close} className="block rounded-md bg-white px-2 py-2 text-sm text-brand-blue hover:bg-brand-blue hover:text-white">
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
      <img src={photoUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-md object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-blue text-sm font-semibold text-white"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-md border border-line bg-card px-3 py-2 text-sm">
        <span className="sm:hidden">Account</span>
        <span className="hidden max-w-40 truncate sm:inline">{name}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-line bg-card p-3 shadow-lg">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted">{formatRole(role)}</p>
        <form action={signOutAction} className="mt-3">
          <button type="submit" className="text-sm text-brand-blue hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
