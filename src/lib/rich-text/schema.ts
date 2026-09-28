// Rich text stored as Tiptap JSON, never HTML (ADR-04, docs/05 §6).
// A closed list of nodes, marks and attributes: anything else is rejected,
// never silently cleaned, so what is stored is exactly what the person saw.
// Pure: unit-tested in rich-text.test.ts; used by the server and the browser.

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } & Record<string, unknown> };

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  text?: string;
  marks?: RichTextMark[];
};

export type RichTextDoc = { type: "doc"; content?: RichTextNode[] };

export const RICH_TEXT_LIMITS = {
  /** Characters of text (what a person reads). */
  maxTextLength: 50_000,
  /** Serialized JSON, in bytes. */
  maxJsonBytes: 200_000,
  maxDepth: 20,
} as const;

const BLOCKS = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "horizontalRule",
]);
const INLINE = new Set(["text", "hardBreak"]);

/** Only web, e-mail and phone links: never javascript:, data:, file:… */
export function isAllowedHref(href: unknown): href is string {
  if (typeof href !== "string" || href.length === 0 || href.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol === "https:" || url.protocol === "http:") return url.hostname.length > 0;
  return url.protocol === "mailto:" || url.protocol === "tel:";
}

// Attributes Tiptap may write for each node; values are checked where they matter
const NODE_ATTRS: Record<string, readonly string[]> = {
  heading: ["level"],
  orderedList: ["start", "type"],
};
const LINK_ATTRS = new Set(["href", "target", "rel", "class", "title"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type RichTextValidation =
  { ok: true; doc: RichTextDoc; text: string; isEmpty: boolean } | { ok: false; error: string };

class Invalid extends Error {}

function fail(reason: string): never {
  throw new Invalid(`El texto tiene un formato no permitido: ${reason}.`);
}

function checkAttrs(node: Record<string, unknown>, type: string) {
  if (node.attrs === undefined || node.attrs === null) return;
  if (!isPlainObject(node.attrs)) fail(`atributos de ${type}`);
  const allowed = NODE_ATTRS[type] ?? [];
  for (const key of Object.keys(node.attrs)) {
    if (!allowed.includes(key)) fail(`atributo «${key}» en ${type}`);
  }
  if (type === "heading" && ![2, 3].includes(node.attrs.level as number)) {
    fail("solo se permiten títulos y subtítulos");
  }
  if (type === "orderedList") {
    const { start, type: listType } = node.attrs;
    if (start !== undefined && (!Number.isInteger(start) || (start as number) < 1)) {
      fail("inicio de lista");
    }
    if (listType !== undefined && listType !== null) fail("tipo de lista");
  }
}

function checkMarks(marks: unknown) {
  if (marks === undefined) return;
  if (!Array.isArray(marks)) fail("formato del texto");
  for (const mark of marks) {
    if (!isPlainObject(mark)) fail("formato del texto");
    if (mark.type === "bold" || mark.type === "italic") {
      if (
        mark.attrs !== undefined &&
        !(isPlainObject(mark.attrs) && Object.keys(mark.attrs).length === 0)
      ) {
        fail(`atributos de ${mark.type}`);
      }
      continue;
    }
    if (mark.type === "link") {
      if (!isPlainObject(mark.attrs)) fail("enlace sin dirección");
      for (const [key, value] of Object.entries(mark.attrs)) {
        if (!LINK_ATTRS.has(key)) fail(`atributo «${key}» en un enlace`);
        if (key !== "href" && value !== null && (typeof value !== "string" || value.length > 100)) {
          fail(`atributo «${key}» en un enlace`);
        }
      }
      if (!isAllowedHref(mark.attrs.href))
        fail("solo se permiten enlaces web, de correo o de teléfono");
      continue;
    }
    fail(`formato «${String(mark.type)}»`);
  }
}

type Walk = { textLength: number };

function checkNode(node: unknown, parent: string, depth: number, walk: Walk): void {
  if (depth > RICH_TEXT_LIMITS.maxDepth) fail("demasiados niveles anidados");
  if (!isPlainObject(node) || typeof node.type !== "string") fail("elemento desconocido");
  const type = node.type;

  const allowedHere =
    parent === "doc" || parent === "blockquote" || parent === "listItem"
      ? BLOCKS
      : parent === "bulletList" || parent === "orderedList"
        ? new Set(["listItem"])
        : INLINE; // paragraph, heading
  if (!allowedHere.has(type)) fail(`«${type}»`);

  for (const key of Object.keys(node)) {
    if (!["type", "attrs", "content", "text", "marks"].includes(key)) fail(`propiedad «${key}»`);
  }
  checkAttrs(node, type);

  if (type === "text") {
    if (typeof node.text !== "string" || node.text.length === 0) fail("texto vacío");
    walk.textLength += node.text.length;
    checkMarks(node.marks);
    return;
  }
  if (node.marks !== undefined || node.text !== undefined) fail(`formato en ${type}`);

  if (type === "hardBreak" || type === "horizontalRule") {
    if (node.content !== undefined) fail(`contenido dentro de ${type}`);
    return;
  }
  if (node.content === undefined) return;
  if (!Array.isArray(node.content)) fail(`contenido de ${type}`);
  for (const child of node.content) checkNode(child, type, depth + 1, walk);
}

/** Readable plain text for search (body_text) and previews. */
export function toPlainText(doc: RichTextDoc): string {
  const blocks: string[] = [];
  const inline = (nodes: RichTextNode[] = []) =>
    nodes.map((node) => (node.type === "hardBreak" ? "\n" : (node.text ?? ""))).join("");
  const walk = (nodes: RichTextNode[] = []) => {
    for (const node of nodes) {
      if (node.type === "paragraph" || node.type === "heading") blocks.push(inline(node.content));
      else if (node.type !== "horizontalRule") walk(node.content);
    }
  };
  walk(doc.content);
  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join("\n\n");
}

/**
 * Checks a value that should be a Tiptap document (object or JSON string).
 * Returns the document, its plain text and whether it has no text at all.
 */
export function validateRichText(value: unknown): RichTextValidation {
  let parsed: unknown = value;
  if (typeof value === "string") {
    if (new TextEncoder().encode(value).length > RICH_TEXT_LIMITS.maxJsonBytes) {
      return { ok: false, error: "El texto es demasiado largo." };
    }
    try {
      parsed = JSON.parse(value);
    } catch {
      return { ok: false, error: "No se pudo leer el texto. Vuelve a intentarlo." };
    }
  } else if (
    new TextEncoder().encode(JSON.stringify(value) ?? "").length > RICH_TEXT_LIMITS.maxJsonBytes
  ) {
    return { ok: false, error: "El texto es demasiado largo." };
  }

  try {
    if (!isPlainObject(parsed) || parsed.type !== "doc") fail("documento");
    for (const key of Object.keys(parsed)) {
      if (key !== "type" && key !== "content") fail(`propiedad «${key}»`);
    }
    const walk: Walk = { textLength: 0 };
    if (parsed.content !== undefined) {
      if (!Array.isArray(parsed.content)) fail("contenido del documento");
      for (const node of parsed.content) checkNode(node, "doc", 1, walk);
    }
    if (walk.textLength > RICH_TEXT_LIMITS.maxTextLength) {
      return {
        ok: false,
        error: `El texto es demasiado largo (máximo ${RICH_TEXT_LIMITS.maxTextLength.toLocaleString("es-CO")} caracteres).`,
      };
    }
    const doc = parsed as RichTextDoc;
    const text = toPlainText(doc);
    return { ok: true, doc, text, isEmpty: text.length === 0 };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}
