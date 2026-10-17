import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { StatusDot } from "@/components/terminal";
import { ArrowRight, Loader2, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const trackSignin = useMutation(api.signupTracker.recordSignin);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      // Real verified sign-in — alert the site owner (fire-and-forget;
      // duplicate-page loads and guest sessions never reach this path).
      void trackSignin({}).catch((notificationError) =>
        // Clear diagnostics without blocking the sign-in flow: the alert is
        // auxiliary and will retry automatically on the athlete's next sign-in.
        console.error("Sign-in notification could not be sent:", notificationError),
      );
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to sign in as guest.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="border border-terminal-green/50 bg-[#eef3ea] px-1.5 py-0.5 text-[11px] font-bold tracking-[0.2em] text-status-ok">
              AFE
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.22em]">
              AI Fitness Engine
            </span>
          </Link>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <StatusDot tone="ok" /> SECURE TERMINAL
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="border border-border bg-card">
            {/* terminal title bar */}
            <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>AFE://AUTH</span>
              <span className="flex items-center gap-1.5">
                <StatusDot tone={isLoading ? "warn" : "ok"} pulse={isLoading} />
                {isLoading ? "PROCESSING" : "AWAITING INPUT"}
              </span>
            </div>

            {step === "signIn" ? (
              <form onSubmit={handleEmailSubmit} className="p-5">
                <h1 className="text-xl font-bold tracking-tight">
                  INITIALIZE SESSION
                </h1>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Enter your email to log in or sign up. New accounts are created
                  automatically — email verification happens via the code.
                </p>

                <label className="mt-6 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  EMAIL
                </label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    name="email"
                    placeholder="name@example.com"
                    type="email"
                    required
                    disabled={isLoading}
                    className="h-9 rounded-none text-sm"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isLoading}
                    className="h-9 w-9 shrink-0 rounded-none"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

                <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  OR
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-none text-[11px] uppercase tracking-[0.16em]"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  CONTINUE AS GUEST
                </Button>

                <p className="mt-5 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground">
                  Email OTP: 6-digit code, valid 15 minutes. Password reset and
                  Google sign-in can be enabled per deployment — the engine core
                  is provider-agnostic.
                </p>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="p-5">
                <h1 className="text-xl font-bold tracking-tight">CHECK YOUR INBOX</h1>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Verification code sent to <span className="text-foreground">{step.email}</span>
                </p>

                <input type="hidden" name="email" value={step.email} />
                <input type="hidden" name="code" value={otp} />

                <div className="mt-6 flex justify-center">
                  <InputOTP value={otp} onChange={setOtp} maxLength={6} disabled={isLoading}>
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <p className="mt-3 text-center text-xs text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  className="mt-6 w-full rounded-none text-[11px] uppercase tracking-[0.16em]"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      VERIFYING…
                    </>
                  ) : (
                    <>VERIFY CODE →</>
                  )}
                </Button>

                <div className="mt-3 flex justify-between text-[11px]">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto p-0 text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                  >
                    ← DIFFERENT EMAIL
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto p-0 text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                  >
                    RESEND
                  </Button>
                </div>
              </form>
            )}

            <div className="border-t border-border bg-secondary/50 px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Secured by{" "}
              <a
                href="https://freebuff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                freebuff.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
