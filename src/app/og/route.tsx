import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// The default image when a page is shared and has no cover of its own
// (step 8.8): the logo on the paper colour, 1200×630 for WhatsApp and the
// networks. Built once at build time: it depends on no request data.
export const dynamic = "force-static";

const logo = await readFile(join(process.cwd(), "public", "brand", "logo-og.png"));
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f7f3ea",
        borderTop: "12px solid #245745",
        borderBottom: "12px solid #b79a4b",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logoSrc} width={760} height={342} />
      <div style={{ marginTop: 28, fontSize: 34, color: "#4f5a53", letterSpacing: 4 }}>
        CALARCÁ, QUINDÍO
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
