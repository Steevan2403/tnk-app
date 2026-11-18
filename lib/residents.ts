import { expiredBefore, normalizeEmail, parseDateOnly } from "./contractors";

export { formatCalendarDate, formatDateTime, formatIsoDate } from "./contractors";

export const PAGE_SIZE = 50;

export const RESIDENT_TABS = ["residents", "apartments"] as const;

export const APARTMENT_TABS = ["residents", "vehicles", "documents", "images", "requests"] as const;

export const RESIDENT_TYPES = ["owner", "tenant", "other"] as const;

export const OCCUPANCIES = ["owner_occupied", "investment"] as const;

export type ResidentTab = (typeof RESIDENT_TABS)[number];

export type ApartmentTab = (typeof APARTMENT_TABS)[number];

export type ResidentType = (typeof RESIDENT_TYPES)[number];

export type Occupancy = (typeof OCCUPANCIES)[number];

export type ApartmentIdentity = {
  id: string;
  buildingId: string;
  number: string;
  lotNumber: string;
};

export type ApartmentInput = {
  number: string;
  lotNumber: string;
};

export type ApartmentField = keyof ApartmentInput;

export type ResidentInput = {
  apartmentId: string;
  firstName: string;
  lastName: string;
  type: ResidentType;
  phone: string | null;
  mobile: string | null;
  secondaryPhone: string | null;
  email: string | null;
  moveInOn: Date | null;
  moveOutOn: Date | null;
  primaryContact: boolean;
  notes: string | null;
};

export type ResidentField = keyof ResidentInput;

export type VehicleInput = {
  registration: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  carSpace: string | null;
  location: string | null;
};

export type VehicleField = keyof VehicleInput | "photo";

export type OwnerInput = {
  name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  postalAddress: string | null;
  strataCommittee: boolean;
};

export type OwnerField = keyof OwnerInput;

export type AgentInput = {
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type AgentField = keyof AgentInput;

export type NoteField = "body";

export type DocumentField = "name" | "file" | "expiresOn";

export type ImageField = "files";

export type ResidentContext = {
  apartmentIds: string[];
  primaryResidentIds: string[];
  ignoreId?: string;
};

export function parseResidentTab(value: string): ResidentTab {
  return value === "apartments" ? "apartments" : "residents";
}

export function parseApartmentTab(value: string): ApartmentTab {
  return APARTMENT_TABS.includes(value as ApartmentTab) ? (value as ApartmentTab) : "residents";
}

export function parsePage(value: string): number {
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1) return 1;
  if (page > 10000) return 10000;
  return page;
}

export function parseResidentType(value: string): ResidentType | "" {
  return RESIDENT_TYPES.includes(value as ResidentType) ? (value as ResidentType) : "";
}

export function parseOccupancy(value: string): Occupancy | null {
  return OCCUPANCIES.includes(value as Occupancy) ? (value as Occupancy) : null;
}

