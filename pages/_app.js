import { useEffect } from "react";
import "@/styles/globals.css";
import { UserProvider } from "@/lib/userContext"; // ✅ use relative path
import RouteAuthGuard from "@/components/RouteAuthGuard";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const registerSw = () => {
      try {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            if (process.env.NODE_ENV === "development") {
              console.log("[PWA] service worker registered", reg?.scope);
            }
          })
          .catch((err) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[PWA] service worker registration failed", err);
            }
          });
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[PWA] service worker registration error", e);
        }
      }
    };

    if (document.readyState === "complete") {
      registerSw();
    } else {
      window.addEventListener("load", registerSw, { once: true });
    }
  }, []);

  return (
    <UserProvider>
      <RouteAuthGuard>
        <Component {...pageProps} />
      </RouteAuthGuard>
    </UserProvider>
  );
}
