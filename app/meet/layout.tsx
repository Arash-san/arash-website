import type { Metadata } from "next";
import "./meet.css";

export const metadata: Metadata = {
  title: "Meet with Arash",
  description: "Find a time to meet with Arash Ahmadi.",
  robots: { index: false, follow: false },
  openGraph: { title: "Meet with Arash", description: "Pick the times that work for you.", images: ["/portrait.jpg"] },
};

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
