const noteDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/** What an Editor asked to fix, shown above the editor while it is a draft. */
export function ReviewNote({ note }: { note: { text: string; at: string | null } }) {
  return (
    <section
      aria-labelledby="review-note-title"
      className="mt-6 rounded-lg border-2 border-gold-500 bg-card p-4"
    >
      <h2 id="review-note-title" className="font-semibold text-green-900">
        Nota de revisión
        {note.at ? ` · ${noteDate.format(new Date(note.at))}` : ""}
      </h2>
      <p className="mt-1 whitespace-pre-line">{note.text}</p>
    </section>
  );
}
