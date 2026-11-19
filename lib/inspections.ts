import { plainTextToCaseHtml } from "./maintenance";
import { canManageInspectionTemplates } from "./roles";

export const INSPECTION_TYPES = ["common_area", "private_lot"] as const;

export const INSPECTION_RESULTS = ["pass", "fail", "na"] as const;

export const INSPECTION_TABS = ["templates", "progress", "completed"] as const;

export const REPAIR_CASE_TYPE = "Repair & maintenance";

export type InspectionType = (typeof INSPECTION_TYPES)[number];

export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export type InspectionTab = (typeof INSPECTION_TABS)[number];

export type TemplateAreaInput = {
  name: string;
  items: { name: string; guidance: string | null }[];
};

export type TemplateInput = {
  name: string;
  type: InspectionType;
  description: string;
  areas: TemplateAreaInput[];
};

export type TemplateField = "name" | "type" | "description" | "areas";

export type TemplateSnapshotSource = {
  name: string;
  type: InspectionType;
  areas: {
    name: string;
    position: number;
    items: { name: string; guidance: string | null; position: number }[];
  }[];
};

export type RunSnapshot = {
  name: string;
  type: InspectionType;
  areas: {
    name: string;
    position: number;
    items: {
      name: string;
      guidance: string | null;
      position: number;
      result: null;
      comment: null;
    }[];
  }[];
};

export type CasePlanItem = {
  id: string;
  result: InspectionResult | null;
  caseId: string | null;
};

const NAME_MAX = 160;
const DESCRIPTION_MAX = 2000;
const AREA_NAME_MAX = 80;
const GUIDANCE_MAX = 500;
const AREA_LIMIT = 40;
const ITEM_LIMIT = 50;

export function isInspectionType(value: string): value is InspectionType {
  return INSPECTION_TYPES.includes(value as InspectionType);
}

export function isInspectionResult(value: string): value is InspectionResult {
  return INSPECTION_RESULTS.includes(value as InspectionResult);
}

export function isInspectionTab(value: string): value is InspectionTab {
  return INSPECTION_TABS.includes(value as InspectionTab);
}

export function formatInspectionType(type: string): string {
  if (type === "common_area") return "Common area";
  if (type === "private_lot") return "Private lot";
  return type;
}

export function formatInspectionMark(result: string | null): string {
  if (result === "pass") return "Pass";
  if (result === "fail") return "Fail";
  if (result === "na") return "Not applicable";
  return "Unanswered";
}

export function formatSydneyDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(date);
}

export function planTemplateDelete(role: string): { ok: true } | { ok: false; error: string } {
  if (!canManageInspectionTemplates(role)) {
    return { ok: false, error: "You do not have permission to delete inspection templates." };
  }
  return { ok: true };
}

export function templateDeletePrompt(input: { name: string; completedRuns: number; activeRuns: number }): {
  title: string;
  message: string;
} {
  return {
    title: `Delete ${input.name}?`,
    message: `Delete this inspection template?\n${keptInspections(input.completedRuns, input.activeRuns, "present")}`,
  };
}

export function templateDeletedActivity(name: string, completedRuns: number, activeRuns: number): string {
  return `Deleted inspection template ${name}. ${keptInspections(completedRuns, activeRuns, "past")}`;
}

function keptInspections(completed: number, active: number, tense: "present" | "past"): string {
  const total = completed + active;
  if (total === 0) {
    return tense === "present"
      ? "No inspections have been started from it. This removes the checklist only."
      : "No inspections had been started from it.";
  }
  const parts: string[] = [];
  if (completed > 0) parts.push(`${completed} completed`);
  if (active > 0) parts.push(`${active} in progress`);
  const list = parts.join(" and ");
  if (tense === "present") {
    return total === 1
      ? `${list} inspection keeps its checklist, answers, photos, and any case raised from it. That record stays.`
      : `${list} inspections keep their checklists, answers, photos, and any cases raised from them. Those records stay.`;
  }
  return total === 1
    ? `${list} inspection kept its checklist, answers, photos, and any case raised from it.`
    : `${list} inspections kept their checklists, answers, photos, and any cases raised from them.`;
}

