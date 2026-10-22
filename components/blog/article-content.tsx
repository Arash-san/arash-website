import Image from "next/image";
import type { ReactNode } from "react";
import type { BlogBlock } from "@/lib/blog-types";
import { CryptoProtocolLab } from "@/components/blog/crypto-protocol-lab";
import {
  CanonicalIdentityLab,
  CommitmentAvalancheLab,
  CryptoRoadmapLab,
  KeyAnatomyLab,
  ProtocolFlowLab,
  SecurityBudgetLab,
  ThreatModelLab,
} from "@/components/blog/crypto-visual-labs";

function Lab({ name }: { name: Extract<BlogBlock, { type: "lab" }>['lab'] }) {
  if (name === "protocol-flow") return <ProtocolFlowLab />;
  if (name === "key-anatomy") return <KeyAnatomyLab />;
  if (name === "crypto-protocol") return <CryptoProtocolLab />;
  if (name === "canonical-identity") return <CanonicalIdentityLab />;
  if (name === "commitment-avalanche") return <CommitmentAvalancheLab />;
  if (name === "security-budget") return <SecurityBudgetLab />;
  if (name === "threat-model") return <ThreatModelLab />;
  return <CryptoRoadmapLab />;
}

const URL_PATTERN = /https?:\/\/[^\s)]+/g;

// Turns bare URLs in paragraph text into links. Trailing sentence punctuation stays outside the link.
function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;:!?]+$/, "");
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<a href={url} target="_blank" rel="noopener noreferrer" key={`${start}:${url}`}>{url}</a>);
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function ArticleContent({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="article-copy">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <h2 id={block.id} key={`${block.id}:${index}`}>{block.text}</h2>;
        }
        if (block.type === "paragraph") {
          return <p key={`paragraph:${index}`}>{linkify(block.text)}</p>;
        }
        if (block.type === "callout") {
          return (
            <aside className="article-callout" key={`callout:${index}`}>
              <strong>{block.label}</strong>
              <p>{block.text}</p>
            </aside>
          );
        }
        if (block.type === "image") {
          return (
            <figure className="article-figure" key={`image:${block.src}:${index}`}>
              <Image src={block.src} alt={block.alt} width={block.width} height={block.height} sizes="(max-width: 760px) 100vw, 730px" />
              {block.caption && <figcaption>{block.caption}</figcaption>}
            </figure>
          );
        }
        return <Lab name={block.lab} key={`lab:${block.lab}:${index}`} />;
      })}
    </div>
  );
}
