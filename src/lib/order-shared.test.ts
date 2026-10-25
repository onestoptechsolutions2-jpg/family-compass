import { describe, expect, it } from "vitest";

import { arrival, dayText, kenyaToday, serviceWhenText } from "./order-shared";

describe("the service day", () => {
  it("is printed in words, with the time typed", () => {
    expect(dayText("2026-11-14")).toBe("Saturday 14 November 2026");
    expect(dayText("2026-11-14", true)).toBe("Sat 14 Nov");
    expect(serviceWhenText("2026-11-14", " 10am ")).toBe("Saturday 14 November 2026, 10am");
    expect(serviceWhenText("2026-11-14", "")).toBe("Saturday 14 November 2026");
  });
  it("is nothing when no day was picked", () => {
    expect(serviceWhenText(undefined, "10am")).toBeNull();
    expect(serviceWhenText("next week", "10am")).toBeNull();
  });
});

describe("when a programme arrives", () => {
  // 25 Oct 2026, 22:00 in Nairobi (19:00 UTC); 26 Oct after midnight there
  const evening = new Date("2026-10-25T19:00:00Z");
  const lateNight = new Date("2026-10-25T21:30:00Z");
  it("counts days in Kenya", () => {
    expect(kenyaToday(evening)).toBe("2026-10-25");
    expect(kenyaToday(lateNight)).toBe("2026-10-26");
  });
  it("is two days after payment, and says how that sits against the service", () => {
    expect(arrival(undefined, evening)).toEqual({ by: "2026-10-27", fit: "open" });
    expect(arrival("2026-10-31", evening)).toEqual({ by: "2026-10-27", fit: "early" });
    expect(arrival("2026-10-27", evening)).toEqual({ by: "2026-10-27", fit: "same-day" });
    expect(arrival("2026-10-26", evening)).toEqual({ by: "2026-10-27", fit: "late" });
  });
});
