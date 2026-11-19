import type { Metadata } from "next";
import Link from "next/link";
import { WorkOrderTermsForm } from "@/components/work-order-terms-form";
import { getCompanySettings } from "@/lib/company-settings";
import { requireUser } from "@/lib/data";
import { canEditWorkOrderTerms } from "@/lib/roles";

export const metadata: Metadata = { title: "Work order terms" };

export default async function WorkOrderTermsPage() {
  const user = await requireUser();

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
          <li className="text-muted">Work order terms</li>
        </ol>
      </nav>
      <h1 className="mt-3 font-serif text-3xl">Work order terms</h1>
      {canEditWorkOrderTerms(user.role) ? (
        <>
          <p className="mt-2 max-w-3xl text-muted">
            These terms are printed on every work order. Preview uses the last saved terms.
          </p>
          <WorkOrderTermsForm settings={await getCompanySettings()} />
        </>
      ) : (
        <p className="mt-4 text-muted">Only an admin or a manager can edit work order terms.</p>
      )}
    </section>
  );
}
