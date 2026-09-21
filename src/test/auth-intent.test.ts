import { describe, expect, it } from "vitest";
import { authenticatedDestination } from "@/lib/supabase/auth";

describe("authentication intent routing", () => {
  it("sends onboarding intent to onboarding after authentication", () => {
    expect(authenticatedDestination("onboarding")).toBe("/onboarding");
  });

  it("sends login intent to the dashboard after authentication", () => {
    expect(authenticatedDestination("login")).toBe("/dashboard");
  });

  it("keeps OTP onboarding intent on the onboarding destination", () => {
    const verifySearch = { email: "qa@example.com", intent: "onboarding" as const };
    expect(authenticatedDestination(verifySearch.intent)).toBe("/onboarding");
  });
});
