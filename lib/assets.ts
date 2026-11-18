import { expiredBefore, parseDateOnly } from "./contractors";

export { formatCalendarDate, formatIsoDate } from "./contractors";

export const PAGE_SIZE = 50;

export const MAX_ASSET_PHOTOS = 15;

const LIFE_MONTHS = "Enter the estimated life in whole months.";
const END_OF_LIFE = "End-of-life value cannot be more than the asset value.";
const CONTACT_COMPANY = "Choose a contact from the selected company.";
const MONEY = "Enter an amount in dollars, such as 1200 or 1200.50.";

export type AssetField =
  | "name"
  | "categoryId"
  | "location"
  | "make"
  | "model"
  | "serialNumber"
  | "barcode"
  | "purchasedOn"
  | "assetValue"
  | "endOfLifeValue"
  | "lifeMonths"
  | "description"
  | "companyId"
  | "contactId";

export type AssetInput = {
  name: string;
  categoryId: string;
  location: string | null;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  barcode: string | null;
  purchasedOn: Date;
  assetValue: string | null;
  endOfLifeValue: string | null;
  lifeMonths: number | null;
  description: string | null;
  companyId: string | null;
  contactId: string | null;
};

export type AssetFormContext = {
  categoryIds: string[];
  companies: { id: string; contactIds: string[] }[];
};

export type WarrantyField = "provider" | "startsOn" | "expiresOn" | "notes";

export type WarrantyInput = {
  provider: string;
  startsOn: Date;
  expiresOn: Date;
  notes: string | null;
};

export type CategoryField = "name";

export type PhotoField = "photos";

export type DocumentField = "name" | "file";

export function parsePage(value: string): number {
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1) return 1;
  if (page > 10000) return 10000;
  return page;
}

export function todayIso(now = new Date()): string {
  return expiredBefore(now).toISOString().slice(0, 10);
}

export function isWarrantyExpired(expiresOn: Date, today = new Date()): boolean {
  return expiresOn.getTime() < expiredBefore(today).getTime();
}

export function latestWarrantyExpiry(dates: Date[]): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

export function expiredWarrantyWhere(today = new Date()): {
  warranties: { some: { expiresOn: { lt: Date } } };
} {
  return { warranties: { some: { expiresOn: { lt: expiredBefore(today) } } } };
}

export function assetsWithExpiredWarranty<T extends { warranties: { expiresOn: Date }[] }>(
  assets: T[],
  today = new Date(),
): T[] {
  return assets.filter((asset) =>
    asset.warranties.some((warranty) => isWarrantyExpired(warranty.expiresOn, today)),
  );
}

export function moneyCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, fraction = ""] = trimmed.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 99_999_999_99) return null;
  return cents;
}

export function parseMoney(value: string): { ok: true; amount: string | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, amount: null };
  const cents = moneyCents(trimmed);
  if (cents == null) return { ok: false };
  return { ok: true, amount: formatCents(cents) };
}

export function formatMoney(value: string | null): string {
  if (!value) return "—";
  const cents = moneyCents(value);
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export function moneyInputValue(value: { toString(): string } | null): string {
  if (!value) return "";
  const cents = moneyCents(value.toString());
  if (cents == null) return "";
  return formatCents(cents);
}

export function endOfLifeValueError(assetValue: string | null, endOfLifeValue: string | null): string | null {
  if (endOfLifeValue == null) return null;
  const end = moneyCents(endOfLifeValue);
  const asset = assetValue == null ? null : moneyCents(assetValue);
  if (end == null || asset == null || end > asset) return END_OF_LIFE;
  return null;
}

export function parseLifeMonths(value: string): { ok: true; months: number | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, months: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: LIFE_MONTHS };
  const months = Number(trimmed);
  if (!Number.isSafeInteger(months) || months > 12000) return { ok: false, error: LIFE_MONTHS };
  return { ok: true, months };
}

export function photoCountError(existing: number, adding: number): string | null {
  if (!Number.isInteger(adding) || adding < 1) return "Choose an image.";
  if (!Number.isInteger(existing) || existing < 0 || existing + adding > MAX_ASSET_PHOTOS) {
    return "An asset can have up to 15 photos.";
  }
  return null;
}

export function contactCompanyError(
  companyId: string,
  contactId: string,
  companies: { id: string; contactIds: string[] }[],
): string | null {
  if (!contactId) return null;
  const company = companies.find((item) => item.id === companyId);
  if (!company || !company.contactIds.includes(contactId)) return CONTACT_COMPANY;
  return null;
}

export function parseCategoryName(value: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = value.trim();
  if (!name) return { ok: false, error: "Enter a category name." };
  if (name.length > 80) return { ok: false, error: "Use 80 characters or fewer." };
  return { ok: true, name };
}

