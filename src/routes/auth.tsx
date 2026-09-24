import { createFileRoute, Link, Outlet, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticatedDestination, getAuthenticatedSession, sendEmailCode, signIn, signUp } from "@/lib/supabase/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    intent: search.intent === "login" || search.intent === "onboarding" ? search.intent : "onboarding",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — SkillBridge AI" },
      {
        name: "description",
        content: "Sign in or create your SkillBridge AI account.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { intent } = useSearch({ from: "/auth" });

  const [method, setMethod] = useState<"email" | "password">("email");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAuthenticatedSession().then((user) => {
      if (user) navigate({ to: authenticatedDestination(intent) });
    }).catch(() => undefined);
  }, [intent, navigate]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const sendCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { error: sendError } = await sendEmailCode(trimmedEmail);
      if (sendError) throw sendError;
      navigate({ to: "/auth/verify", search: { email: trimmedEmail, intent } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't send the verification email.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      toast.error("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await signUp(email.trim(), password);

        if (signUpError) throw signUpError;
        if (!data.user) throw new Error("Account could not be created.");
        navigate({ to: "/onboarding" });
      } else {
        const { error: signInError } = await signIn(email.trim(), password);
        if (signInError) throw signInError;
        navigate({ to: authenticatedDestination(intent) });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (location.pathname === "/auth/verify") return <Outlet />;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2" aria-label="SkillBridgeAI home">
          <img
            src="/brand/skillbridgeai-horizontal.svg"
            alt="SkillBridgeAI logo"
            className="h-8 w-auto"
          />
        </Link>

        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </Link>
      </header>

      <main className="mx-auto max-w-md px-6 pb-16 pt-12">
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {method === "email" ? "Welcome to SkillBridge AI" : mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>

          <p className="mt-2 text-muted-foreground">
            {method === "email"
              ? "Enter your email and we’ll send you a secure verification code."
              : mode === "signup"
              ? "Your personalized career journey starts here."
              : "Continue your SkillBridge AI journey."}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (method === "email") void sendCode();
            else void handleSubmit(event);
          }}
          className="mt-8 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur sm:p-8"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>

              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {method === "password" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full rounded-full"
              disabled={loading}
            >
              {loading ? "Please wait..." : method === "email" ? "Send Code" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {method === "email" ? "Prefer a password?" : mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setError(null);
              if (method === "email") setMethod("password");
              else setMode((current) => current === "signup" ? "signin" : "signup");
            }}
          >
            {method === "email" ? "Use password sign in" : mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </div>

        {method === "password" && (
          <div className="mt-3 text-center text-sm">
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setMethod("email"); setError(null); }}>
              Use email verification instead
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
