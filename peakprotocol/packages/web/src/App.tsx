import { Router, Route } from "@solidjs/router";
import { lazy, type JSX } from "solid-js";
import { AuthProvider } from "./stores/auth";
import AuthGuard from "./components/AuthGuard";
import Nav from "./components/Nav";
import OfflineIndicator from "./components/OfflineIndicator";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Supplements = lazy(() => import("./pages/Supplements"));
const SupplementNew = lazy(() => import("./pages/SupplementNew"));
const SupplementDetail = lazy(() => import("./components/SupplementDetail"));
const Metrics = lazy(() => import("./pages/Metrics"));
const Food = lazy(() => import("./pages/Food"));
const Training = lazy(() => import("./pages/Training"));
const Journal = lazy(() => import("./pages/Journal"));
const Reports = lazy(() => import("./pages/Reports"));

/**
 * Root layout rendered by the Router via `root` prop.
 * In @solidjs/router 0.14+, non-Route children inside <Router> are ignored,
 * so Nav must live inside the layout provided through `root`.
 */
function AppLayout(props: { children?: JSX.Element }): JSX.Element {
  return (
    <>
      <Nav />
      {props.children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineIndicator />
      <AuthGuard>
        <Router root={AppLayout}>
          <Route path="/" component={Dashboard} />
          <Route path="/supplements" component={Supplements} />
          <Route path="/supplements/new" component={SupplementNew} />
          <Route path="/supplements/:id" component={SupplementDetail} />
          <Route path="/metrics" component={Metrics} />
          <Route path="/food" component={Food} />
          <Route path="/training" component={Training} />
          <Route path="/journal" component={Journal} />
          <Route path="/reports" component={Reports} />
        </Router>
      </AuthGuard>
    </AuthProvider>
  );
}
