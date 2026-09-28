"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { richTextExtensions } from "@/lib/rich-text/extensions";
import { isAllowedHref, type RichTextDoc } from "@/lib/rich-text/schema";
import { cn } from "@/lib/utils";

type Props = {
  /** Name of the hidden field that carries the JSON in the form. */
  name: string;
  /** id of the visible label of the field. */
  labelledBy: string;
  defaultValue?: RichTextDoc | null;
  describedBy?: string;
  onChange?: (doc: RichTextDoc) => void;
};

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={label}
      onClick={onClick}
      className={cn(active && "bg-green-50 text-green-900")}
    >
      {children}
    </Button>
  );
}

/**
 * Rich text for the panel (step 7.2): Tiptap with the allowed elements only.
 * The value travels as JSON in a hidden field; the server validates it again.
 */
export function RichTextEditor({ name, labelledBy, defaultValue, describedBy, onChange }: Props) {
  const linkInputId = useId();
  const [json, setJson] = useState(() =>
    JSON.stringify(defaultValue ?? { type: "doc", content: [] }),
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: richTextExtensions,
    content: defaultValue ?? undefined,
    // Rendered only in the browser: avoids hydration mismatches
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class:
          "min-h-40 rounded-b-md border-[1.5px] border-t-0 border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring [&_h2]:font-serif [&_h2]:text-2xl [&_h3]:font-serif [&_h3]:text-xl [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-gold-500 [&_blockquote]:pl-4 [&_a]:text-green-700 [&_a]:underline [&_p]:my-2",
      },
    },
    onUpdate: ({ editor: current }) => {
      const doc = current.getJSON() as RichTextDoc;
      setJson(JSON.stringify(doc));
      onChange?.(doc);
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            bullet: current.isActive("bulletList"),
            ordered: current.isActive("orderedList"),
            quote: current.isActive("blockquote"),
            link: current.isActive("link"),
          }
        : null,
  });

  const chain = () => editor?.chain().focus();

  const openLink = () => {
    setLinkValue((editor?.getAttributes("link").href as string | undefined) ?? "https://");
    setLinkError(null);
    setLinkOpen(true);
  };

  const applyLink = (event: React.FormEvent | React.MouseEvent) => {
    event.preventDefault();
    const href = linkValue.trim();
    if (href === "" || href === "https://") {
      chain()?.extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!isAllowedHref(href)) {
      setLinkError(
        "Escribe una dirección web (https://…), un correo (mailto:…) o un teléfono (tel:…).",
      );
      return;
    }
    chain()?.extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  };

  return (
    <div>
      <input type="hidden" name={name} value={json} />
      <div
        role="toolbar"
        aria-label="Formato del texto"
        className="flex flex-wrap gap-1 rounded-t-md border-[1.5px] border-input bg-paper-2 p-1"
      >
        <ToolButton
          label="Negrita"
          active={state?.bold}
          onClick={() => chain()?.toggleBold().run()}
        >
          <Bold aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Cursiva"
          active={state?.italic}
          onClick={() => chain()?.toggleItalic().run()}
        >
          <Italic aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Título"
          active={state?.h2}
          onClick={() => chain()?.toggleHeading({ level: 2 }).run()}
        >
          <Heading2 aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Subtítulo"
          active={state?.h3}
          onClick={() => chain()?.toggleHeading({ level: 3 }).run()}
        >
          <Heading3 aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Lista"
          active={state?.bullet}
          onClick={() => chain()?.toggleBulletList().run()}
        >
          <List aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Lista numerada"
          active={state?.ordered}
          onClick={() => chain()?.toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label="Cita"
          active={state?.quote}
          onClick={() => chain()?.toggleBlockquote().run()}
        >
          <Quote aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Enlace" active={state?.link} onClick={openLink}>
          <Link2 aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Línea separadora" onClick={() => chain()?.setHorizontalRule().run()}>
          <Minus aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Deshacer" onClick={() => chain()?.undo().run()}>
          <Undo2 aria-hidden="true" />
        </ToolButton>
        <ToolButton label="Rehacer" onClick={() => chain()?.redo().run()}>
          <Redo2 aria-hidden="true" />
        </ToolButton>
      </div>

      {linkOpen ? (
        <div className="grid gap-2 border-x-[1.5px] border-input bg-card p-3">
          <label htmlFor={linkInputId} className="text-sm font-medium">
            Dirección del enlace (déjala vacía para quitarlo)
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={linkInputId}
              value={linkValue}
              inputMode="url"
              autoComplete="off"
              onChange={(event) => setLinkValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyLink(event as unknown as React.FormEvent);
              }}
              className="min-w-0 flex-1"
            />
            <Button type="button" variant="outline" onClick={applyLink}>
              Aplicar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
          </div>
          {linkError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {linkError}
            </p>
          ) : null}
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}
