import { Codex } from "@openai/codex-sdk";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const periods = ["morning", "afternoon", "evening", "late-night"];
const modes = ["balanced", "focus", "social", "recovery"];
const progressStates = ["stuck", "moving", "clear"];

const itemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    period: { type: "string", enum: periods },
    mode: { type: "string", enum: modes },
    progress: { type: "string", enum: progressStates },
    headline: { type: "string" },
    nudge: { type: "string" },
  },
  required: ["id", "period", "mode", "progress", "headline", "nudge"],
  additionalProperties: false,
};

const outputSchema = {
  type: "object",
  properties: {
    items: { type: "array", minItems: 48, maxItems: 48, items: itemSchema },
  },
  required: ["items"],
  additionalProperties: false,
};

const combinations = periods.flatMap((period) => modes.flatMap((mode) => progressStates.map((progress) => ({
  id: `${period}-${mode}-${progress}`,
  period,
  mode,
  progress,
}))));

const prompt = `Write context-aware hero copy for Arash's private productivity command center.

Return one item for every supplied combination, preserving each id, period, mode, and progress exactly.

Voice contract:
- The speaker is a very cute, smart cat assistant.
- Sarcasm is 10/10, clever and affectionate, never cruel or shaming.
- The headline addresses Arash and fits in 2-7 words.
- The nudge is one sentence with at most 16 words.
- Make every item distinct and useful for its context.
- Recovery mode must reduce pressure. Social mode should encourage a small reply. Focus mode protects one task.
- Stuck means open tasks and nothing completed. Moving means at least one completion. Clear means no open tasks.
- No emoji, corporate language, generic motivational slogans, em dashes, en dashes, or decorative separators.
- No claims about live data that are not encoded in the context.

Combinations:
${JSON.stringify(combinations)}`;

const codex = new Codex();
const thread = codex.startThread({
  model: "gpt-5.6-luna",
  modelReasoningEffort: "xhigh",
  sandboxMode: "read-only",
  approvalPolicy: "never",
  workingDirectory: root,
  skipGitRepoCheck: false,
  webSearchMode: "disabled",
});

const turn = await thread.run(prompt, { outputSchema });
const parsed = JSON.parse(turn.finalResponse);
const payload = {
  generatedBy: "gpt-5.6-luna",
  reasoningEffort: "xhigh",
  generatedAt: new Date().toISOString(),
  items: parsed.items,
};

await writeFile(path.join(root, "public", "life", "greetings.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
process.stdout.write(`Generated ${payload.items.length} greeting variants with ${payload.generatedBy} (${payload.reasoningEffort}).\n`);
