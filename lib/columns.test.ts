import { describe, expect, it } from "vitest";
import { columnStorageKey, hiddenColumnIds } from "./columns";

describe("column choices", () => {
  it("keeps a separate saved list for each person and table", () => {
    expect(columnStorageKey("user-admin", "cases")).toBe("tnk-columns:user-admin:cases");
    expect(columnStorageKey("user-manager", "cases")).not.toBe(columnStorageKey("user-admin", "cases"));
    expect(columnStorageKey("user-admin", "work-orders")).toBe("tnk-columns:user-admin:work-orders");
  });

  it("keeps only known column ids from storage", () => {
    expect(hiddenColumnIds(null, ["type", "status"])).toEqual([]);
    expect(hiddenColumnIds('["type","number","nope"]', ["type", "status"])).toEqual(["type"]);
    expect(hiddenColumnIds("not-json", ["type"])).toEqual([]);
  });
});
