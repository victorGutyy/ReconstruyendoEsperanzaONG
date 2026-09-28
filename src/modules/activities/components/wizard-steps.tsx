import Link from "next/link";

import { cn } from "@/lib/utils";

import { WIZARD_STEPS, type WizardStep } from "../schema";

/** Step bar of the wizard (docs/07 §6.5). Before the draft exists only step 1 is a link. */
export function WizardSteps({ current, activityId }: { current: WizardStep; activityId?: string }) {
  return (
    <nav aria-label="Pasos para publicar la actividad" className="mt-6">
      <ol className="grid grid-cols-4 gap-1 text-center text-xs sm:text-sm">
        {WIZARD_STEPS.map(({ step, label }) => {
          const active = step === current;
          const content = (
            <>
              <span
                className={cn(
                  "mx-auto mb-1 flex size-8 items-center justify-center rounded-full border-2 font-semibold",
                  active ? "border-green-700 bg-green-700 text-paper" : "border-rule bg-card",
                )}
                aria-hidden="true"
              >
                {step}
              </span>
              <span className={cn(active && "font-semibold text-green-900")}>{label}</span>
            </>
          );
          return (
            <li key={step}>
              {activityId && !active ? (
                <Link
                  href={`/admin/actividades/${activityId}/editar?paso=${step}`}
                  className="block min-h-11 rounded-md p-1 outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="sr-only">Paso {step}: </span>
                  {content}
                </Link>
              ) : (
                <span className="block p-1" aria-current={active ? "step" : undefined}>
                  <span className="sr-only">Paso {step}: </span>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
