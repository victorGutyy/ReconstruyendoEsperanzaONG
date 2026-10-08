import { describe, expect, it } from "vitest";

import { pickFeatured, without } from "./home";

const post = (id: string, cover: boolean) => ({ id, cover: cover ? {} : null });

describe("pickFeatured", () => {
  it("leads with the newest story that has a cover", () => {
    expect(pickFeatured([post("p1", false), post("p2", true)], [post("a1", true)])).toEqual({
      kind: "post",
      item: post("p2", true),
    });
  });

  it("falls back to the newest past activity, preferring one with a photo", () => {
    expect(pickFeatured([post("p1", false)], [post("a1", false), post("a2", true)])).toEqual({
      kind: "activity",
      item: post("a2", true),
    });
    expect(pickFeatured([], [post("a1", false)])).toEqual({
      kind: "activity",
      item: post("a1", false),
    });
  });

  it("has no lead when nothing is published", () => {
    expect(pickFeatured([], [])).toBeNull();
  });
});

describe("without", () => {
  it("leaves the featured item out and keeps the count", () => {
    const items = [post("a", true), post("b", true), post("c", true), post("d", true)];
    expect(without(items, "b", 2).map((item) => item.id)).toEqual(["a", "c"]);
    expect(without(items, null, 3).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
