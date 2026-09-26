import { describe, expect, it } from "vitest";

import { parseEnv, publicEnvSchema } from "./schema";

describe("parseEnv", () => {
  it("returns the values when all variables are valid", () => {
    const env = parseEnv(publicEnvSchema, {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("names the missing variables", () => {
    expect(() => parseEnv(publicEnvSchema, {})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("never includes the received values in the error", () => {
    const leakedValue = "http-not-a-url-do-not-leak";
    let message = "";
    try {
      parseEnv(publicEnvSchema, {
        NEXT_PUBLIC_SUPABASE_URL: leakedValue,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).not.toContain(leakedValue);
  });
});
