import "@/styles/globals.css";
import { UserProvider } from "@/lib/userContext"; // ✅ use relative path

export default function App({ Component, pageProps }) {
  return (
    <UserProvider>
      <Component {...pageProps} />
    </UserProvider>
  );
}
