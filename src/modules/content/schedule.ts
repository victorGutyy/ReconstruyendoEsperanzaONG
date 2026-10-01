// Scheduled publication (steps 7.3b and 7.6). Pure: unit-tested in schedule.test.ts.

/** At least this far in the future, so the click and the date do not cross. */
const MIN_AHEAD_MS = 60_000;

/**
 * Colombian date and time → instant. Colombia has no daylight saving time:
 * always UTC-5.
 */
export function parseSchedule(
  schedule: { date: string; time: string },
  now = Date.now(),
): { ok: true; publishedAt: string } | { ok: false; error: string } {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(schedule.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)
  ) {
    return { ok: false, error: "Escribe la fecha y la hora de publicación." };
  }
  const instant = new Date(`${schedule.date}T${schedule.time}:00-05:00`);
  if (Number.isNaN(instant.getTime())) {
    return { ok: false, error: "Escribe la fecha y la hora de publicación." };
  }
  if (instant.getTime() <= now + MIN_AHEAD_MS) {
    return { ok: false, error: "La fecha de publicación programada debe ser futura." };
  }
  return { ok: true, publishedAt: instant.toISOString() };
}
