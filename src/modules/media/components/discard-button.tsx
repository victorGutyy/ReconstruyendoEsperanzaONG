"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { discardUpload } from "../actions";

/** "Quitar" for an upload that failed or never finished. */
export function DiscardButton({ mediaId }: { mediaId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => void discardUpload(mediaId))}
    >
      Quitar
    </Button>
  );
}
