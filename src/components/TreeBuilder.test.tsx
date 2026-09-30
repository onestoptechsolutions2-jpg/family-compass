// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const autosave = vi.fn(async (_token: string, _json: string) => ({ ok: true }));
vi.mock("@/app/order/[token]/builder-actions", () => ({
  autosaveBuilder: (t: string, j: string) => autosave(t, j),
  continueBuilder: vi.fn(),
}));

import { TreeBuilder } from "./TreeBuilder";

beforeAll(() => {
  // jsdom has no layout or media queries
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  autosave.mockClear();
  localStorage.clear();
});

const base = { token: "tok123", slug: "wooden-family-tree", pathway: "LIVING" as const, layout: "tree" as const, origin: "https://example.test", materialKey: "wood", productName: "Wooden family tree" };
const slot = (c: HTMLElement, id: string) => c.querySelector(`[data-slot="${id}"]`) as SVGGElement | null;
const drawn = (c: HTMLElement) => waitFor(() => expect(c.querySelector("svg")).not.toBeNull());
const saved = () => JSON.parse((document.querySelector('input[name="options"]') as HTMLInputElement).value) as Record<string, string>;

describe("the tree builder", () => {
  it("draws the real piece with empty places to tap", async () => {
    const { container } = render(<TreeBuilder {...base} initial={{}} />);
    await drawn(container);
    for (const s of ["father", "mother", "spouse", "sibling:new", "child:new", "focus"]) expect(slot(container, s), s).not.toBeNull();
    expect(slot(container, "father")!.getAttribute("class")).toContain("tb-ghost");
    expect(slot(container, "focus")!.getAttribute("class")).not.toContain("tb-ghost");
    expect(container.querySelector("svg")!.getAttribute("width")).toBe("100%");
  });

  it("taps a dashed place, names someone, and they appear on the tree", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "Kamau" }} />);
    await drawn(container);
    await user.click(slot(container, "mother")!);
    expect(screen.getByRole("heading", { name: "Mother" })).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Mary Wanjiku");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(container.textContent).toContain("Mary Wanjiku"));
    expect(slot(container, "mother")!.getAttribute("class")).not.toContain("tb-ghost");
    expect(screen.queryByRole("heading", { name: "Mother" })).toBeNull(); // the panel closes
    // a mother on her own stays the mother: her place is kept
    expect(saved().parents).toBe("\nMary Wanjiku");
  });

  it("opens grandparent places only once their child is on the tree", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "Kamau" }} />);
    await drawn(container);
    expect(slot(container, "gp:mf")).toBeNull();
    await user.click(slot(container, "mother")!);
    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Mary");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(slot(container, "gp:mf")).not.toBeNull());
    expect(slot(container, "gp:ff")).toBeNull(); // no father yet
  });

  it("adds a whole family in a row without reopening", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "Kamau" }} />);
    await drawn(container);
    await user.click(slot(container, "child:new")!);
    const name = () => screen.getByRole("textbox", { name: /full name/i });
    await user.type(name(), "Lucy");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/Added Lucy/)).toBeTruthy(); // still open, ready for the next
    await user.type(name(), "Ben");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(saved().children).toBe("Lucy\nBen"));
    expect(slot(container, "child:0")).not.toBeNull();
    expect(slot(container, "child:1")).not.toBeNull();
  });

  it("changes and removes a person", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "Kamau", children: "Lucy\nBen" }} />);
    await drawn(container);
    await user.click(slot(container, "child:0")!);
    const name = screen.getByRole("textbox", { name: /full name/i }) as HTMLInputElement;
    expect(name.value).toBe("Lucy");
    await user.clear(name);
    await user.type(name, "Lucia");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved().children).toBe("Lucia\nBen"));
    await waitFor(() => expect(container.textContent).toContain("Lucia")); // the tree has redrawn
    await user.click(slot(container, "child:1")!);
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(saved().children).toBe("Lucia"));
  });

  it("cancelling changes nothing", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "Kamau", spouse: "Tom" }} />);
    await drawn(container);
    await user.click(slot(container, "spouse")!);
    await user.clear(screen.getByRole("textbox", { name: /full name/i }));
    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Someone Else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saved().spouse).toBe("Tom");
  });

  it("can be used from the keyboard", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann" }} />);
    await drawn(container);
    slot(container, "spouse")!.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Spouse" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /full name/i }));
  });

  it("will not continue until the person in the middle has a name", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{}} />);
    await drawn(container);
    const go = screen.getByRole("button", { name: /Continue/ }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await user.click(slot(container, "focus")!);
    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Hesbon Okusimba Musungu");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect((screen.getByRole("button", { name: /Continue/ }) as HTMLButtonElement).disabled).toBe(false));
    expect([saved().first, saved().surname]).toEqual(["Hesbon Okusimba", "Musungu"]);
  });

  it("asks for a death year only when remembering someone", async () => {
    const user = userEvent.setup();
    const living = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "K" }} />);
    await drawn(living.container);
    await user.click(slot(living.container, "focus")!);
    expect(screen.queryByText(/Died \(year\)/)).toBeNull();
    living.unmount();

    const gone = render(<TreeBuilder {...base} pathway="REMEMBERED" initial={{ first: "John", surname: "Kamau" }} />);
    await drawn(gone.container);
    await user.click(slot(gone.container, "focus")!);
    await user.type(screen.getByLabelText(/Died \(year\)/), "2026");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved().death).toBe("2026"));
    expect(screen.getByLabelText(/You are their/)).toBeTruthy();
    expect(gone.container.textContent).toContain("†");
  });

  it("asks for a banner title on a banner", async () => {
    const { container } = render(<TreeBuilder {...base} layout="banner" initial={{ first: "Hesbon", surname: "Musungu", title: "Musungu Reunion" }} />);
    await drawn(container);
    expect(screen.getByLabelText("Banner title")).toBeTruthy();
    await waitFor(() => expect(container.textContent).toContain("Musungu Reunion"));
  });

  it("saves as you go, without pressing anything", async () => {
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "Kamau" }} />);
    await drawn(container);
    expect(autosave).not.toHaveBeenCalled(); // nothing changed yet
    await user.click(slot(container, "spouse")!);
    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Tom Otieno");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(autosave).toHaveBeenCalled(), { timeout: 4000 });
    const [token, json] = autosave.mock.calls.at(-1)!;
    expect(token).toBe("tok123");
    expect(JSON.parse(json).spouse).toBe("Tom Otieno");
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  });

  it("reports a save that failed instead of pretending", async () => {
    autosave.mockResolvedValueOnce({ ok: false });
    const user = userEvent.setup();
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann", surname: "Kamau" }} />);
    await drawn(container);
    await user.click(slot(container, "spouse")!);
    await user.type(screen.getByRole("textbox", { name: /full name/i }), "Tom");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByText(/Could not save just now/)).toBeTruthy(), { timeout: 4000 });
  });

  it("remembers the private link in this browser", async () => {
    const { container } = render(<TreeBuilder {...base} initial={{ first: "Ann" }} />);
    await drawn(container);
    expect(localStorage.getItem("fc:draft:wooden-family-tree")).toBe("tok123");
  });

  it("puts no names in the page's own text other than the tree's", async () => {
    const { container } = render(<TreeBuilder {...base} initial={{ first: "<script>alert(1)</script>", surname: "X" }} />);
    await drawn(container);
    expect(container.querySelector("svg script")).toBeNull();
    expect(within(container).queryByText("alert(1)")).toBeNull();
  });
});
