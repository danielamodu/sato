import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Eagerly kick off the /app chunk fetch when the entry URL is /app (or testnet subdomain)
// to eliminate the React mount -> lazy chunk request waterfall, while keeping /app
// 100% excluded from landing page (/) loads.
const isAppEntry =
  typeof window !== "undefined" &&
  (window.location.pathname.startsWith("/app") ||
    window.location.hostname.startsWith("testnet."));
const appChunkPromise = isAppEntry ? import("./pages/App") : null;

const SatoApp = lazy(() => appChunkPromise ?? import("./pages/App"));
const People = lazy(() => import("@/pages/People"));
const Businesses = lazy(() => import("@/pages/Businesses"));
const Security = lazy(() => import("./pages/Security"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/app"} component={SatoApp} />
        <Route path={"/people"} component={People} />
        <Route path={"/businesses"} component={Businesses} />
        <Route path={"/security"} component={Security} />
        <Route path={"/privacy"} component={Privacy} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <Router />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
