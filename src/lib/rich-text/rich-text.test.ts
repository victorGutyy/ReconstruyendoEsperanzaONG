import { describe, expect, it } from "vitest";

import { isAllowedHref, RICH_TEXT_LIMITS, toPlainText, validateRichText } from "./schema";

const paragraph = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});

const doc = (...content: unknown[]) => ({ type: "doc", content });

const validDoc = doc(
  { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "La jornada" }] },
  paragraph("Sembramos ", [{ type: "bold" }]),
  {
    type: "bulletList",
    content: [{ type: "listItem", content: [paragraph("Árboles nativos")] }],
  },
  {
    type: "orderedList",
    attrs: { start: 1, type: null },
    content: [{ type: "listItem", content: [paragraph("Primero")] }],
  },
  { type: "blockquote", content: [paragraph("Una frase")] },
  { type: "horizontalRule" },
  {
    type: "paragraph",
    content: [
      {
        type: "text",
        text: "escríbenos",
        marks: [
          {
            type: "link",
            attrs: { href: "mailto:hola@example.test", target: null, rel: "nofollow", class: null },
          },
        ],
      },
      { type: "hardBreak" },
      { type: "text", text: "gracias", marks: [{ type: "italic" }] },
    ],
  },
);

describe("validateRichText", () => {
  it("accepts every allowed element, as an object or as JSON", () => {
    expect(validateRichText(validDoc)).toMatchObject({ ok: true, isEmpty: false });
    expect(validateRichText(JSON.stringify(validDoc))).toMatchObject({ ok: true });
  });

  it("treats a document without text as empty", () => {
    expect(validateRichText(doc({ type: "paragraph" }))).toMatchObject({
      ok: true,
      isEmpty: true,
      text: "",
    });
  });

  it.each([
    ["an unknown node", doc({ type: "script", content: [] })],
    ["an image", doc({ type: "image", attrs: { src: "https://x.test/a.png" } })],
    ["a level 1 title", doc({ type: "heading", attrs: { level: 1 } })],
    ["a mark that is not allowed", doc(paragraph("x", [{ type: "underline" }]))],
    ["an attribute that is not allowed", doc({ type: "paragraph", attrs: { style: "color:red" } })],
    ["raw HTML as a property", doc({ type: "paragraph", html: "<b>x</b>" })],
    ["text directly in the document", doc({ type: "text", text: "suelto" })],
    ["a paragraph inside a paragraph", doc({ type: "paragraph", content: [paragraph("x")] })],
    [
      "a javascript: link",
      doc(paragraph("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
    ],
    [
      "a data: link",
      doc(paragraph("x", [{ type: "link", attrs: { href: "data:text/html,<script>" } }])),
    ],
    ["something that is not a document", { type: "paragraph" }],
  ])("rejects %s", (_name, value) => {
    const result = validateRichText(value);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/formato no permitido/);
  });

  it("rejects documents that are too deep, too long or not JSON", () => {
    let deep: unknown = paragraph("x");
    for (let level = 0; level < RICH_TEXT_LIMITS.maxDepth + 2; level += 1) {
      deep = { type: "blockquote", content: [deep] };
    }
    expect(validateRichText(doc(deep)).ok).toBe(false);
    expect(
      validateRichText(doc(paragraph("a".repeat(RICH_TEXT_LIMITS.maxTextLength + 1)))).ok,
    ).toBe(false);
    expect(validateRichText("{not json").ok).toBe(false);
  });
});

describe("isAllowedHref", () => {
  it("allows web, e-mail and phone links only", () => {
    expect(isAllowedHref("https://example.test/a?b=1")).toBe(true);
    expect(isAllowedHref("http://example.test")).toBe(true);
    expect(isAllowedHref("mailto:hola@example.test")).toBe(true);
    expect(isAllowedHref("tel:+576000000")).toBe(true);
    expect(isAllowedHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedHref("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isAllowedHref("data:text/html,x")).toBe(false);
    expect(isAllowedHref("/admin")).toBe(false);
    expect(isAllowedHref("")).toBe(false);
  });
});

describe("toPlainText", () => {
  it("keeps paragraphs, lists and line breaks readable", () => {
    expect(toPlainText(validDoc as never)).toBe(
      "La jornada\n\nSembramos\n\nÁrboles nativos\n\nPrimero\n\nUna frase\n\nescríbenos\ngracias",
    );
  });
});
