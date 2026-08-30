import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Family Compass",
    template: "%s · Family Compass",
  },
  description:
    "Build your family tree, invite relatives, and share a beautiful chart centered on any person.",
  ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
