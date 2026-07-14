export type BlogStatus = "draft" | "published";

export type BlogLab =
  | "protocol-flow"
  | "key-anatomy"
  | "crypto-protocol"
  | "canonical-identity"
  | "commitment-avalanche"
  | "security-budget"
  | "threat-model"
  | "crypto-roadmap";

export type BlogBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; id: string; text: string }
  | { type: "callout"; label: string; text: string }
  | { type: "lab"; lab: BlogLab };

export type BlogSource = {
  label: string;
  href: string;
};

export type BlogPost = {
  schemaVersion: 1;
  slug: string;
  status: BlogStatus;
  date: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  excerpt: string;
  readTime: string;
  tags: string[];
  featured: boolean;
  blocks: BlogBlock[];
  sources: BlogSource[];
};

export function isBlogPost(value: unknown): value is BlogPost {
  if (!value || typeof value !== "object") return false;
  const post = value as Partial<BlogPost>;
  return (
    post.schemaVersion === 1 &&
    typeof post.slug === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) &&
    (post.status === "draft" || post.status === "published") &&
    typeof post.date === "string" &&
    typeof post.dateLabel === "string" &&
    typeof post.title === "string" &&
    typeof post.subtitle === "string" &&
    typeof post.excerpt === "string" &&
    typeof post.readTime === "string" &&
    Array.isArray(post.tags) &&
    typeof post.featured === "boolean" &&
    Array.isArray(post.blocks) &&
    Array.isArray(post.sources)
  );
}
