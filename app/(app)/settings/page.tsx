import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/data";
import { canViewOutbox } from "@/lib/roles";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <section>
      <h1 className="font-serif text-3xl">Settings</h1>
      <p className="mt-2 text-muted">Account settings for TNK Property Services.</p>
      {canViewOutbox(user.role) ? (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-card">
          <li>
            <Link href="/settings/outbox" className="block px-4 py-3 text-brand-blue hover:underline">
              Outbox
            </Link>
          </li>
        </ul>
      ) : (
        <p className="mt-6 text-muted">The outbox is available to admins.</p>
      )}
    </section>
  );
}
