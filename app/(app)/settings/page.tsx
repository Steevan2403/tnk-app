import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/data";
import { canEditWorkOrderTerms, canViewOutbox } from "@/lib/roles";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const showTerms = canEditWorkOrderTerms(user.role);
  const showOutbox = canViewOutbox(user.role);
  return (
    <section>
      <h1 className="font-serif text-3xl">Settings</h1>
      <p className="mt-2 text-muted">Account settings for TNK Property Services.</p>
      {showTerms || showOutbox ? (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {showTerms ? (
            <li>
              <Link href="/settings/work-order-terms" className="block px-4 py-3 font-medium text-brand-navy hover:bg-page">
                Work order terms
              </Link>
            </li>
          ) : null}
          {showOutbox ? (
            <li>
              <Link href="/settings/outbox" className="block px-4 py-3 font-medium text-brand-navy hover:bg-page">
                Outbox
              </Link>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-6 text-muted">Work order terms are available to admins and managers. The outbox is available to admins.</p>
      )}
    </section>
  );
}
