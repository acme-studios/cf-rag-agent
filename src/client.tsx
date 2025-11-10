import "./styles.css";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./app";

const root = createRoot(document.getElementById("app")!);

root.render(
  <StrictMode>
    <div className="bg-neutral-50 text-base text-neutral-900 antialiased transition-colors selection:bg-blue-700 selection:text-white dark:bg-neutral-950 dark:text-neutral-100">
      <App />
    </div>
  </StrictMode>
);
