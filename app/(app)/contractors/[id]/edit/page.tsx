import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CompanyForm } from "@/components/company-form";
import { getContractorCompany, listContractorCategories, requireUser } from "@/lib/data";
import { canManageContractors } from "@/lib/roles";

export const metadata: Metadata = { title: "Edit company" };

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!canManageContractors(user.role)) redirect(`/contractors/${id}`);

  const [company, categories] = await Promise.all([getContractorCompany(id), listContractorCategories()]);
  if (!company) notFound();

  return (
    <section>
      <h1 className="font-serif text-3xl">Edit {company.name}</h1>
      <CompanyForm
        categories={categories}
        company={{
          id: company.id,
          name: company.name,
          abn: company.abn,
          address: company.address,
          phone: company.phone,
          email: company.email,
          website: company.website,
          categoryId: company.categoryId,
        }}
      />
    </section>
  );
}
