// Video links → provider + id (step 7.6c, docs/05 §6). Pure: unit-tested in
// parse.test.ts. Only allow-listed hosts and paths are understood; nothing is
// fetched (short links that need a request to resolve are refused: no SSRF).

export const PROVIDERS = ["youtube", "vimeo", "facebook", "tiktok"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export type ParsedVideo =
  { ok: true; provider: Provider; id: string } | { ok: false; error: string };

const MAX_URL = 500;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const DIGITS = /^\d{1,25}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
]);
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);
const SHORT_HOSTS = new Set(["fb.watch", "vm.tiktok.com", "vt.tiktok.com"]);

const UNKNOWN = "Pega el enlace de un video de YouTube, Vimeo, Facebook o TikTok.";
const SHORT =
  "Ese es un enlace corto. Abre el video y copia el enlace completo desde el navegador.";
const NOT_A_VIDEO =
  "No encontramos el video en ese enlace. Copia el enlace del video, no de la página.";

const ok = (provider: Provider, id: string): ParsedVideo => ({ ok: true, provider, id });
const fail = (error: string): ParsedVideo => ({ ok: false, error });

function parseYouTube(url: URL, segments: string[]): ParsedVideo {
  let id: string | null | undefined;
  if (url.hostname === "youtu.be") id = segments[0];
  else if (segments[0] === "watch") id = url.searchParams.get("v");
  else if (["shorts", "live", "embed"].includes(segments[0] ?? "")) id = segments[1];
  return id && YOUTUBE_ID.test(id) ? ok("youtube", id) : fail(NOT_A_VIDEO);
}

function parseVimeo(url: URL, segments: string[]): ParsedVideo {
  // player.vimeo.com/video/123 · vimeo.com/123 · vimeo.com/channels/x/123
  const id =
    url.hostname === "player.vimeo.com"
      ? segments[0] === "video"
        ? segments[1]
        : undefined
      : segments[0] === "channels"
        ? segments[2]
        : segments[0];
  if (!id || !DIGITS.test(id)) return fail(NOT_A_VIDEO);
  // vimeo.com/123/abcdef: an unlisted video that needs its private hash
  const rest =
    url.hostname === "player.vimeo.com"
      ? segments.slice(2)
      : segments.slice(segments[0] === "channels" ? 3 : 1);
  if (rest.length > 0 || url.searchParams.has("h")) {
    return fail(
      "Los videos ocultos de Vimeo no se pueden agregar. Hazlo público o usa otro enlace.",
    );
  }
  return ok("vimeo", id);
}

function parseFacebook(url: URL, segments: string[]): ParsedVideo {
  let id: string | null | undefined;
  if (segments[0] === "watch") id = url.searchParams.get("v");
  else if (segments[0] === "reel") id = segments[1];
  else {
    const at = segments.indexOf("videos");
    if (at >= 0) id = segments[at + 1];
  }
  return id && DIGITS.test(id) ? ok("facebook", id) : fail(NOT_A_VIDEO);
}

function parseTikTok(segments: string[]): ParsedVideo {
  // tiktok.com/@cuenta/video/123 · tiktok.com/embed/v2/123 (what watchUrl gives back)
  const id =
    segments[0]?.startsWith("@") && segments[1] === "video"
      ? segments[2]
      : segments[0] === "embed" && segments[1] === "v2"
        ? segments[2]
        : undefined;
  return id && DIGITS.test(id) ? ok("tiktok", id) : fail(NOT_A_VIDEO);
}

/** Understands the usual video links of the four providers, nothing else. */
export function parseVideoUrl(input: string): ParsedVideo {
  const text = input.trim();
  if (text === "" || text.length > MAX_URL) return fail(UNKNOWN);

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return fail(UNKNOWN);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return fail(UNKNOWN);
  if (url.username || url.password || url.port) return fail(UNKNOWN);

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (SHORT_HOSTS.has(host)) return fail(SHORT);
  if (YOUTUBE_HOSTS.has(host)) return parseYouTube(url, segments);
  if (VIMEO_HOSTS.has(host)) return parseVimeo(url, segments);
  if (FACEBOOK_HOSTS.has(host)) return parseFacebook(url, segments);
  if (TIKTOK_HOSTS.has(host)) return parseTikTok(segments);
  return fail(UNKNOWN);
}

/** Where to watch it on the provider's site (opens in a new tab; no embed). */
export function watchUrl(provider: Provider, id: string): string {
  const safe = encodeURIComponent(id);
  switch (provider) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${safe}`;
    case "vimeo":
      return `https://vimeo.com/${safe}`;
    case "facebook":
      return `https://www.facebook.com/watch/?v=${safe}`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${safe}`;
  }
}
