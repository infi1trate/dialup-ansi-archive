import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  useRouterState,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, type ReactNode } from "react";

const Computer = lazy(() => import("@/components/machine/Computer").then((m) => ({ default: m.Computer })));

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

/** A wrong number: the room, and TELEWIRE prints NO CARRIER before dropping to DOS. */
function NotFoundComponent() {
  const path = useRouterState({ select: (st) => st.location.pathname });
  return <Suspense fallback={<main className="room" aria-busy="true" />}><Computer lost={path || "/"} /></Suspense>;
}

/** Last-resort crash screen (the machine itself failed to render). Period-style, one way out: reboot. */
function ErrorComponent({ error }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <main className="crash">
      <pre>{`Kestrel DOS 5.0

EXCEPTION 0D AT 0142:1A2B  General Protection Fault
${String((error as Error)?.message ?? error).slice(0, 70).toUpperCase()}

The system has been halted. Cycle the power to continue.`}</pre>
      <button type="button" onClick={() => window.location.reload()}>[ POWER CYCLE ]</button>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dial-Up" },
      { name: "description", content: "An early-1990s BBS in the browser, serving the ANSI art scene's archive." },
      { property: "og:title", content: "Dial-Up" },
      { property: "og:description", content: "An early-1990s BBS in the browser, serving the ANSI art scene's archive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // pre-launch: the owner lifts this at launch
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Michroma&family=Nanum+Pen+Script&family=IBM+Plex+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* Load screen: inline styles so it paints before CSS/JS. Removed on mount below. */}
        <div id="boot-splash" role="status" aria-label="Loading" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", background: "rgb(16,15,13)", color: "rgb(120,118,104)", fontFamily: "monospace", fontSize: "14px", letterSpacing: "0.35em" }}>
          <span>
            DIAL-UP
            <span className="boot-cursor" style={{ display: "inline-block", width: "0.6em", height: "1em", marginLeft: "0.35em", verticalAlign: "-0.15em", background: "currentColor", animation: "boot-blink 1.06s steps(1) infinite" }} />
          </span>
          <style>{`@keyframes boot-blink { 50% { opacity: 0 } } @media (prefers-reduced-motion: reduce) { .boot-cursor { animation: none } }`}</style>
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    document.getElementById("boot-splash")?.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
