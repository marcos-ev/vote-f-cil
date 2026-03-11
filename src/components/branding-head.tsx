import { useEffect } from "react";
import { brandAssets } from "@/lib/branding";

export function BrandingHead() {
  useEffect(() => {
    document.title = "CD2 Poker Planning";

    let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.type = "image/png";
    favicon.href = brandAssets.iconLight;
  }, []);

  return null;
}
