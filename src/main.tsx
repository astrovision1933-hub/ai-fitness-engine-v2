import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { LanguageProvider } from "@/lib/i18n";
import "./index.css";

// Lazy load route components for better code splitting.
// lazyPage adds one automatic retry: on a flaky mobile connection, or right
// after a dev-server rebuild, the first fetch of a route chunk can reject with
// "Failed to fetch dynamically imported module". A short retry recovers it
// instead of dropping the user on the runtime-error screen.
function lazyPage<P extends object>(loader: () => Promise<{ default: React.ComponentType<P> }>) {
  return lazy(() =>
    loader().catch(
      () =>
        new Promise<{ default: React.ComponentType<P> }>((resolve, reject) => {
          setTimeout(() => loader().then(resolve, reject), 600);
        }),
    ),
  );
}
const Landing = lazyPage(() => import("./pages/Landing.tsx"));
const AuthPage = lazyPage(() => import("./pages/Auth.tsx"));
const Dashboard = lazyPage(() => import("./pages/Dashboard.tsx"));
const Onboarding = lazyPage(() => import("./pages/Onboarding.tsx"));
const Coach = lazyPage(() => import("./pages/Coach.tsx"));
const Journey = lazyPage(() => import("./pages/Journey.tsx"));
const Physique = lazyPage(() => import("./pages/Physique.tsx"));
const Workout = lazyPage(() => import("./pages/Workout.tsx"));
const Nutrition = lazyPage(() => import("./pages/Nutrition.tsx"));
const Progress = lazyPage(() => import("./pages/Progress.tsx"));
const CheckIn = lazyPage(() => import("./pages/CheckIn.tsx"));
const Goals = lazyPage(() => import("./pages/Goals.tsx"));
const Bodybuilding = lazyPage(() => import("./pages/Bodybuilding.tsx"));
const Profile = lazyPage(() => import("./pages/Profile.tsx"));
const Supplements = lazyPage(() => import("./pages/Supplements.tsx"));
const Products = lazyPage(() => import("./pages/Products.tsx"));
const Reports = lazyPage(() => import("./pages/Reports.tsx"));
const Settings = lazyPage(() => import("./pages/Settings.tsx"));
const Subscription = lazyPage(() => import("./pages/Subscription.tsx"));
const Admin = lazyPage(() => import("./pages/Admin.tsx"));
const NotFound = lazyPage(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 border border-primary/40 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#dcff8a] transition-colors hover:bg-primary/20"
            >
              ↻ Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// PWA — service worker registration. Production only: the dev preview must
// never serve stale cached bundles.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <LanguageProvider>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <Onboarding />
                  </RequireAuth>
                }
              />
              <Route
                path="/coach"
                element={
                  <RequireAuth>
                    <Coach />
                  </RequireAuth>
                }
              />
              <Route
                path="/journey"
                element={
                  <RequireAuth>
                    <Journey />
                  </RequireAuth>
                }
              />
              <Route
                path="/physique"
                element={
                  <RequireAuth>
                    <Physique />
                  </RequireAuth>
                }
              />
              <Route
                path="/workout"
                element={
                  <RequireAuth>
                    <Workout />
                  </RequireAuth>
                }
              />
              <Route
                path="/nutrition"
                element={
                  <RequireAuth>
                    <Nutrition />
                  </RequireAuth>
                }
              />
              <Route
                path="/progress"
                element={
                  <RequireAuth>
                    <Progress />
                  </RequireAuth>
                }
              />
              <Route
                path="/checkin"
                element={
                  <RequireAuth>
                    <CheckIn />
                  </RequireAuth>
                }
              />
              <Route
                path="/goals"
                element={
                  <RequireAuth>
                    <Goals />
                  </RequireAuth>
                }
              />
              <Route
                path="/bodybuilding"
                element={
                  <RequireAuth>
                    <Bodybuilding />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />
              <Route
                path="/supplements"
                element={
                  <RequireAuth>
                    <Supplements />
                  </RequireAuth>
                }
              />
              <Route
                path="/products"
                element={
                  <RequireAuth>
                    <Products />
                  </RequireAuth>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireAuth>
                    <Reports />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
              <Route
                path="/subscription"
                element={
                  <RequireAuth>
                    <Subscription />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <Admin />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </LanguageProvider>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
