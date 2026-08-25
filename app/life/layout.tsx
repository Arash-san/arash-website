import type { Metadata } from "next";
import "@atlaskit/css-reset";

export const metadata: Metadata = {
  title: "Get Your Shit Together | Arash",
  description: "Arash's private daily command center.",
  robots: { index: false, follow: false },
  manifest: "/life.webmanifest",
};

export default function LifeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
