import type { Metadata } from "next";
import "./globals.css";
import { ConsentBanner } from "@/components/ConsentBanner";

export const metadata: Metadata = {
  title: {
    default: "Family Compass",
    template: "%s · Family Compass",
  },
  description:
    "A community genealogy and family-history research project for Kenyan families, starting in Western Kenya.",
  ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
