import type { Metadata } from "next";
import Link from "next/link";
import { DotPattern } from "@/components/ui/dot-pattern";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog Posts | Arash Ahmadi",
  description: "Interesting work, personal thoughts, experiments, and other ideas by Arash Ahmadi.",
};

export default async function BlogIndexPage() {
  const posts = await getAllPosts({ includeDrafts: process.env.NODE_ENV === "development" });
  return (
    <main className="blog-shell">
      <DotPattern width={20} height={20} cx={1} cy={1} cr={1} className="blog-dot-pattern" />
      <div className="blog-index-wrap">
        <nav className="blog-top-nav" aria-label="Blog navigation">
          <Link href="/#blog">← Arash Ahmadi</Link>
          <span>Blog posts</span>
        </nav>
        <header className="blog-index-header">
          <p className="blog-kicker">A place for things I want to share</p>
          <h1>Blog posts</h1>
          <p>Welcome to my blog section, where I will share interesting works, my thoughts, and other similar topics.</p>
        </header>
        <section className="blog-index-list" aria-label="Posts">
          {posts.map((post, index) => (
            <article key={post.slug}>
              <div className="blog-index-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <p className="blog-index-meta">{post.dateLabel} · {post.readTime}{post.status === "draft" ? " · local draft" : ""}</p>
                <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                <p>{post.excerpt}</p>
                <Link className="blog-index-link" href={`/blog/${post.slug}`}>Read the post <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
