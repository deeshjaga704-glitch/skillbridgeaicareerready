import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, TrendingUp, Send, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            SkillBridge <span className="text-primary">AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/dashboard">
            <Button variant="ghost" className="rounded-full">
              I already have an account
            </Button>
          </Link>
          <Link to="/onboarding">
            <Button className="rounded-full">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-8 sm:pt-14">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            Built for students, trusted by employers
          </div>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            The only readiness score{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-teal bg-clip-text text-transparent">
              employers can trust
            </span>
            , because it's earned, not claimed.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            SkillBridge AI follows you from day one of college to your first job — verifying every
            skill through real projects, not resume buzzwords.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/onboarding">
              <Button size="lg" className="h-12 rounded-full px-6 text-base">
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline" className="h-12 rounded-full px-6 text-base">
                See a sample dashboard
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free while in beta. No credit card. Your work stays yours.
          </p>
        </div>

        {/* Score preview card */}
        <div className="mx-auto mt-16 max-w-3xl">
          <div className="rounded-3xl border border-border/60 bg-card/80 p-2 shadow-xl shadow-primary/5 backdrop-blur">
            <div className="rounded-2xl bg-gradient-to-br from-primary-soft via-card to-teal-soft p-8 sm:p-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Readiness score
                </span>
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                  Verified
                </span>
              </div>
              <div className="mt-3 font-display text-6xl font-extrabold tracking-tight sm:text-7xl">
                68<span className="text-muted-foreground">–</span>79
                <span className="text-3xl text-muted-foreground">%</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Based on 4 verified projects · Range shown, not a single false-precision number.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { s: "Python", ok: true },
                  { s: "Docker", ok: true },
                  { s: "React", ok: false },
                ].map((x) => (
                  <div
                    key={x.s}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
                  >
                    <span
                      className={
                        x.ok
                          ? "grid h-5 w-5 place-items-center rounded-full bg-success/20 text-success"
                          : "h-5 w-5 rounded-full border border-dashed border-muted-foreground/50"
                      }
                    >
                      {x.ok && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </span>
                    <span className="font-medium">{x.s}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {x.ok ? "Verified" : "Claimed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 step */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">How it works</h2>
          <p className="mt-2 text-muted-foreground">Three steps from claim to career.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Verify",
              desc: "Every claimed skill is proven with a real project — we grade the code, not the resume.",
              tint: "primary",
            },
            {
              icon: TrendingUp,
              title: "Track",
              desc: "Watch your readiness score grow as gaps close. See exactly what to learn next.",
              tint: "teal",
            },
            {
              icon: Send,
              title: "Apply",
              desc: "Tailored applications drafted for you. Nothing is sent without your approval.",
              tint: "coral",
            },
          ].map((step, i) => (
            <div
              key={step.title}
              className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="absolute right-4 top-4 font-display text-6xl font-extrabold text-muted/60">
                0{i + 1}
              </div>
              <div
                className={
                  step.tint === "primary"
                    ? "grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary"
                    : step.tint === "teal"
                    ? "grid h-11 w-11 place-items-center rounded-2xl bg-teal-soft text-teal"
                    : "grid h-11 w-11 place-items-center rounded-2xl bg-coral-soft text-coral"
                }
              >
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-3xl border border-border/60 bg-gradient-to-br from-primary/95 to-primary p-10 text-center text-primary-foreground shadow-xl shadow-primary/20">
          <h3 className="font-display text-3xl font-bold">Ready to earn a score you can prove?</h3>
          <p className="mt-2 text-primary-foreground/80">
            Takes 60 seconds to set up. Your first verified project can happen this week.
          </p>
          <Link to="/onboarding">
            <Button
              size="lg"
              variant="secondary"
              className="mt-6 h-12 rounded-full bg-background px-6 text-base text-foreground hover:bg-background/90"
            >
              Get started <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SkillBridge AI · Verified, not claimed.
      </footer>
    </div>
  );
}
