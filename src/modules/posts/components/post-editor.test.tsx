import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("../actions", () => ({ savePost: async () => ({ ok: true }) }));

const { PostEditor } = await import("./post-editor");

const empty = { title: "", excerpt: "", categoryId: "", byline: "", body: null };

describe("PostEditor without story categories (found testing on staging)", () => {
  it("tells an editor where to create them", () => {
    render(<PostEditor initial={empty} categories={[]} canManageTaxonomy />);
    expect(screen.getByLabelText("Categoría")).toHaveAccessibleDescription(
      "Todavía no hay categorías de historias. Créalos en Categorías y lugares",
    );
  });

  it("tells an author whom to ask", () => {
    render(<PostEditor initial={empty} categories={[]} canManageTaxonomy={false} />);
    expect(screen.queryByRole("link", { name: /Categorías y lugares/ })).toBeNull();
  });
});
