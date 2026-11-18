import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InspectionTemplateForm } from "@/components/inspection-template-form";
import { requireUser } from "@/lib/data";
import { canManageInspectionTemplates } from "@/lib/roles";

export const metadata: Metadata = { title: "New inspection template" };

export default async function NewInspectionTemplatePage() {
  const user = await requireUser();
  if (!canManageInspectionTemplates(user.role) || !user.selectedBuildingId) redirect("/building/inspections");

  return (
    <section>
      <Link href="/building/inspections" className="text-sm text-brand-blue hover:underline">
        Inspections
      </Link>
      <h1 className="mt-3 font-serif text-3xl">New template</h1>
      <InspectionTemplateForm />
    </section>
  );
}
