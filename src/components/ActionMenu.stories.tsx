import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ActionMenu, actionItemClass } from "./ActionMenu";

const meta: Meta<typeof ActionMenu> = {
  title: "Overlays/ActionMenu",
  component: ActionMenu,
};
export default meta;

type Story = StoryObj<typeof ActionMenu>;

export const Basic: Story = {
  render: (args) => (
    <ActionMenu {...args}>
      <a href="#" className={actionItemClass}>Edit details</a>
      <button className={actionItemClass}>✝ Record death</button>
      <button className={actionItemClass}>＋ Add event</button>
      <button className={`${actionItemClass} text-red-600`}>Delete person</button>
    </ActionMenu>
  ),
};
