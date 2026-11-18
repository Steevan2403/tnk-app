import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseForm } from "@/components/case-form";
import { defaultCaseDates } from "@/lib/cases";
import { listCaseFormOptions, requireUser } from "@/lib/data";
import { canEditCases } from "@/lib/roles";

export const metadata: Metadata = { title: "New case" };

export default async function NewCasePage() {
  const user = await requireUser();
  if (!canEditCases(user.role) || !user.selectedBuildingId) redirect("/cases");

  const options = await listCaseFormOptions(user.selectedBuildingId);

  return (
    <section>
      <Link href="/cases" className="text-sm text-brand-blue hover:underline">
        All cases
      </Link>
      <h1 className="mt-3 font-serif text-3xl">New case</h1>
      {options.types.length === 0 ? (
        <p className="mt-6 text-muted">Add a case type before adding a case.</p>
      ) : (
        <CaseForm
          types={options.types}
          assets={options.assets}
          apartments={options.apartments}
          companies={options.companies}
          dates={defaultCaseDates()}
        />
      )}
    </section>
  );
}
