/* @refresh reload */
import { render } from "solid-js/web";
import "./app.css";
import App from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found. Add a <div id='root'> to index.html.");
}

render(() => <App />, root);
