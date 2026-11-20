import { canUseBuilding, selectedBuildingForUser } from "./buildings";
import { compareLabel } from "./residents";
import { canManageResidents } from "./roles";

export const KEY_TYPES = ["door", "mailbox", "garage_remote", "fob", "swipe_card", "other"] as const;

export type KeyType = (typeof KEY_TYPES)[number];

export type KeyField = "number" | "type" | "location" | "comment";

export type KeyInput = {
  number: string;
  type: KeyType;
  location: string | null;
  comment: string | null;
};

export type StoredKey = {
  id: string;
  number: string;
};

export type KeyApartment = {
  id: string;
  buildingId: string;
};

export type KeyActor = {
  role: string;
  selectedBuildingId: string | null;
  memberBuildingIds: readonly string[];
};

const KEY_TYPE_LABELS: Record<KeyType, string> = {
  door: "Door",
  mailbox: "Mailbox",
  garage_remote: "Garage remote",
  fob: "Fob",
  swipe_card: "Swipe card",
  other: "Other",
};

export const KEY_CHANGE_DENIED = "You do not have permission to change keys.";

export function formatKeyType(type: string): string {
  return KEY_TYPE_LABELS[type as KeyType] ?? type;
}

export function sortKeys<T extends { number: string }>(keys: readonly T[]): T[] {
  return [...keys].sort((a, b) => compareLabel(a.number, b.number));
}

export function parseKeyForm(
  formData: FormData,
): { ok: true; value: KeyInput } | { ok: false; errors: Partial<Record<KeyField, string>> } {
  const errors: Partial<Record<KeyField, string>> = {};
  const number = text(formData, "number");
  const typeRaw = text(formData, "type");
  const location = text(formData, "location");
  const comment = text(formData, "comment");

  if (!number) errors.number = "Enter a key number.";
  else if (number.length > 40) errors.number = "Use 40 characters or fewer.";

  if (!isKeyType(typeRaw)) errors.type = "Choose a key type.";
  if (location.length > 80) errors.location = "Use 80 characters or fewer.";
  if (comment.length > 500) errors.comment = "Use 500 characters or fewer.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      number,
      type: typeRaw as KeyType,
      location: location || null,
      comment: comment || null,
    },
  };
}

// Keys belong to the apartment in the building this person currently has selected.
export function keyApartmentAccess(
  actor: KeyActor,
  apartment: KeyApartment | null,
): { ok: true } | { ok: false; status: 404 } {
  const buildingId = selectedBuildingForUser(actor.role, actor.selectedBuildingId, actor.memberBuildingIds);
  if (!buildingId || !apartment || apartment.buildingId !== buildingId) return { ok: false, status: 404 };
  if (!canUseBuilding(actor.role, apartment.buildingId, actor.memberBuildingIds)) return { ok: false, status: 404 };
  return { ok: true };
}

export function planKeySave(input: {
  actor: KeyActor;
  apartment: KeyApartment | null;
  keys: readonly StoredKey[];
  formData: FormData;
}):
  | { ok: true; action: "create"; apartmentId: string; value: KeyInput }
  | { ok: true; action: "update"; keyId: string; value: KeyInput }
  | { ok: false; status: 404 }
  | { ok: false; error: string }
  | { ok: false; errors: Partial<Record<KeyField, string>> } {
  const access = keyApartmentAccess(input.actor, input.apartment);
  if (!access.ok) return access;
  if (!canManageResidents(input.actor.role)) return { ok: false, error: KEY_CHANGE_DENIED };

  const parsed = parseKeyForm(input.formData);
  if (!parsed.ok) return parsed;

  const keyId = text(input.formData, "keyId");
  const duplicate = input.keys.some(
    (key) => key.id !== keyId && sameNumber(key.number, parsed.value.number),
  );
  if (duplicate) return { ok: false, errors: { number: "That key number is already on this apartment." } };

  if (!keyId) return { ok: true, action: "create", apartmentId: input.apartment!.id, value: parsed.value };

  if (!input.keys.some((key) => key.id === keyId)) return { ok: false, error: "That key could not be found." };
  return { ok: true, action: "update", keyId, value: parsed.value };
}

export function planKeyDelete(input: {
  actor: KeyActor;
  apartment: KeyApartment | null;
  keys: readonly StoredKey[];
  keyId: string;
}): { ok: true; keyId: string } | { ok: false; status: 404 } | { ok: false; error: string } {
  const access = keyApartmentAccess(input.actor, input.apartment);
  if (!access.ok) return access;
  if (!canManageResidents(input.actor.role)) return { ok: false, error: KEY_CHANGE_DENIED };

  const keyId = input.keyId.trim();
  if (!input.keys.some((key) => key.id === keyId)) return { ok: false, error: "That key could not be found." };
  return { ok: true, keyId };
}

function isKeyType(value: string): value is KeyType {
  return KEY_TYPES.includes(value as KeyType);
}

function sameNumber(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