export function compareLabel(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function residentName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function initials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

export function formatResidentType(type: string): string {
  if (type === "owner") return "Owner";
  if (type === "tenant") return "Tenant";
  if (type === "other") return "Other";
  return type;
}

export function formatOccupancy(occupancy: string): string {
  return occupancy === "investment" ? "Investment" : "Owner-occupied";
}

export function isExpiredDate(date: Date, today = new Date()): boolean {
  return date.getTime() < expiredBefore(today).getTime();
}

export function apartmentIdentityErrors(
  existing: ApartmentIdentity[],
  buildingId: string,
  input: ApartmentInput,
  ignoreId?: string,
): Partial<Record<ApartmentField, string>> {
  const errors: Partial<Record<ApartmentField, string>> = {};
  const numberKey = identityKey(input.number);
  const lotKey = identityKey(input.lotNumber);
  const inBuilding = existing.filter((item) => item.buildingId === buildingId && item.id !== ignoreId);

  if (numberKey && inBuilding.some((item) => identityKey(item.number) === numberKey)) {
    errors.number = "That apartment number is already used in this building.";
  }
  if (lotKey && inBuilding.some((item) => identityKey(item.lotNumber) === lotKey)) {
    errors.lotNumber = "That lot number is already used in this building.";
  }
  return errors;
}

export function parseApartmentForm(
  formData: FormData,
  existing: ApartmentIdentity[],
  buildingId: string,
  ignoreId?: string,
): { ok: true; value: ApartmentInput } | { ok: false; errors: Partial<Record<ApartmentField, string>> } {
  const errors: Partial<Record<ApartmentField, string>> = {};
  const number = stringValue(formData, "number");
  const lotNumber = stringValue(formData, "lotNumber");

  if (!number) errors.number = "Enter an apartment number.";
  else {
    const length = lengthError(number, 20);
    if (length) errors.number = length;
  }

  if (!lotNumber) errors.lotNumber = "Enter a lot number.";
  else {
    const length = lengthError(lotNumber, 20);
    if (length) errors.lotNumber = length;
  }

  if (!errors.number && !errors.lotNumber) {
    Object.assign(errors, apartmentIdentityErrors(existing, buildingId, { number, lotNumber }, ignoreId));
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { number, lotNumber } };
}

export function parseResidentForm(
  formData: FormData,
  context: ResidentContext,
): { ok: true; value: ResidentInput } | { ok: false; errors: Partial<Record<ResidentField, string>> } {
  const errors: Partial<Record<ResidentField, string>> = {};
  const apartmentId = stringValue(formData, "apartmentId");
  const firstName = stringValue(formData, "firstName");
  const lastName = stringValue(formData, "lastName");
  const typeRaw = stringValue(formData, "type");
  const phone = stringValue(formData, "phone");
  const mobile = stringValue(formData, "mobile");
  const secondaryPhone = stringValue(formData, "secondaryPhone");
  const notes = stringValue(formData, "notes");
  const email = normalizeEmail(stringValue(formData, "email"));
  const primaryContact = checked(formData, "primaryContact");

  if (!apartmentId || !context.apartmentIds.includes(apartmentId)) {
    errors.apartmentId = "Choose an apartment.";
  }

  if (!firstName) errors.firstName = "Enter a first name.";
  else {
    const length = lengthError(firstName, 80);
    if (length) errors.firstName = length;
  }

  if (!lastName) errors.lastName = "Enter a last name.";
  else {
    const length = lengthError(lastName, 80);
    if (length) errors.lastName = length;
  }

  const type = parseResidentType(typeRaw);
  if (!type) errors.type = "Choose a resident type.";

  const phoneLength = lengthError(phone, 40);
  if (phoneLength) errors.phone = phoneLength;
  const mobileLength = lengthError(mobile, 40);
  if (mobileLength) errors.mobile = mobileLength;
  const secondaryLength = lengthError(secondaryPhone, 40);
  if (secondaryLength) errors.secondaryPhone = secondaryLength;
  if (!email.ok) errors.email = "Enter a valid email address.";

  const notesLength = lengthError(notes, 2000);
  if (notesLength) errors.notes = notesLength;

  const moveInRaw = stringValue(formData, "moveInOn");
  const moveOutRaw = stringValue(formData, "moveOutOn");
  const moveInOn = moveInRaw ? parseDateOnly(moveInRaw) : null;
  const moveOutOn = moveOutRaw ? parseDateOnly(moveOutRaw) : null;
  if (moveInRaw && !moveInOn) errors.moveInOn = "Enter a valid move-in date.";
  if (moveOutRaw && !moveOutOn) errors.moveOutOn = "Enter a valid move-out date.";
  if (!errors.moveInOn && !errors.moveOutOn) {
    const dateError = moveDateError(moveInOn, moveOutOn);
    if (dateError) errors.moveOutOn = dateError;
  }

  if (
    !errors.apartmentId &&
    primaryContact &&
    context.primaryResidentIds.some((id) => id !== context.ignoreId)
  ) {
    errors.primaryContact = "This apartment already has a primary contact.";
  }

  if (Object.keys(errors).length > 0 || !email.ok || !type) return { ok: false, errors };

  return {
    ok: true,
    value: {
      apartmentId,
      firstName,
      lastName,
      type,
      phone: phone || null,
      mobile: mobile || null,
      secondaryPhone: secondaryPhone || null,
      email: email.email,
      moveInOn,
      moveOutOn,
      primaryContact,
      notes: notes || null,
    },
  };
}

export function moveDateError(moveIn: Date | null, moveOut: Date | null): string | null {
  if (!moveOut) return null;
  if (!moveIn) return "Enter a move-in date before the move-out date.";
  if (moveOut.getTime() <= moveIn.getTime()) return "Move-out must be after move-in.";
  return null;
}

export function parseVehicleForm(
  formData: FormData,
): { ok: true; value: VehicleInput } | { ok: false; errors: Partial<Record<VehicleField, string>> } {
  const errors: Partial<Record<VehicleField, string>> = {};
  const registration = normalizeRegistration(stringValue(formData, "registration"));
  const make = stringValue(formData, "make");
  const model = stringValue(formData, "model");
  const colour = stringValue(formData, "colour");
  const carSpace = stringValue(formData, "carSpace");
  const location = stringValue(formData, "location");

  if (!registration.ok) errors.registration = registration.error;
  const makeLength = lengthError(make, 40);
  if (makeLength) errors.make = makeLength;
  const modelLength = lengthError(model, 40);
  if (modelLength) errors.model = modelLength;
  const colourLength = lengthError(colour, 40);
  if (colourLength) errors.colour = colourLength;
  const spaceLength = lengthError(carSpace, 20);
  if (spaceLength) errors.carSpace = spaceLength;
  const locationLength = lengthError(location, 80);
  if (locationLength) errors.location = locationLength;

  if (Object.keys(errors).length > 0 || !registration.ok) return { ok: false, errors };

  return {
    ok: true,
    value: {
      registration: registration.registration,
      make: make || null,
      model: model || null,
      colour: colour || null,
      carSpace: carSpace || null,
      location: location || null,
    },
  };
}

export function parseOwnerForm(
  formData: FormData,
): { ok: true; value: OwnerInput } | { ok: false; errors: Partial<Record<OwnerField, string>> } {
  const errors: Partial<Record<OwnerField, string>> = {};
  const name = stringValue(formData, "name");
  const phone = stringValue(formData, "phone");
  const mobile = stringValue(formData, "mobile");
  const postalAddress = stringValue(formData, "postalAddress");
  const email = normalizeEmail(stringValue(formData, "email"));

  if (!name) errors.name = "Enter a name.";
  else {
    const length = lengthError(name, 120);
    if (length) errors.name = length;
  }

  const phoneLength = lengthError(phone, 40);
  if (phoneLength) errors.phone = phoneLength;
  const mobileLength = lengthError(mobile, 40);
  if (mobileLength) errors.mobile = mobileLength;
  const addressLength = lengthError(postalAddress, 300);
  if (addressLength) errors.postalAddress = addressLength;
  if (!email.ok) errors.email = "Enter a valid email address.";

  if (Object.keys(errors).length > 0 || !email.ok) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      phone: phone || null,
      mobile: mobile || null,
      email: email.email,
      postalAddress: postalAddress || null,
      strataCommittee: checked(formData, "strataCommittee"),
    },
  };
}

