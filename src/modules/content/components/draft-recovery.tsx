"use client";

import { Button } from "@/components/ui/button";

/** Offers back what was written without signal (see useDraftAutosave). */
export function DraftRecovery({ onUse, onDiscard }: { onUse: () => void; onDiscard: () => void }) {
  return (
    <div role="alert" className="grid gap-3 rounded-lg border border-gold-500 bg-card p-4">
      <p className="text-sm">
        Recuperamos lo que escribiste sin conexión. ¿Quieres usar esa versión?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onUse}>
          Usar esta versión
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
          Descartar
        </Button>
      </div>
    </div>
  );
}
