import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CopyButton } from "./CopyButton";

const meta: Meta<typeof CopyButton> = {
  title: "Actions/CopyButton",
  component: CopyButton,
  args: { value: "https://example.com/m/asha-omondi", label: "Copy link" },
};
export default meta;

export const Default: StoryObj<typeof CopyButton> = {};
