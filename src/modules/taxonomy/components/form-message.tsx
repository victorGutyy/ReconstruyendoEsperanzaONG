import type { ActionState } from "../schema";

/** Result of a form action, announced to screen readers. */
export function FormMessage({ state, id }: { state: ActionState; id?: string }) {
  return (
    <div aria-live="polite">
      {state.error ? (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p
          id={id ? `${id}-notice` : undefined}
          role="status"
          className="text-sm font-medium text-green-700"
        >
          {state.notice}
        </p>
      ) : null}
    </div>
  );
}
