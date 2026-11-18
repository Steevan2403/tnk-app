import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("accepts the password that was hashed", async () => {
    const stored = await hashPassword("example-admin-pass");
    expect(await verifyPassword("example-admin-pass", stored)).toBe(true);
  });

  it("rejects a different password", async () => {
    const stored = await hashPassword("example-admin-pass");
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("rejects a stored value that is not a hash", async () => {
    expect(await verifyPassword("example-admin-pass", "not-a-hash")).toBe(false);
  });
});
