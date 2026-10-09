// Contact messages in the panel (step 8.7b): states, tabs and labels. Pure,
// tested in schema.test.ts.

export const MESSAGES_PATH = "/admin/mensajes";
export const MESSAGES_PAGE_SIZE = 20;

export const MESSAGE_STATUSES = ["new", "read", "handled", "archived"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const STATUS_LABELS: Record<MessageStatus, string> = {
  new: "Nuevo",
  read: "Leído",
  handled: "Atendido",
  archived: "Archivado",
};

/** Tabs of the inbox: what still needs an answer comes first. */
export const MESSAGE_TABS = [
  { key: "pending", label: "Por atender", statuses: ["new", "read"] },
  { key: "handled", label: "Atendidos", statuses: ["handled"] },
  { key: "archived", label: "Archivados", statuses: ["archived"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly MessageStatus[] }[];

export type MessageTab = (typeof MESSAGE_TABS)[number]["key"];

/** Where a person can move a message (the database records who handled it). */
export const MESSAGE_ACTIONS: Record<MessageStatus, { to: MessageStatus; label: string }[]> = {
  new: [
    { to: "handled", label: "Marcar como atendido" },
    { to: "archived", label: "Archivar" },
  ],
  read: [
    { to: "handled", label: "Marcar como atendido" },
    { to: "new", label: "Marcar como no leído" },
    { to: "archived", label: "Archivar" },
  ],
  handled: [
    { to: "read", label: "Volver a por atender" },
    { to: "archived", label: "Archivar" },
  ],
  archived: [{ to: "read", label: "Sacar del archivo" }],
};

export function isMessageStatus(value: unknown): value is MessageStatus {
  return typeof value === "string" && (MESSAGE_STATUSES as readonly string[]).includes(value);
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseInboxFilters(params: Record<string, string | string[] | undefined>) {
  const tab = first(params.bandeja);
  const page = Number(first(params.pagina));
  return {
    tab: (MESSAGE_TABS.find((item) => item.key === tab)?.key ?? "pending") as MessageTab,
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

export function inboxHref(tab: MessageTab, page = 1): string {
  const params = new URLSearchParams();
  if (tab !== "pending") params.set("bandeja", tab);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `${MESSAGES_PATH}?${query}` : MESSAGES_PATH;
}

/** A WhatsApp chat with the person who wrote (+57… → wa.me/57…). */
export const replyWhatsappHref = (phone: string) => `https://wa.me/${phone.replace(/^\+/, "")}`;

/** An e-mail reply with a subject already written. */
export const replyMailHref = (email: string, organization: string) =>
  `mailto:${email}?subject=${encodeURIComponent(`Respuesta de ${organization}`)}`;
