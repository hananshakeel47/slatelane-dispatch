import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SlateLane Dispatch",
    short_name: "SlateLane",
    description:
      "Professional truck dispatch services for owner operators and small fleets.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#0ea5e9",
    icons: [
      {
        src: "/favicon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}