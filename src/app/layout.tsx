import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font: visitors' browsers never call Google (docs/07 §3.3)
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Reconstruyendo Esperanza · Calarcá",
    template: "%s · Reconstruyendo Esperanza",
  },
  description: "[PENDIENTE: descripción institucional aprobada por la organización]",
  // The leaves of the logo (scripts/prepare-logo.mjs)
  icons: {
    icon: [{ url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/brand/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${fraunces.variable} ${inter.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
