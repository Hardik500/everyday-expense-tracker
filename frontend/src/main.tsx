import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { SWRProvider } from "./contexts/SWRProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SWRProvider>
        <App />
      </SWRProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
