import { describe, expect, it } from "vitest";

import { parseTestimonialFilters, testimonialsHref } from "./list";
import { reviewTestimonial, testimonialSchema } from "./schema";

const CONSENT = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const base = {
  quote: " [DEMO] El taller me cambió la vida. ",
  authorName: " María ",
  authorContext: "",
  consentId: CONSENT,
  owner: "",
};

describe("testimonialSchema", () => {
  it("turns the form into columns", () => {
    expect(testimonialSchema.parse(base)).toEqual({
      quote: "[DEMO] El taller me cambió la vida.",
      author_display_name: "María",
      author_context: null,
      consent_record_id: CONSENT,
      activity_id: null,
      project_id: null,
    });
  });

  it("requires the authorization, the words and a name", () => {
    expect(testimonialSchema.safeParse({ ...base, consentId: "" }).error?.issues[0]?.message).toBe(
      "Elige la autorización de la persona.",
    );
    expect(testimonialSchema.safeParse({ ...base, quote: " " }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, authorName: "" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, quote: "a".repeat(601) }).success).toBe(false);
  });
});

describe("reviewTestimonial", () => {
  it("blocks everyone without a usable authorization", () => {
    expect(reviewTestimonial({ consentUsable: false, coverIssues: null }, false).canSubmit).toBe(
      false,
    );
    expect(reviewTestimonial({ consentUsable: true, coverIssues: null }, true).canPublish).toBe(
      true,
    );
  });

  it("treats the photo like any cover", () => {
    const pending = { consentUsable: true, coverIssues: ["missing_consent"] };
    expect(reviewTestimonial(pending, false).canSubmit).toBe(true);
    expect(reviewTestimonial(pending, true).canPublish).toBe(false);
  });
});

describe("testimonial filters", () => {
  it("has a view for authorizations that were revoked or expired", () => {
    const filters = parseTestimonialFilters({ withdrawn: "1" });
    expect(filters.withdrawn).toBe(true);
    expect(testimonialsHref(filters)).toBe("/admin/contenido/testimonios?withdrawn=1");
  });
});
