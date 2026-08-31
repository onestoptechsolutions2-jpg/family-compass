import { describe, it, expect } from "vitest";

import { humanBytes } from "@/lib/format";

describe("humanBytes", () => {
  it("bytes", () => {
    expect(humanBytes(0)).toBe("0 B");
    expect(humanBytes(512)).toBe("512 B");
  });
  it("KB / MB / GB", () => {
    expect(humanBytes(1024)).toBe("1.0 KB");
    expect(humanBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(humanBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });
  it("drops the decimal at/above 100", () => {
    expect(humanBytes(250 * 1024 * 1024)).toBe("250 MB");
  });
});
