import { describe, expect, it } from "vitest";

import { EVENTS, EVENT_NAMES, isEventName, subscriptionMatches } from "./events-catalog";

describe("events catalogue", () => {
  it("every name has a non-empty description", () => {
    for (const name of EVENT_NAMES) {
      expect(EVENTS[name].length).toBeGreaterThan(0);
    }
  });

  it("carries the events added for life-event + anniversary integrations", () => {
    for (const name of [
      "person.event_recorded",
      "event.comment_added",
      "person.privacy_changed",
      "memorial.contribution_received",
      "memorial.tribute_left",
      "anniversary.upcoming",
      "chama.created",
      "chama.fund_opened",
      "chama.contribution_pledged",
      "chama.contribution_confirmed",
      "chama.fund_closed",
      "chama.external_event",
      "memory.added",
      "relation.named",
      "friend.invited",
      "friend.linked",
    ] as const) {
      expect(isEventName(name)).toBe(true);
    }
  });

  it("rejects unknown names", () => {
    expect(isEventName("person.exploded")).toBe(false);
  });

  it("subscriptionMatches honours '*' and exact names", () => {
    expect(subscriptionMatches(["*"], "anniversary.upcoming")).toBe(true);
    expect(subscriptionMatches(["person.event_recorded"], "person.event_recorded")).toBe(true);
    expect(subscriptionMatches(["person.created"], "anniversary.upcoming")).toBe(false);
  });
});
