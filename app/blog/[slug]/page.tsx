import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleContent } from "@/components/blog/article-content";
import { DotPattern } from "@/components/ui/dot-pattern";
import { getAllPosts, getPost } from "@/lib/blog";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await getAllPosts({ includeDrafts: true });
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug, { includeDrafts: process.env.NODE_ENV === "development" });
  if (!post) return {};
  return {
    title: `${post.title} | Arash Ahmadi`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
      ...(post.cover ? { images: [{ url: post.cover.src, width: post.cover.width, height: post.cover.height, alt: post.cover.alt }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug, { includeDrafts: process.env.NODE_ENV === "development" });
  if (!post) notFound();

  return (
    <main className="blog-shell">
      <DotPattern width={20} height={20} cx={1} cy={1} cr={1} className="blog-dot-pattern" />
      <article className="article-wrap">
        <nav className="blog-top-nav" aria-label="Article navigation">
          <Link href="/blog">← Blog posts</Link>
          <Link href="/">Arash Ahmadi</Link>
        </nav>
        <header className="article-header">
          <div className="article-meta">
            <span>{post.dateLabel}</span>
            <span>{post.readTime}</span>
            {post.status === "draft" && <span>Local draft</span>}
            {post.originalPost && (
              <a href={post.originalPost.href} target="_blank" rel="noopener noreferrer">{post.originalPost.label} ↗</a>
            )}
          </div>
          <h1>{post.title}</h1>
          {post.subtitle && <p>{post.subtitle}</p>}
          <div className="article-tags">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </header>
        {post.cover && (
          <figure className="article-cover">
            <Image src={post.cover.src} alt={post.cover.alt} width={post.cover.width} height={post.cover.height} sizes="(max-width: 1120px) 100vw, 1120px" priority />
            {post.cover.credit && <figcaption>{post.cover.credit}</figcaption>}
          </figure>
        )}
        <ArticleContent blocks={post.blocks} />
        <footer className="article-sources">
          <p className="blog-kicker">Sources and project links</p>
          <h2>Continue from here</h2>
          <div>
            {post.sources.map((source) => (
              <a href={source.href} target="_blank" rel="noopener noreferrer" key={source.href}>
                {source.label}<span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
          <Link href="/blog">← Back to blog posts</Link>
        </footer>
      </article>
    </main>
  );
}
