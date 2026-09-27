import {
  actionLabel,
  actorLabel,
  type AuditEntry,
  type AuditLookups,
  describeChanges,
  recordLabel,
} from "../format";

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/** The audit log as a list, newest first (docs/07 §7 AuditTimeline). */
export function AuditTimeline({
  entries,
  lookups,
}: {
  entries: AuditEntry[];
  lookups: AuditLookups;
}) {
  return (
    <ol className="divide-y rounded-lg border bg-card">
      {entries.map((entry) => {
        const { changes, hidden } = describeChanges(entry, lookups);

        return (
          <li key={entry.id} className="grid gap-2 p-4">
            <p>
              <span className="font-semibold">{actionLabel(entry.action)}</span>
              <span className="text-ink-muted"> · </span>
              <span className="break-words">{recordLabel(entry)}</span>
            </p>
            <p className="text-sm text-ink-muted">
              Por <span className="font-medium text-ink">{actorLabel(entry.actorId, lookups)}</span>{" "}
              ·{" "}
              <time dateTime={entry.occurredAt}>
                {dateTimeFormat.format(new Date(entry.occurredAt))}
              </time>
            </p>

            {changes.length > 0 ? (
              <details className="text-sm">
                <summary className="inline-flex min-h-6 cursor-pointer items-center font-medium text-green-700">
                  Ver cambios ({changes.length})
                </summary>
                <dl className="mt-2 grid gap-2 rounded-md bg-paper-2 p-3">
                  {changes.map((change) => (
                    <div key={change.field}>
                      <dt className="font-semibold">{change.label}</dt>
                      <dd className="break-words">
                        {change.before}
                        <span aria-hidden="true"> → </span>
                        <span className="sr-only"> cambió a </span>
                        {change.after}
                      </dd>
                    </div>
                  ))}
                </dl>
                {hidden > 0 ? (
                  <p className="mt-2 text-ink-muted">
                    Además cambiaron {hidden} {hidden === 1 ? "dato técnico" : "datos técnicos"} que
                    no se muestran.
                  </p>
                ) : null}
              </details>
            ) : hidden > 0 ? (
              <p className="text-sm text-ink-muted">Solo cambiaron datos técnicos.</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
