import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Compass",
    short_name: "Compass",
    description:
      "Kenyan family history, recorded by the families themselves — trees, clans, memorials and research.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f6ecdd",
    theme_color: "#a9773f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
