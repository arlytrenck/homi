import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homi", short_name: "Homi", description: "Self-hosted homelab dashboard",
    start_url: "/", display: "standalone", background_color: "#14161a", theme_color: "#14161a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }, { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
