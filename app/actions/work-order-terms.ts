"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/data";
import { COMPANY_SETTINGS_ID, decideCompanySettingsSave } from "@/lib/work-order-terms";
import { attachSubmitted, type SubmittedValues } from "@/lib/form-values";

export type WorkOrderTermsState = {
  error?: string;
  saved?: boolean;
  values?: SubmittedValues;
};

export async function saveWorkOrderTerms(prev: WorkOrderTermsState, formData: FormData): Promise<WorkOrderTermsState> {
  return attachSubmitted(formData, await saveWorkOrderTermsBody(prev, formData));
}

async function saveWorkOrderTermsBody(_prev: WorkOrderTermsState, formData: FormData): Promise<WorkOrderTermsState> {
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
