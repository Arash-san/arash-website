import Link from "next/link";
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

/** Each post is one link straight to the article; no expand step first. */
export function HomeBlogPreview() {
  return (
    <div className="space-y-4">
      <p className="text-[15px] lg:text-base">
        Welcome to my blog section, where I will share interesting works, my thoughts, and other similar topics.
      </p>
      {POSTS.map((post) => (
        <Link
          key={post.slug}
          href={`/blog/${post.slug}/`}
          className="block group border-l-2 border-gray-200 hover:border-[#DC143C] pl-3 transition-colors"
        >
          <p className="text-xs text-gray-500">
            {post.dateLabel} · {post.readTime}
          </p>
          <p className="font-semibold text-gray-800 group-hover:text-[#DC143C] transition-colors text-[15px] lg:text-base leading-snug">
            {post.title}
          </p>
          <p className="text-xs lg:text-sm text-gray-600 mt-0.5 leading-relaxed line-clamp-2">{post.excerpt}</p>
        </Link>
      ))}
      <Link href="/blog/" className="inline-block text-sm font-semibold text-[#DC143C] underline underline-offset-4">
        See all blog posts →
      </Link>
    </div>
  );
}
