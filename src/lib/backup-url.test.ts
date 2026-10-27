import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(), lastAuditAt: vi.fn() }));

import { libpqUrl } from "./backup";

describe("the database URL given to pg_dump", () => {
  it("drops Prisma's own settings, which pg_dump refuses", () => {
    expect(libpqUrl("postgresql://u:p@postgres:5432/familycompass?schema=public")).toBe("postgresql://u:p@postgres:5432/familycompass");
    expect(libpqUrl("postgresql://u:p@h/db?schema=public&sslmode=require&connection_limit=5")).toBe("postgresql://u:p@h/db?sslmode=require");
  });
  it("keeps a URL with nothing to drop as it is", () => {
    expect(libpqUrl("postgresql://u:p%40x@h:5432/db")).toBe("postgresql://u:p%40x@h:5432/db");
  });
});
