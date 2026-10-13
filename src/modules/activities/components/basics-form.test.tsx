import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("../actions", () => ({ saveActivityBasics: async () => ({ ok: true }) }));

const { BasicsForm } = await import("./basics-form");

const empty = {
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  placeId: "",
  categoryId: "",
  projectId: "",
  summary: "",
  body: null,
};

const renderForm = (options: { canManageTaxonomy: boolean; withLists?: boolean }) =>
  render(
    <BasicsForm
      initial={empty}
      places={options.withLists ? [{ id: "p1", name: "[DEMO] Vereda" }] : []}
      categories={options.withLists ? [{ id: "c1", name: "[DEMO] Salud" }] : []}
      projects={options.withLists ? [{ id: "r1", name: "[DEMO] Huertas" }] : []}
      canManageTaxonomy={options.canManageTaxonomy}
    />,
  );

describe("BasicsForm with empty lists (found testing on staging)", () => {
  it("tells an editor where to create places and categories", () => {
    renderForm({ canManageTaxonomy: true });
    const links = screen.getAllByRole("link", { name: "Créalos en Categorías y lugares" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/admin/categorias-y-lugares");
    expect(screen.getByLabelText("Lugar general")).toHaveAccessibleDescription(
      "Todavía no hay lugares. Créalos en Categorías y lugares",
    );
  });

  it("tells an author whom to ask, without a link they cannot use", () => {
    renderForm({ canManageTaxonomy: false });
    expect(screen.queryByRole("link", { name: /Categorías y lugares/ })).toBeNull();
    expect(screen.getByLabelText("Categoría")).toHaveAccessibleDescription(
      "Todavía no hay categorías de actividad. Pídele a un Editor o Administrador que los cree en Categorías y lugares.",
    );
  });

  it("points to where projects are created", () => {
    renderForm({ canManageTaxonomy: false });
    expect(screen.getByRole("link", { name: "créalo en Contenido → Proyectos" })).toHaveAttribute(
      "href",
      "/admin/contenido/proyectos/nuevo",
    );
  });

  it("says nothing when the lists have options", () => {
    renderForm({ canManageTaxonomy: true, withLists: true });
    expect(screen.queryByText(/Todavía no hay/)).toBeNull();
  });
});
