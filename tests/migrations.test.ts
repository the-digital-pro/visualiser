import { describe, it, expect } from "vitest";
import { migrate } from "@/lib/migrations";

describe("migration ladder", () => {
  it("passes through a current-version project unchanged", () => {
    const input = {
      schemaVersion: 1,
      id: "x",
      name: "X",
      homeDiagramId: "h",
      diagrams: [],
    };
    expect(migrate(input)).toEqual(input);
  });

  it("rejects a project missing schemaVersion", () => {
    expect(() => migrate({})).toThrow(/schemaVersion/);
  });

  it("rejects a project whose schemaVersion exceeds the app", () => {
    expect(() => migrate({ schemaVersion: 999 })).toThrow(/newer than the app/);
  });
});
