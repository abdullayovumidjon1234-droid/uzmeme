import "./globals.css";
import type { ReactNode } from "react";
export const metadata = { title: "MEME", description: "Create, share and download memes", icons: { icon: "/icon.svg" } };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
