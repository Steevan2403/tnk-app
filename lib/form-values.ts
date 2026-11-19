export type SubmittedValues = Record<string, string | string[]>;

type ControlValue = string | number | readonly string[] | undefined;

export function submittedValues(formData: FormData): SubmittedValues {
  const values: SubmittedValues = {};
  for (const [key, entry] of formData.entries()) {
    if (typeof entry !== "string") continue;
    const current = values[key];
    if (current === undefined) values[key] = entry;
    else if (Array.isArray(current)) current.push(entry);
    else values[key] = [current, entry];
  }
  return values;
}

export function attachSubmitted<T extends { error?: string; errors?: unknown }>(
  formData: FormData,
  state: T,
): T & { values?: SubmittedValues } {
  if (!state.error && !state.errors) return state;
  return { ...state, values: submittedValues(formData) };
}

export function valuesKey(values: SubmittedValues | undefined): string {
  return values ? JSON.stringify(values) : "initial";
}

export function textValue(values: SubmittedValues | undefined, name: string, fallback: ControlValue): ControlValue {
  if (!values || !Object.hasOwn(values, name)) return fallback;
  const value = values[name];
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

export function listValue(values: SubmittedValues | undefined, name: string, fallback: string[]): string[] {
  if (!values) return fallback;
  if (!Object.hasOwn(values, name)) return [];
  const value = values[name];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function checkedValue(
  values: SubmittedValues | undefined,
  name: string,
  fallback: boolean | undefined,
): boolean | undefined {
  if (!values) return fallback;
  if (!Object.hasOwn(values, name)) return false;
  const value = values[name];
  const text = Array.isArray(value) ? (value[value.length - 1] ?? "") : value;
  return text === "on" || text === "true" || text === "yes" || text === "1";
}
