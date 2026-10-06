import { MessageCircle } from "lucide-react";

import { whatsappHref } from "../navigation";

/**
 * Floating WhatsApp button (docs/07 §5): only with a configured number. It
 * stays above the phone's bottom edge; the footer leaves room for it.
 */
export function WhatsAppButton({
  number,
  organizationName,
}: {
  number: string | null;
  organizationName: string;
}) {
  if (!number) return null;
  return (
    <a
      href={whatsappHref(number, organizationName)}
      rel="noopener noreferrer"
      target="_blank"
      aria-label="Escríbenos por WhatsApp (se abre WhatsApp)"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-green-700 px-4 font-semibold text-paper shadow-lg outline-none hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <MessageCircle aria-hidden="true" className="size-6" />
      <span aria-hidden="true" className="hidden md:inline">
        Escríbenos
      </span>
    </a>
  );
}
