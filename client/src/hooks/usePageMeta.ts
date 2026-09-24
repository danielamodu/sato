import { useEffect } from "react";

const DEFAULT_TITLE = "Sato — Send Bitcoin like a text.";
const DEFAULT_DESCRIPTION =
  "Sato is a Bitcoin payment app for real people. Send to anyone, earn on your balance, cash out whenever.";

/**
 * Sets the document title and meta description for a client-side route.
 * This is an SPA, so each page owns its own tab title + description; on
 * unmount we restore the site defaults (matching index.html) so a stale
 * subpage title never lingers after navigating back home.
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    const previousDescription = meta.getAttribute("content");
    if (description) meta.setAttribute("content", description);

    return () => {
      document.title = DEFAULT_TITLE;
      meta?.setAttribute("content", previousDescription ?? DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}
