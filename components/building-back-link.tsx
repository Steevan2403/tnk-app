"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BuildingBackLink() {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm print:hidden">
      <Link href="/building" className="text-brand-blue hover:underline">
        Building
      </Link>
    </nav>
  );
}

export function BuildingSectionCrumb() {
  const pathname = usePathname();
  if (pathname === "/building") return null;
  return <BuildingBackLink />;
}
