import { describe, expect, it } from "vitest";

import {
  inboxHref,
  isMessageStatus,
  MESSAGE_ACTIONS,
  parseInboxFilters,
  replyMailHref,
  replyWhatsappHref,
} from "./schema";

describe("inbox", () => {
  it("opens on what still needs an answer and ignores odd tabs", () => {
    expect(parseInboxFilters({})).toEqual({ tab: "pending", page: 1 });
    expect(parseInboxFilters({ bandeja: "archived", pagina: "2" })).toEqual({
      tab: "archived",
      page: 2,
    });
    expect(parseInboxFilters({ bandeja: "todo", pagina: "-1" })).toEqual({
      tab: "pending",
      page: 1,
    });
    expect(inboxHref("pending")).toBe("/admin/mensajes");
    expect(inboxHref("handled", 3)).toBe("/admin/mensajes?bandeja=handled&pagina=3");
  });

  it("offers only moves between the four states", () => {
    for (const actions of Object.values(MESSAGE_ACTIONS)) {
      for (const action of actions) expect(isMessageStatus(action.to)).toBe(true);
    }
    expect(isMessageStatus("deleted")).toBe(false);
  });

  it("builds the reply links", () => {
    expect(replyWhatsappHref("+573001112233")).toBe("https://wa.me/573001112233");
    expect(replyMailHref("a@example.test", "Reconstruyendo Esperanza")).toBe(
      "mailto:a@example.test?subject=Respuesta%20de%20Reconstruyendo%20Esperanza",
    );
  });
});
