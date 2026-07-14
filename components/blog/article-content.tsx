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

export function ArticleContent({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="article-copy">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <h2 id={block.id} key={`${block.id}:${index}`}>{block.text}</h2>;
        }
        if (block.type === "paragraph") {
          return <p key={`paragraph:${index}`}>{block.text}</p>;
        }
        if (block.type === "callout") {
          return (
            <aside className="article-callout" key={`callout:${index}`}>
              <strong>{block.label}</strong>
              <p>{block.text}</p>
            </aside>
          );
        }
        return <Lab name={block.lab} key={`lab:${block.lab}:${index}`} />;
      })}
    </div>
  );
}
