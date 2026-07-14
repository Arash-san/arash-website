import type { Metadata } from "next";
import Link from "next/link";
import { DotPattern } from "@/components/ui/dot-pattern";
import { YinYangExplorer } from "@/components/yinyang/yinyang-explorer";

export const metadata: Metadata = {
  title: "Yin Yang Puzzle Explorer | Arash Ahmadi",
  description: "Edit Yin Yang puzzles, search exact solution catalogs, and inspect rotation, reflection, diagonal, and color exchange groups.",
};

export default function YinYangToolPage() {
  return (
    <main className="yy-tool-shell">
      <DotPattern width={20} height={20} cx={1} cy={1} cr={1} className="blog-dot-pattern" />
      <nav className="yy-tool-nav" aria-label="Tool navigation">
        <Link href="/#tools">← Arash Ahmadi</Link>
        <Link href="/blog/yin-yang-cryptography">Cryptography report</Link>
      </nav>
      <YinYangExplorer />
    </main>
  );
}
