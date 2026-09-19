import { beforeEach, describe, expect, it, vi } from "vitest";

const getCookies = vi.fn(() => ({ "sb-access-token": "cookie-value" }));
const setCookie = vi.fn();
const setResponseHeader = vi.fn();
const getUser = vi.fn();
const createServerClient = vi.fn(
  (..._args: Parameters<typeof import("@supabase/ssr").createServerClient>) =>
    ({ auth: { getUser } }) as ReturnType<typeof import("@supabase/ssr").createServerClient>,
);

vi.mock("@tanstack/react-start/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start/server")>();
  return {
    ...actual,
    getCookies,
    setCookie,
    setResponseHeader,
  };
});

vi.mock("@supabase/ssr", () => ({ createServerClient }));

describe("server Supabase authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
  });

  it("creates a request-scoped client from incoming cookies", async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");

    createServerSupabaseClient();

    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({ cookies: expect.any(Object) }),
    );

    const options = createServerClient.mock.calls[0]?.[2];
    expect(options?.cookies.getAll()).toEqual([
      { name: "sb-access-token", value: "cookie-value" },
    ]);
  });

  it("returns the verified user from Supabase or null without a session", async () => {
    const { getServerAuthenticatedUser } = await import("@/lib/supabase/server");
    const user = { id: "user-1" };

    getUser.mockResolvedValueOnce({ data: { user }, error: null });
    await expect(getServerAuthenticatedUser()).resolves.toEqual(user);

    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("Auth session missing!"),
    });
    await expect(getServerAuthenticatedUser()).resolves.toBeNull();
  });
});
