import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import OwnerGate from "./components/OwnerGate";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <OwnerGate>
        {(lock) => <App onLock={lock} />}
      </OwnerGate>
    </BrowserRouter>
  </StrictMode>
);
