import { describe, expect, it } from "vitest";
import { resolveStoredFile } from "./storage";

describe("resolveStoredFile", () => {
  it("accepts a generated file name", () => {
    const resolved = resolveStoredFile(`${"a".repeat(32)}.pdf`);
    expect(resolved).toMatch(/uploads\/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\.pdf$/);
  });

  it("rejects path traversal and unexpected names", () => {
    expect(resolveStoredFile("../secrets.env")).toBeNull();
    expect(resolveStoredFile(`${"a".repeat(32)}/../../etc/passwd`)).toBeNull();
    expect(resolveStoredFile(`${"a".repeat(31)}.pdf`)).toBeNull();
    expect(resolveStoredFile(`${"g".repeat(32)}.pdf`)).toBeNull();
  });
});
