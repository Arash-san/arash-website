import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { isBlogPost, type BlogPost } from "@/lib/blog-types";

export const BLOG_CONTENT_DIR = path.join(process.cwd(), "content", "blog");

async function readPostFile(fileName: string): Promise<BlogPost> {
  const raw = await fs.readFile(path.join(BLOG_CONTENT_DIR, fileName), "utf8");
  const value: unknown = JSON.parse(raw);
  if (!isBlogPost(value)) {
    throw new Error(`Invalid blog document: ${fileName}`);
  }
  return value;
}

export async function getAllPosts(options?: { includeDrafts?: boolean }) {
  const files = (await fs.readdir(BLOG_CONTENT_DIR)).filter((file) => file.endsWith(".json"));
  const posts = await Promise.all(files.map(readPostFile));
  return posts
    .filter((post) => options?.includeDrafts || post.status === "published")
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string, options?: { includeDrafts?: boolean }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    const post = await readPostFile(`${slug}.json`);
    if (post.status === "draft" && !options?.includeDrafts) return null;
    return post;
  } catch {
    return null;
  }
}
