import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RichTextDoc } from "@/lib/rich-text/schema";

import { RichText } from "./rich-text";
import { RichTextEditor } from "./rich-text-editor";

describe("RichText", () => {
  it("renders the allowed elements as their own tags", () => {
    const doc: RichTextDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Subtítulo" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "negrita", marks: [{ type: "bold" }] },
            { type: "hardBreak" },
            {
              type: "text",
              text: "sitio",
              marks: [{ type: "link", attrs: { href: "https://example.test" } }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "uno" }] }],
            },
          ],
        },
      ],
    };
    render(<RichText doc={doc} />);

    expect(screen.getByRole("heading", { level: 2, name: "Título" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Subtítulo" })).toBeInTheDocument();
    expect(screen.getByText("negrita").closest("strong")).not.toBeNull();
    expect(screen.getByRole("link", { name: "sitio" })).toHaveAttribute(
      "rel",
      "nofollow noopener noreferrer",
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("uno");
  });

  it("shows HTML typed as text as text, and drops links that are not allowed", () => {
    const { container } = render(
      <RichText
        doc={{
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "<script>alert(1)</script>" },
                {
                  type: "text",
                  text: "malo",
                  marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
                },
              ],
            },
            { type: "image", attrs: { src: "https://x.test/a.png" } },
          ],
        }}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing for an empty document", () => {
    const { container } = render(<RichText doc={{ type: "doc", content: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RichTextEditor", () => {
  it("offers a labelled toolbar and carries the value in a hidden field", () => {
    const { container } = render(
      <>
        <span id="body-label">Descripción</span>
        <RichTextEditor
          name="body"
          labelledBy="body-label"
          defaultValue={{
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }],
          }}
        />
      </>,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Formato del texto" });
    for (const name of [
      "Negrita",
      "Cursiva",
      "Título",
      "Subtítulo",
      "Lista",
      "Enlace",
      "Deshacer",
    ]) {
      expect(toolbar.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
    }
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="body"]');
    expect(JSON.parse(hidden!.value)).toMatchObject({ type: "doc" });
  });
});

describe("editor and server agree", () => {
  it("reduces pasted HTML to allowed JSON that the server accepts", async () => {
    const { Editor } = await import("@tiptap/core");
    const { richTextExtensions } = await import("@/lib/rich-text/extensions");
    const { validateRichText } = await import("@/lib/rich-text/schema");

    const editor = new Editor({
      extensions: richTextExtensions,
      content: `
        <h1>Título grande</h1>
        <p style="color:red">Hola <u>subrayado</u> <b>negrita</b> <code>x</code>
          <a href="javascript:alert(1)">malo</a> <a href="https://example.test">bueno</a></p>
        <script>alert(1)</script><img src="https://x.test/a.png">
        <ul><li>uno</li></ul><ol start="3"><li>tres</li></ol><blockquote>cita</blockquote><hr>
        <pre><code>codigo</code></pre>`,
    });

    const json = editor.getJSON();
    editor.destroy();

    const result = validateRichText(json);
    expect(result).toMatchObject({ ok: true });
    const text = JSON.stringify(json);
    expect(text).not.toContain("javascript:");
    expect(text).not.toContain("script");
    expect(text).not.toContain("image");
    expect(text).toContain("https://example.test");
  });
});
