import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompanyForm } from "@/components/company-form";
import { listContractorCategories, requireUser } from "@/lib/data";
import { canManageContractors } from "@/lib/roles";

export const metadata: Metadata = { title: "New company" };

export default async function NewCompanyPage() {
  const user = await requireUser();
  if (!canManageContractors(user.role)) redirect("/contractors");

  const categories = await listContractorCategories();

  return (
    <section>
      <h1 className="font-serif text-3xl">New company</h1>
      {categories.length === 0 ? (
        <p className="mt-6 text-muted">No categories are set up yet.</p>
      ) : (
        <CompanyForm categories={categories} />
      )}
    </section>
  );
}
