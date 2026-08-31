import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Navigation/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof Tabs>;

const panel = (text: string) => (
  <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
    {text}
  </div>
);

export const ThreePanels: Story = {
  args: {
    items: [
      { id: "content", label: "Content", panel: panel("Page style, tribute copy, cover photo.") },
      { id: "service", label: "Service", panel: panel("Order of service, venue, days.") },
      {
        id: "people",
        label: "People helping",
        badge: 2,
        panel: panel("Collaborators and the contribution inbox."),
      },
    ],
  },
};
