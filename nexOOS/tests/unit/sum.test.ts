import { buildApiUrl } from "../../src/lib/api";
import {
  isValidPhilippinePhone,
  normalizePhilippinePhone,
} from "../../src/lib/phone";

describe("frontend utility helpers", () => {
  it("builds API urls from relative paths with the default base url", () => {
    expect(buildApiUrl("/api/products")).toBe(
      "http://localhost:4000/api/products",
    );
    expect(buildApiUrl("api/orders")).toBe(
      "http://localhost:4000/api/orders",
    );
  });

  it("returns absolute urls unchanged", () => {
    expect(buildApiUrl("https://cdn.example.com/image.png")).toBe(
      "https://cdn.example.com/image.png",
    );
  });

  it("normalizes valid Philippine phone numbers", () => {
    expect(normalizePhilippinePhone("09123456789")).toBe("+639123456789");
    expect(normalizePhilippinePhone("639123456789")).toBe("+639123456789");
    expect(normalizePhilippinePhone("+639123456789")).toBe("+639123456789");
  });

  it("rejects invalid Philippine phone numbers", () => {
    expect(normalizePhilippinePhone("12345")).toBeNull();
    expect(isValidPhilippinePhone("12345")).toBe(false);
    expect(isValidPhilippinePhone("09123456789")).toBe(true);
  });
});
