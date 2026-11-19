import { describe, expect, it } from "vitest";
import { attachSubmitted, checkedValue, listValue, submittedValues, textValue, valuesKey } from "./form-values";

function data(fields: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else form.set(key, value);
  }
  return form;
}

describe("submitted form values", () => {
  it("keeps text, groups repeated fields, and skips files", () => {
    const form = data({
      subject: "Example leaking tap",
      area: "asset",
      assetId: ["pump", "lift"],
      includeInReport: "on",
    });
    form.append("photo", new File(["example"], "pump.png", { type: "image/png" }));

    expect(submittedValues(form)).toEqual({
      subject: "Example leaking tap",
      area: "asset",
      assetId: ["pump", "lift"],
      includeInReport: "on",
    });
  });

  it("returns the submitted values only with an error", () => {
    const form = data({ email: "resident.example@example.com", type: "tenant" });
    expect(attachSubmitted(form, {})).toEqual({});
    expect(attachSubmitted(form, { error: "The resident could not be saved." }).values).toEqual({
      email: "resident.example@example.com",
      type: "tenant",
    });
    expect(attachSubmitted(form, { errors: { firstName: "Use 80 characters or fewer." } }).values?.type).toBe("tenant");
  });

  it("reads text, lists, and checkboxes back out of an error", () => {
    const values = submittedValues(
      data({ subject: "Example leaking tap", assetId: ["pump"], includeInReport: "on", dueDate: "2026-11-01" }),
    );

    expect(textValue(undefined, "subject", "")).toBe("");
    expect(textValue(values, "subject", "")).toBe("Example leaking tap");
    expect(textValue(values, "missing", "fallback")).toBe("fallback");
    expect(listValue(undefined, "assetId", ["kept"])).toEqual(["kept"]);
    expect(listValue(values, "assetId", ["kept"])).toEqual(["pump"]);
    expect(listValue(values, "companyId", ["kept"])).toEqual([]);
    expect(checkedValue(undefined, "includeInReport", true)).toBe(true);
    expect(checkedValue(values, "includeInReport", true)).toBe(true);
    expect(checkedValue(values, "primaryContact", true)).toBe(false);
    expect(valuesKey(undefined)).toBe("initial");
    expect(valuesKey(values)).toBe(JSON.stringify(values));
  });
});
