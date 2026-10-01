/** For ilike: % and _ typed by the person are searched literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
