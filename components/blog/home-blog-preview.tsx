"use client";

import Link from "next/link";
import { useState } from "react";
import paradoxPost from "@/content/blog/the-paradox-i-see-in-ai-agents.json";
import yinYangPost from "@/content/blog/yin-yang-cryptography.json";

type PreviewPost = {
  slug: string;
  status: string;
  date: string;
  dateLabel: string;
  readTime: string;
  title: string;
  excerpt: string;
  tags: string[];
};

// Newest first. Add a new post's JSON here to show it on the home page.
const POSTS: PreviewPost[] = [paradoxPost, yinYangPost]
  .filter((post) => post.status === "published")
  .sort((a, b) => b.date.localeCompare(a.date));

function PostPreview({ post }: { post: PreviewPost }) {
  const [open, setOpen] = useState(false);
  return (
    <article data-open={open}>
      <button
        type="button"
        aria-expanded={open}
        className="home-blog-toggle"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <small>{post.dateLabel} · {post.readTime}</small>
          <strong>{post.title}</strong>
        </span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="home-blog-details">
          <p>{post.excerpt}</p>
          <div>
            {post.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <Link href={`/blog/${post.slug}`}>Read the blog post <span aria-hidden="true">→</span></Link>
        </div>
      )}
    </article>
  );
}

export function HomeBlogPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className="home-blog-preview">
      <p className={compact ? "text-xs" : "text-sm"}>
        Welcome to my blog section, where I will share interesting works, my thoughts, and other similar topics.
      </p>
      <div className="home-blog-list">
        {POSTS.map((post) => <PostPreview post={post} key={post.slug} />)}
      </div>
      <Link className="home-blog-all" href="/blog">See all blog posts</Link>
    </div>
  );
}
