import type { ReactNode } from "react";

import { isAllowedHref, type RichTextDoc, type RichTextNode } from "@/lib/rich-text/schema";
import { cn } from "@/lib/utils";

// Renders validated Tiptap JSON with our own components: a closed list of
// elements and never dangerouslySetInnerHTML (docs/05 §6). Text is always text.
// It does not load Tiptap, so the public site stays light.

function renderText(node: RichTextNode, key: number): ReactNode {
  let content: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") content = <strong>{content}</strong>;
    else if (mark.type === "italic") content = <em>{content}</em>;
    else if (mark.type === "link" && isAllowedHref(mark.attrs.href)) {
      content = (
        <a
          href={mark.attrs.href}
          rel="nofollow noopener noreferrer"
          className="font-medium text-green-700 underline underline-offset-2"
        >
          {content}
        </a>
      );
    }
  }
  return <span key={key}>{content}</span>;
}

function renderNodes(nodes: RichTextNode[] = []): ReactNode[] {
  return nodes.map((node, index) => {
    const children = renderNodes(node.content);
    switch (node.type) {
      case "text":
        return renderText(node, index);
      case "hardBreak":
        return <br key={index} />;
      case "paragraph":
        return <p key={index}>{children}</p>;
      case "heading":
        return node.attrs?.level === 3 ? (
          <h3 key={index} className="font-serif text-xl font-semibold text-green-900">
            {children}
          </h3>
        ) : (
          <h2 key={index} className="font-serif text-2xl font-semibold text-green-900">
            {children}
          </h2>
        );
      case "bulletList":
        return (
          <ul key={index} className="list-disc pl-6">
            {children}
          </ul>
        );
      case "orderedList":
        return (
          <ol
            key={index}
            className="list-decimal pl-6"
            start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined}
          >
            {children}
          </ol>
        );
      case "listItem":
        return <li key={index}>{children}</li>;
      case "blockquote":
        return (
          <blockquote key={index} className="border-l-4 border-gold-500 pl-4 italic">
            {children}
          </blockquote>
        );
      case "horizontalRule":
        return <hr key={index} className="border-rule" />;
      default:
        // Unknown elements are never rendered (the server rejects them anyway)
        return null;
    }
  });
}

export function RichText({ doc, className }: { doc: RichTextDoc | null; className?: string }) {
  if (!doc?.content?.length) return null;
  return (
    <div className={cn("grid gap-4 leading-relaxed", className)}>{renderNodes(doc.content)}</div>
  );
}
