import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";

const element = document.getElementById("root");
if (!element) {
  throw new Error("Missing application root element");
}
createRoot(element).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
