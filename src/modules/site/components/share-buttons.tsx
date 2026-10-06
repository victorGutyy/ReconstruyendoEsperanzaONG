"use client";

import { Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { shareLinks } from "../share";

const button =
  "inline-flex min-h-11 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium text-green-900 outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Share a page (RF-A-13): plain links to each network, "Copiar enlace" and,
 * on phones that offer it, the native share sheet. No third-party scripts.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Only known after the page loads in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  return (
    <section aria-labelledby="share-title">
      <h2 id="share-title" className="text-sm font-semibold text-green-900">
        Compartir
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {canShare ? (
          <li>
            <button
              type="button"
              className={button}
              onClick={() => navigator.share({ title, url }).catch(() => undefined)}
            >
              <Share2 aria-hidden="true" className="size-4" />
              Compartir…
            </button>
          </li>
        ) : null}
        {shareLinks(url, title).map((link) => (
          <li key={link.network}>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className={button}>
              {link.label}
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={button}
            onClick={() =>
              navigator.clipboard
                .writeText(url)
                .then(() => setCopied(true))
                .catch(() => undefined)
            }
          >
            <Link2 aria-hidden="true" className="size-4" />
            Copiar enlace
          </button>
        </li>
      </ul>
      <p aria-live="polite" className="mt-2 text-sm text-green-700">
        {copied ? "Enlace copiado." : ""}
      </p>
    </section>
  );
}
