import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Dialog } from "./Dialog";

const meta: Meta<typeof Dialog> = {
  title: "Overlays/Dialog",
  component: Dialog,
  args: {
    label: "Open dialog",
    title: "Leave a message",
  },
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Basic: Story = {
  render: (args) => (
    <Dialog {...args}>
      <form className="flex flex-col gap-3">
        <label className="text-sm">
          Your name
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="text-sm">
          Message
          <textarea rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
        </label>
        <button className="self-start rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white">Post</button>
      </form>
    </Dialog>
  ),
};

export const Wide: Story = {
  args: { wide: true, label: "Open wide dialog", title: "Add a clan" },
  render: (args) => (
    <Dialog {...args}>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Wide dialogs suit multi-column forms.
      </p>
    </Dialog>
  ),
};
