import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { getConvexUrlWithFallback } from "@get-convex/self-static-hosting";
import App from "./App.jsx";
import "./index.css";

// When running locally, use VITE_CONVEX_URL from .env.local
// When deployed to Convex static hosting, derive the URL from the hostname
const convexUrl = getConvexUrlWithFallback(import.meta.env.VITE_CONVEX_URL);

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
