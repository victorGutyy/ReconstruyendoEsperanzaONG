// Tiptap configuration matching the allow-list in schema.ts (decision 7.2-D1).
// Browser only: imported by the editor component.
import StarterKit from "@tiptap/starter-kit";

import { isAllowedHref } from "./schema";

export const richTextExtensions = [
  StarterKit.configure({
    // Out: confused with links, code, colours, strike (decision 7.2-D1)
    underline: false,
    code: false,
    codeBlock: false,
    strike: false,
    // The page title is the H1: the body has titles (H2) and subtitles (H3)
    heading: { levels: [2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto", "tel"],
      isAllowedUri: (url) => isAllowedHref(url),
      HTMLAttributes: { rel: "nofollow noopener noreferrer", target: null, class: null },
    },
  }),
];
