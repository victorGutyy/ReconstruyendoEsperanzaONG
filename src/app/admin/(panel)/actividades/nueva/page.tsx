import type { Metadata } from "next";

import { authorizePage } from "@/lib/auth/guard";
import { BasicsForm } from "@/modules/activities/components/basics-form";
import { WizardSteps } from "@/modules/activities/components/wizard-steps";
import { listBasicsOptions } from "@/modules/activities/queries";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Nueva actividad" };

export default async function NewActivityPage() {
  const authorized = await authorizePage("content.create");
  if (!authorized) return <NoPermission reason="Tu rol no permite crear actividades." />;

  const { places, categories } = await listBasicsOptions();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Actividades</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Nueva actividad</h1>
      <WizardSteps current={1} />
      <div className="mt-6 rounded-lg border bg-card p-5">
        <BasicsForm
          initial={{
            title: "",
            date: "",
            startTime: "",
            endTime: "",
            placeId: "",
            categoryId: "",
            summary: "",
            body: null,
          }}
          places={places}
          categories={categories}
        />
      </div>
    </div>
  );
}