export function parseAssetForm(
  formData: FormData,
  context: AssetFormContext,
): { ok: true; value: AssetInput } | { ok: false; errors: Partial<Record<AssetField, string>> } {
  const errors: Partial<Record<AssetField, string>> = {};
  const name = stringValue(formData, "name");
  const categoryId = stringValue(formData, "categoryId");
  const location = stringValue(formData, "location");
  const make = stringValue(formData, "make");
  const model = stringValue(formData, "model");
  const serialNumber = stringValue(formData, "serialNumber");
  const barcode = stringValue(formData, "barcode");
  const description = stringValue(formData, "description");
  const companyId = stringValue(formData, "companyId");
  const contactId = stringValue(formData, "contactId");

  if (!name) errors.name = "Enter an asset name.";
  else {
    const length = lengthError(name, 160);
    if (length) errors.name = length;
  }

  if (!categoryId || !context.categoryIds.includes(categoryId)) errors.categoryId = "Choose a category.";

  const locationLength = lengthError(location, 120);
  if (locationLength) errors.location = locationLength;
  const makeLength = lengthError(make, 80);
  if (makeLength) errors.make = makeLength;
  const modelLength = lengthError(model, 80);
  if (modelLength) errors.model = modelLength;
  const serialLength = lengthError(serialNumber, 80);
  if (serialLength) errors.serialNumber = serialLength;
  const barcodeLength = lengthError(barcode, 80);
  if (barcodeLength) errors.barcode = barcodeLength;
  const descriptionLength = lengthError(description, 2000);
  if (descriptionLength) errors.description = descriptionLength;

  const purchasedRaw = stringValue(formData, "purchasedOn");
  const purchasedOn = purchasedRaw ? parseDateOnly(purchasedRaw) : null;
  if (!purchasedRaw) errors.purchasedOn = "Enter a purchase date.";
  else if (!purchasedOn) errors.purchasedOn = "Enter a valid purchase date.";

  const assetMoney = parseMoney(stringValue(formData, "assetValue"));
  const endMoney = parseMoney(stringValue(formData, "endOfLifeValue"));
  if (!assetMoney.ok) errors.assetValue = MONEY;
  if (!endMoney.ok) errors.endOfLifeValue = MONEY;
  if (assetMoney.ok && endMoney.ok) {
    const endError = endOfLifeValueError(assetMoney.amount, endMoney.amount);
    if (endError) errors.endOfLifeValue = endError;
  }

  const life = parseLifeMonths(stringValue(formData, "lifeMonths"));
  if (!life.ok) errors.lifeMonths = life.error;

  if (companyId && !context.companies.some((company) => company.id === companyId)) {
    errors.companyId = "Choose an approved service company.";
  }
  const contactError = contactCompanyError(companyId, contactId, context.companies);
  if (contactError) errors.contactId = contactError;

  if (Object.keys(errors).length > 0 || !purchasedOn || !life.ok || !assetMoney.ok || !endMoney.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      categoryId,
      location: location || null,
      make: make || null,
      model: model || null,
      serialNumber: serialNumber || null,
      barcode: barcode || null,
      purchasedOn,
      assetValue: assetMoney.amount,
      endOfLifeValue: endMoney.amount,
      lifeMonths: life.months,
      description: description || null,
      companyId: companyId || null,
      contactId: contactId || null,
    },
  };
}

export function parseWarrantyForm(
  formData: FormData,
): { ok: true; value: WarrantyInput } | { ok: false; errors: Partial<Record<WarrantyField, string>> } {
  const errors: Partial<Record<WarrantyField, string>> = {};
  const provider = stringValue(formData, "provider");
  const notes = stringValue(formData, "notes");
  const startsRaw = stringValue(formData, "startsOn");
  const expiresRaw = stringValue(formData, "expiresOn");

  if (!provider) errors.provider = "Enter a provider.";
  else {
    const length = lengthError(provider, 160);
    if (length) errors.provider = length;
  }

  const startsOn = startsRaw ? parseDateOnly(startsRaw) : null;
  const expiresOn = expiresRaw ? parseDateOnly(expiresRaw) : null;
  if (!startsRaw) errors.startsOn = "Enter a start date.";
  else if (!startsOn) errors.startsOn = "Enter a valid start date.";
  if (!expiresRaw) errors.expiresOn = "Enter an expiry date.";
  else if (!expiresOn) errors.expiresOn = "Enter a valid expiry date.";

  const notesLength = lengthError(notes, 2000);
  if (notesLength) errors.notes = notesLength;

  if (Object.keys(errors).length > 0 || !startsOn || !expiresOn) return { ok: false, errors };

  return {
    ok: true,
    value: {
      provider,
      startsOn,
      expiresOn,
      notes: notes || null,
    },
  };
}

function formatCents(cents: number): string {
  const dollars = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${dollars}.${fraction}`;
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function lengthError(value: string, max: number): string | null {
  if (value.length > max) return `Use ${max} characters or fewer.`;
  return null;
}