export function parseAgentForm(
  formData: FormData,
): { ok: true; value: AgentInput } | { ok: false; errors: Partial<Record<AgentField, string>> } {
  const errors: Partial<Record<AgentField, string>> = {};
  const company = stringValue(formData, "company");
  const contactName = stringValue(formData, "contactName");
  const phone = stringValue(formData, "phone");
  const address = stringValue(formData, "address");
  const email = normalizeEmail(stringValue(formData, "email"));

  if (!company) errors.company = "Enter a company.";
  else {
    const length = lengthError(company, 160);
    if (length) errors.company = length;
  }

  const contactLength = lengthError(contactName, 120);
  if (contactLength) errors.contactName = contactLength;
  const phoneLength = lengthError(phone, 40);
  if (phoneLength) errors.phone = phoneLength;
  const addressLength = lengthError(address, 300);
  if (addressLength) errors.address = addressLength;
  if (!email.ok) errors.email = "Enter a valid email address.";

  if (Object.keys(errors).length > 0 || !email.ok) return { ok: false, errors };

  return {
    ok: true,
    value: {
      company,
      contactName: contactName || null,
      phone: phone || null,
      email: email.email,
      address: address || null,
    },
  };
}

export function parseNoteBody(value: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = value.trim();
  if (!body) return { ok: false, error: "Enter a note." };
  if (body.length > 2000) return { ok: false, error: "Use 2000 characters or fewer." };
  return { ok: true, body };
}

export function parseOptionalDate(value: string): { ok: true; date: Date | null } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, date: null };
  const date = parseDateOnly(trimmed);
  if (!date) return { ok: false };
  return { ok: true, date };
}

export function normalizeRegistration(
  value: string,
): { ok: true; registration: string } | { ok: false; error: string } {
  const registration = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (!registration) return { ok: false, error: "Enter a registration." };
  if (registration.length > 20) return { ok: false, error: "Use 20 characters or fewer." };
  if (!/^[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/.test(registration)) {
    return { ok: false, error: "Use letters, numbers, spaces, and hyphens." };
  }
  return { ok: true, registration };
}

function identityKey(value: string): string {
  return value.trim().toLowerCase();
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function lengthError(value: string, max: number): string | null {
  if (value.length > max) return `Use ${max} characters or fewer.`;
  return null;
}
