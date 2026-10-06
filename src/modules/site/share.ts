// Share links (step 8.2, RF-A-13): plain addresses, no third-party scripts,
// so nobody is tracked for reading a page. Pure, tested in share.test.ts.

export type ShareTarget = { network: "whatsapp" | "facebook" | "x"; label: string; href: string };

export function shareLinks(url: string, title: string): ShareTarget[] {
  const encodedUrl = encodeURIComponent(url);
  return [
    {
      network: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    },
    {
      network: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      network: "x",
      label: "X",
      href: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodedUrl}`,
    },
  ];
}
