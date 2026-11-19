"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/data";
import { COMPANY_SETTINGS_ID, decideCompanySettingsSave } from "@/lib/work-order-terms";

export type WorkOrderTermsState = {
  error?: string;
  saved?: boolean;
};

export async function saveWorkOrderTerms(_prev: WorkOrderTermsState, formData: FormData): Promise<WorkOrderTermsState> {
  const user = await requireUser();
  const decision = decideCompanySettingsSave(user.role, formData);
  if (!decision.ok) return { error: decision.error };

  await prisma.companySettings.upsert({
    where: { id: COMPANY_SETTINGS_ID },
    update: decision.value,
    create: { id: COMPANY_SETTINGS_ID, ...decision.value },
  });
  revalidatePath("/settings/work-order-terms");
  revalidatePath("/settings");
  return { saved: true };
}