export function duplicateTemplateName(name: string): string {
  const suffix = " copy";
  const trimmed = name.trim();
  if (trimmed.length + suffix.length <= NAME_MAX) return `${trimmed}${suffix}`;
  return `${trimmed.slice(0, NAME_MAX - suffix.length).trimEnd()}${suffix}`;
}

export function inspectionPdfName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "inspection"}-report.pdf`;
}

export function reportMessage(input: {
  inspectionName: string;
  buildingName: string;
  inspectorName: string;
  completedLabel: string;
  pdfName: string;
}): { subject: string; body: string } {
  return {
    subject: `Inspection report: ${input.inspectionName}`,
    body: [
      `Inspection report for ${input.buildingName}.`,
      "",
      input.inspectionName,
      `Completed ${input.completedLabel}.`,
      `Inspector: ${input.inspectorName}.`,
      "",
      `The report is attached (${input.pdfName}).`,
      "",
      "TNK Property Services",
    ].join("\n"),
  };
}

export function snapshotTemplate(template: TemplateSnapshotSource): RunSnapshot {
  return {
    name: template.name,
    type: template.type,
    areas: template.areas
      .map((area) => ({
        name: area.name,
        position: area.position,
        items: area.items
          .map((item) => ({
            name: item.name,
            guidance: item.guidance,
            position: item.position,
            result: null,
            comment: null,
          }))
          .sort((left, right) => left.position - right.position),
      }))
      .sort((left, right) => left.position - right.position),
  };
}

export function progressCount(items: { result: string | null }[]): { answered: number; total: number } {
  const answered = items.filter((item) => item.result != null && isInspectionResult(item.result)).length;
  return { answered, total: items.length };
}

export function resultCounts(items: { result: string | null }[]): {
  pass: number;
  fail: number;
  na: number;
  unanswered: number;
} {
  const counts = { pass: 0, fail: 0, na: 0, unanswered: 0 };
  for (const item of items) {
    if (item.result === "pass") counts.pass += 1;
    else if (item.result === "fail") counts.fail += 1;
    else if (item.result === "na") counts.na += 1;
    else counts.unanswered += 1;
  }
  return counts;
}

export function completionDecision(
  items: { result: InspectionResult | null }[],
  confirmed: boolean,
): { ok: true; status: "completed"; unanswered: number } | { ok: false; reason: "confirm"; unanswered: number } {
  const unanswered = items.filter((item) => item.result == null).length;
  if (unanswered > 0 && !confirmed) return { ok: false, reason: "confirm", unanswered };
  return { ok: true, status: "completed", unanswered };
}

export function planCaseCreates(
  items: CasePlanItem[],
  requestedIds: string[],
): { createIds: string[]; alreadyLinked: string[] } {
  const wanted = new Set(requestedIds);
  const seen = new Set<string>();
  const createIds: string[] = [];
  const alreadyLinked: string[] = [];
  for (const item of items) {
    if (!wanted.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    if (item.result !== "fail") continue;
    if (item.caseId) {
      alreadyLinked.push(item.id);
      continue;
    }
    createIds.push(item.id);
  }
  return { createIds, alreadyLinked };
}

export function caseSubjectForItem(itemName: string, areaName: string): string {
  const subject = `${itemName} (${areaName})`;
  if (subject.length <= NAME_MAX) return subject;
  return subject.slice(0, NAME_MAX).trim();
}

export function caseFieldsFromItem(input: {
  itemName: string;
  areaName: string;
  comment: string | null;
  type: InspectionType;
  apartmentId: string | null;
}): {
  subject: string;
  descriptionHtml: string;
  area: "apartment" | "none";
  apartmentId: string | null;
} {
  const apartmentId = input.type === "private_lot" && input.apartmentId ? input.apartmentId : null;
  return {
    subject: caseSubjectForItem(input.itemName, input.areaName),
    descriptionHtml: plainTextToCaseHtml(input.comment ?? ""),
    area: apartmentId ? "apartment" : "none",
    apartmentId,
  };
}

export function completedRange(from: Date | null, to: Date | null): { gte?: Date; lt?: Date } | null {
  if (!from && !to) return null;
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = from;
  if (to) {
    const end = new Date(to.getTime());
    end.setUTCDate(end.getUTCDate() + 1);
    range.lt = end;
  }
  return range;
}

export function parseTemplateForm(
  formData: FormData,
): { ok: true; value: TemplateInput } | { ok: false; errors: Partial<Record<TemplateField, string>> } {
  const errors: Partial<Record<TemplateField, string>> = {};
  const name = text(formData, "name");
  const typeRaw = text(formData, "type");
  const description = text(formData, "description");

  if (!name) errors.name = "Enter a name.";
  else if (name.length > NAME_MAX) errors.name = `Use ${NAME_MAX} characters or fewer.`;
  if (!isInspectionType(typeRaw)) errors.type = "Choose a type.";
  if (description.length > DESCRIPTION_MAX) errors.description = `Use ${DESCRIPTION_MAX} characters or fewer.`;

  const areaNames = texts(formData, "areaName");
  const areaKeys = texts(formData, "areaKey");
  const itemAreas = texts(formData, "itemArea");
  const itemNames = texts(formData, "itemName");
  const itemGuidance = texts(formData, "itemGuidance");
  const areas: TemplateAreaInput[] = [];

  if (areaNames.length !== areaKeys.length || itemAreas.length !== itemNames.length || itemNames.length !== itemGuidance.length) {
    errors.areas = "Check the areas and items.";
  } else if (areaNames.length === 0) {
    errors.areas = "Add an area.";
  } else if (areaNames.length > AREA_LIMIT) {
    errors.areas = `Use ${AREA_LIMIT} areas or fewer.`;
  } else {
    const seen = new Set<string>();
    for (let index = 0; index < areaNames.length; index += 1) {
      const areaName = areaNames[index];
      const areaKey = areaKeys[index];
      if (!areaName) {
        errors.areas = "Enter a name for every area.";
        break;
      }
      if (areaName.length > AREA_NAME_MAX) {
        errors.areas = `Use ${AREA_NAME_MAX} characters or fewer for an area name.`;
        break;
      }
      if (!areaKey || seen.has(areaKey)) {
        errors.areas = "Check the areas and items.";
        break;
      }
      seen.add(areaKey);
      const items: TemplateAreaInput["items"] = [];
      for (let itemIndex = 0; itemIndex < itemNames.length; itemIndex += 1) {
        if (itemAreas[itemIndex] !== areaKey) continue;
        const itemName = itemNames[itemIndex];
        const guidance = itemGuidance[itemIndex];
        if (!itemName) {
          errors.areas = "Enter a name for every item.";
          break;
        }
        if (itemName.length > NAME_MAX) {
          errors.areas = `Use ${NAME_MAX} characters or fewer for an item name.`;
          break;
        }
        if (guidance.length > GUIDANCE_MAX) {
          errors.areas = `Use ${GUIDANCE_MAX} characters or fewer for a guidance note.`;
          break;
        }
        items.push({ name: itemName, guidance: guidance || null });
      }
      if (errors.areas) break;
      if (items.length === 0) {
        errors.areas = "Add an item to every area.";
        break;
      }
      if (items.length > ITEM_LIMIT) {
        errors.areas = `Use ${ITEM_LIMIT} items or fewer in an area.`;
        break;
      }
      areas.push({ name: areaName, items });
    }
  }

  if (Object.keys(errors).length > 0 || !isInspectionType(typeRaw)) return { ok: false, errors };
  return { ok: true, value: { name, type: typeRaw, description, areas } };
}

export function parseReportRecipient(value: string): string | null {
  const email = value.trim();
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function texts(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => String(value).trim());
}
