/* @refresh reload */
import "virtual:uno.css";
import "@unocss/reset/tailwind.css";
import { render } from "solid-js/web";
import App from "./App";

// Signal that the module script has started executing
(window as any).__ppModuleLoaded = true;
console.info("[PeakProtocol] index.tsx module is executing");

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found. Ensure index.html has a <div id=\"root\">.");
}

// Clear the static loading placeholder before SolidJS renders.
// SolidJS render() appends children — it does NOT replace innerHTML —
// so the placeholder must be removed explicitly.
root.innerHTML = "";

try {
  render(() => <App />, root);
  console.info("[PeakProtocol] App mounted successfully");
} catch (err) {
  console.error("[PeakProtocol] Failed to mount:", err);
  root.innerHTML = `<pre style="padding:20px;color:red;">${err}</pre>`;
}

// Register service worker after app renders
import("./lib/sw-register").then(({ registerServiceWorker }) =>
  registerServiceWorker(),
);
