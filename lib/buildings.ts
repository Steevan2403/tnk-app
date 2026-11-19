export const AU_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

export type BuildingInput = {
  name: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  photoUrl: string | null;
  lotCount: number;
  strataPlan: string | null;
  siteContactName: string | null;
  siteContactMobile: string | null;
  siteContactEmail: string | null;
};

export type BuildingRecord = BuildingInput & { id: string };

export type BuildingField = keyof BuildingInput;

const STATE_SET = new Set<string>(AU_STATES);

export function parseBuildingForm(
  formData: FormData,
): { ok: true; value: BuildingInput } | { ok: false; errors: Partial<Record<BuildingField, string>> } {
  const errors: Partial<Record<BuildingField, string>> = {};

  const name = stringValue(formData, "name");
  const address = stringValue(formData, "address");
  const suburb = stringValue(formData, "suburb");
  const state = stringValue(formData, "state").toUpperCase();
  const postcode = stringValue(formData, "postcode");
  const photoRaw = stringValue(formData, "photoUrl");
  const lotRaw = stringValue(formData, "lotCount");
  const strataPlan = optionalText(stringValue(formData, "strataPlan"), 40, "strataPlan", errors, "Use 40 characters or fewer.");
  const siteContactName = optionalText(
    stringValue(formData, "siteContactName"),
    120,
    "siteContactName",
    errors,
    "Use 120 characters or fewer.",
  );
  const siteContactMobile = optionalText(
    stringValue(formData, "siteContactMobile"),
    40,
    "siteContactMobile",
    errors,
    "Use 40 characters or fewer.",
  );
  const siteContactEmail = optionalEmail(stringValue(formData, "siteContactEmail"), errors);

  if (!name) errors.name = "Enter a name.";
  else if (name.length > 120) errors.name = "Use 120 characters or fewer.";

  if (!address) errors.address = "Enter a street address.";
  else if (address.length > 200) errors.address = "Use 200 characters or fewer.";

  if (!suburb) errors.suburb = "Enter a suburb.";
  else if (suburb.length > 80) errors.suburb = "Use 80 characters or fewer.";

  if (!STATE_SET.has(state)) errors.state = "Choose an Australian state or territory.";

  if (!/^\d{4}$/.test(postcode)) errors.postcode = "Enter a 4-digit postcode.";

  let photoUrl: string | null = null;
  if (photoRaw) {
    try {
      const url = new URL(photoRaw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.photoUrl = "Photo link must start with http or https.";
      } else {
        photoUrl = url.toString();
      }
    } catch {
      errors.photoUrl = "Enter a valid photo link.";
    }
  }

  let lotCount = 0;
  if (!/^\d+$/.test(lotRaw)) {
    errors.lotCount = "Enter a whole number of lots.";
  } else {
    lotCount = Number(lotRaw);
    if (lotCount > 10000) errors.lotCount = "Enter 10000 lots or fewer.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      address,
      suburb,
      state,
      postcode,
      photoUrl,
      lotCount,
      strataPlan,
      siteContactName,
      siteContactMobile,
      siteContactEmail,
    },
  };
}

export function formatAddress(building: {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}): string {
  return `${building.address}, ${building.suburb} ${building.state} ${building.postcode}`;
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(
  value: string,
  max: number,
  field: BuildingField,
  errors: Partial<Record<BuildingField, string>>,
  message: string,
): string | null {
  if (!value) return null;
  if (value.length > max) errors[field] = message;
  return value;
}

function optionalEmail(value: string, errors: Partial<Record<BuildingField, string>>): string | null {
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+$/.test(value) || value.length > 200) {
    errors.siteContactEmail = "Enter a valid email.";
  }
  return value;
}
