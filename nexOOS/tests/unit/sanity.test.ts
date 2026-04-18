import {
  normalizeDateForInput,
  normalizeDateForStorage,
} from "../../src/lib/date";

describe("date normalization helpers", () => {
  it("keeps ISO dates unchanged", () => {
    expect(normalizeDateForInput("2026-04-18")).toBe("2026-04-18");
  });

  it("converts slash-delimited dates to ISO format", () => {
    expect(normalizeDateForInput("4/8/2026")).toBe("2026-04-08");
  });

  it("returns an empty string for invalid input", () => {
    expect(normalizeDateForInput("not-a-date")).toBe("");
  });

  it("returns null when storage normalization fails", () => {
    expect(normalizeDateForStorage("")).toBeNull();
  });
});
