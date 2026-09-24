import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authenticatedDestination,
  getAuthenticatedSession,
  sendEmailCode,
  verifyEmailCode,
} from "@/lib/supabase/auth";

export const Route = createFileRoute("/auth/verify")({
  head: () => ({
    meta: [
      { title: "Verify your email — SkillBridge AI" },
      { name: "description", content: "Verify your SkillBridge AI email address." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
    intent: search.intent === "login" || search.intent === "onboarding" ? search.intent : "onboarding",
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { email, intent } = useSearch({ from: "/auth/verify" });
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAuthenticatedSession().then((user) => {
      if (user) navigate({ to: authenticatedDestination(intent) });
    }).catch(() => undefined);
  }, [intent, navigate]);

  const verify = async () => {
    if (!email) {
      setError("Your verification email is missing. Please enter your email again.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit verification code from your email.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { error: verifyError } = await verifyEmailCode(email, code);
      if (verifyError) throw verifyError;
      const user = await getAuthenticatedSession();
      if (!user) throw new Error("Verification succeeded, but no authenticated session is available.");
      navigate({ to: authenticatedDestination(intent) });
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "That code is invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) {
      setError("Your verification email is missing. Please enter your email again.");
      return;
    }

    setError(null);
    setMessage(null);
    setResending(true);
    try {
      const { error: resendError } = await sendEmailCode(email);
      if (resendError) throw resendError;
      setMessage("A new verification code was sent.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "We couldn't resend the verification email.");
    } finally {
      setResending(false);
    }
  };

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
        <Link to="/auth" search={{ intent: "onboarding" }} className="text-sm text-muted-foreground hover:text-foreground">
          Change email
        </Link>
      </header>

      <main className="mx-auto max-w-md px-6 pb-16 pt-12">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight">Verify your email</h1>
          <p className="mt-2 text-muted-foreground">
            We sent a 6-digit verification code to <strong className="text-foreground">{email || "your email"}</strong>.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur sm:p-8">
          {!email && (
            <p className="mb-5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              Enter your email on the previous page to start verification.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification code</Label>
            <Input
              id="verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={!email || loading}
            />
          </div>
          {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
          {message && <p className="mt-4 text-sm text-success" role="status">{message}</p>}
          <Button className="mt-6 h-11 w-full rounded-full" onClick={() => void verify()} disabled={!email || loading || resending}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <Button variant="ghost" className="mt-2 w-full rounded-full" onClick={() => void resend()} disabled={!email || loading || resending}>
            {resending ? "Sending..." : "Resend code"}
          </Button>
        </div>

        <Link to="/auth" search={{ intent: "onboarding" }} className="mt-6 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Change email
        </Link>
      </main>
    </div>
  );
}
