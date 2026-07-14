"use client";

import Link from "next/link";
import { useState } from "react";
import postJson from "@/content/blog/yin-yang-cryptography.json";

export function HomeBlogPreview({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const post = postJson;

  return (
    <div className="home-blog-preview">
      <p className={compact ? "text-xs" : "text-sm"}>
        Welcome to my blog section, where I will share interesting works, my thoughts, and other similar topics.
      </p>
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
      <Link className="home-blog-all" href="/blog">See all blog posts</Link>
    </div>
  );
}
