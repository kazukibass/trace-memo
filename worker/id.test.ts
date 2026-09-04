import { describe, expect, it } from "vitest";
import { uuid7 } from "./id";

describe("uuid7", () => {
  it("creates an RFC 9562 version 7 identifier", () => {
    const value = uuid7(1_725_408_000_000);
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("keeps timestamp ordering across different milliseconds", () => {
    expect(uuid7(1_000) < uuid7(2_000)).toBe(true);
  });
});
