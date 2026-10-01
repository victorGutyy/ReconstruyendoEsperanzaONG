import { describe, expect, it } from "vitest";

import { parsePostFilters, postsHref } from "./list";
import { postSchema, reviewPost } from "./schema";

const CATEGORY = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Sembramos juntos." }] }],
};

describe("postSchema", () => {
  it("turns the form into columns, empty texts into null", () => {
    const parsed = postSchema.parse({
      title: "  [DEMO] La huerta ",
      excerpt: " ",
      categoryId: "",
      byline: "",
      body,
    });
    expect(parsed).toMatchObject({
      title: "[DEMO] La huerta",
      excerpt: null,
      category_id: null,
      byline: null,
      body_text: "Sembramos juntos.",
    });
  });

  it("requires a title and refuses HTML or unknown nodes in the story", () => {
    expect(
      postSchema.safeParse({ title: " ", excerpt: "", categoryId: "", byline: "" }).success,
    ).toBe(false);
    const script = { type: "doc", content: [{ type: "script", text: "x" }] };
    expect(
      postSchema.safeParse({ title: "Hola", excerpt: "", categoryId: "", byline: "", body: script })
        .success,
    ).toBe(false);
  });

  it("keeps the limits of the database", () => {
    const base = { title: "Hola", excerpt: "", categoryId: CATEGORY, byline: "", body: null };
    expect(postSchema.safeParse({ ...base, excerpt: "a".repeat(301) }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, byline: "a".repeat(121) }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, categoryId: "x" }).success).toBe(false);
  });
});

describe("reviewPost", () => {
  const ready = { excerpt: "Sembramos", categoryId: CATEGORY, coverIssues: [] };

  it("lets a complete story be published", () => {
    const review = reviewPost(ready, true);
    expect(review.canPublish).toBe(true);
    expect(review.items.every((item) => item.level === "ok")).toBe(true);
  });

  it("blocks everyone without excerpt or category", () => {
    const review = reviewPost({ ...ready, excerpt: " ", categoryId: null }, false);
    expect(review.canSubmit).toBe(false);
    expect(review.items.filter((item) => item.level === "error")).toHaveLength(2);
  });

  it("only warns without a cover", () => {
    const review = reviewPost({ ...ready, coverIssues: null }, true);
    expect(review.canPublish).toBe(true);
    expect(review.items.find((item) => item.key === "no-cover")?.level).toBe("warn");
  });

  it("lets an author send a cover that still needs an authorization, not an editor publish it", () => {
    const pending = { ...ready, coverIssues: ["missing_consent"] };
    expect(reviewPost(pending, false).canSubmit).toBe(true);
    const editor = reviewPost(pending, true);
    expect(editor.canPublish).toBe(false);
    expect(editor.items.find((item) => item.key === "cover")?.text).toContain("autorización");
  });
});

describe("story filters", () => {
  it("reads the URL and ignores invalid values", () => {
    expect(parsePostFilters({ status: "review", mine: "1", page: "2", category: "x" })).toEqual({
      status: "review",
      category: undefined,
      q: "",
      mine: true,
      page: 2,
    });
  });

  it("builds the URL of the list, back to page 1", () => {
    const filters = parsePostFilters({ status: "draft", page: "3" });
    expect(postsHref(filters, { mine: true })).toBe(
      "/admin/contenido/historias?status=draft&mine=1",
    );
    expect(postsHref(parsePostFilters({}))).toBe("/admin/contenido/historias");
  });
});
