import { afterEach, describe, expect, it } from "vitest";

import { clientIp, clientIpFromHeaders } from "./user-agent";

afterEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS;
});

describe("who the client is, behind our reverse proxy", () => {
  it("takes the address the proxy added, which is the last one", () => {
    expect(clientIp("203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("198.51.100.7, 203.0.113.9")).toBe("203.0.113.9");
  });

  it("ignores whatever the client claimed on the left", () => {
    // the client sent "X-Forwarded-For: 1.1.1.1"; the proxy appended the real address
    expect(clientIp("1.1.1.1, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.9")).toBe("203.0.113.9");
  });

  it("two attackers claiming different addresses are still the same visitor", () => {
    expect(clientIp("1.1.1.1, 203.0.113.9")).toBe(clientIp("9.9.9.9, 203.0.113.9"));
  });

  it("goes further left when more proxies are trusted", () => {
    expect(clientIp("198.51.100.7, 10.0.0.2, 10.0.0.3", 2)).toBe("10.0.0.2");
    expect(clientIp("198.51.100.7, 10.0.0.2, 10.0.0.3", 3)).toBe("198.51.100.7");
    expect(clientIp("203.0.113.9", 3)).toBe("203.0.113.9");
  });

  it("trusts nothing when there is no proxy", () => {
    expect(clientIp("1.1.1.1", 0)).toBeNull();
  });

  it("copes with nothing, blanks and spaces", () => {
    expect(clientIp(null)).toBeNull();
    expect(clientIp("")).toBeNull();
    expect(clientIp(" , ,")).toBeNull();
    expect(clientIp(" 1.1.1.1 ,  203.0.113.9 ")).toBe("203.0.113.9");
  });

  it("is set by TRUSTED_PROXY_HOPS, and a bad value falls back to one", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIp("a, b, c")).toBe("b");
    process.env.TRUSTED_PROXY_HOPS = "banana";
    expect(clientIp("a, b, c")).toBe("c");
    process.env.TRUSTED_PROXY_HOPS = "0";
    expect(clientIp("a, b, c")).toBeNull();
  });

  it("reads a request's headers, falling back to X-Real-IP only when a proxy is trusted", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    process.env.TRUSTED_PROXY_HOPS = "0";
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "203.0.113.5" }))).toBeNull();
  });
});
