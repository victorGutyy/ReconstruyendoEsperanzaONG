"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCategory, moveCategory, updateCategory } from "../actions";
import type { Category } from "../queries";
import type { ActionState, CategoryScope } from "../schema";
import { FormMessage } from "./form-message";
import { TrashButton } from "./trash-button";

const textareaClass =
  "min-h-20 w-full rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function CreateCategoryForm({ scope }: { scope: CategoryScope }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createCategory, {});
  const prefix = `category-${scope}`;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="scope" value={scope} />
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-name`}>Nombre de la categoría</Label>
        <Input id={`${prefix}-name`} name="name" autoComplete="off" required maxLength={80} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-description`}>Descripción (opcional)</Label>
        <textarea
          id={`${prefix}-description`}
          name="description"
          maxLength={300}
          className={textareaClass}
        />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          Agregar categoría
        </Button>
      </div>
      <FormMessage state={state} id={`${prefix}-create`} />
    </form>
  );
}

function MoveButton({
  id,
  name,
  direction,
}: {
  id: string;
  name: string;
  direction: "up" | "down";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(moveCategory, {});
  const Icon = direction === "up" ? ArrowUp : ArrowDown;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <Button type="submit" variant="ghost" size="icon" disabled={pending}>
        <Icon aria-hidden="true" />
        <span className="sr-only">
          {direction === "up" ? "Subir" : "Bajar"} {name}
        </span>
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function CategoryItem({
  category,
  isFirst,
  isLast,
}: {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateCategory, {});
  const prefix = `category-${category.id}`;

  return (
    <li className="grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-1">
          {/* Only the moves that are possible are shown (no disabled buttons) */}
          <div className="flex w-22 shrink-0">
            {isFirst ? <span className="size-11" /> : null}
            {isFirst ? null : <MoveButton id={category.id} name={category.name} direction="up" />}
            {isLast ? null : <MoveButton id={category.id} name={category.name} direction="down" />}
          </div>
          <p className="pt-2">
            <span className="font-semibold">{category.name}</span>
            {category.description ? (
              <span className="block text-sm text-ink-muted">{category.description}</span>
            ) : null}
          </p>
        </div>
        <TrashButton table="categories" id={category.id} name={category.name} />
      </div>

      <details>
        <summary className="inline-flex min-h-6 cursor-pointer items-center text-sm font-medium text-green-700">
          Editar<span className="sr-only"> {category.name}</span>
        </summary>
        <form action={formAction} className="mt-3 grid gap-4" noValidate>
          <input type="hidden" name="id" value={category.id} />
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-name`}>Nombre</Label>
            <Input
              id={`${prefix}-name`}
              name="name"
              defaultValue={category.name}
              autoComplete="off"
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-description`}>Descripción (opcional)</Label>
            <textarea
              id={`${prefix}-description`}
              name="description"
              defaultValue={category.description ?? ""}
              maxLength={300}
              className={textareaClass}
            />
          </div>
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              Guardar
            </Button>
          </div>
          <FormMessage state={state} />
        </form>
      </details>
    </li>
  );
}
