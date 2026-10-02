import { PARAMETERS } from "../src/engine/parameters.ts";

export class ClaudeError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function catalogue(): string {
  return PARAMETERS.map((parameter) => {
    const options = parameter.options?.map((option) => option.value).join(" | ");
    const range = parameter.min !== undefined ? `, ${parameter.min} to ${parameter.max}` : "";
    const access = parameter.settable ? "settable" : "derived, read-only";
    return `- ${parameter.key}: ${options ?? parameter.kind}${range} (${access})`;
  }).join("\n");
}

export function ruleAuthorSystemPrompt(): string {
  return `You translate a warehouse-shelving constraint into one Kit Engine rule.
Reply with a single JSON object and nothing else. No markdown. No code. No extra keys.

JSON shape:
{
  "id": "lowercase-kebab-case",
  "severity": "error" or "warning",
  "when": [{ "parameter": "frameMaterial", "operator": "==", "value": "steel" }],
  "then": { "parameter": "bayWidth", "operator": "<=", "value": 1800 },
  "message": "One sentence a sales engineer can read.",
  "explanation": "Why the constraint exists.",
  "suggestion": "What the user should change.",
  "fixes": [{ "parameter": "bayWidth", "value": 1800 }]
}

when may be omitted or empty. fixes is optional and may only assign settable parameters.
Operators for numbers: == != < <= > >=
Operators for text and booleans: == !=
Use error for a hard structural limit and warning for a recommendation.

Parameters:
${catalogue()}

Do not invent parameters, operators, or units. Do not return JavaScript.`;
}

export async function requestRuleProposal(instruction: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeError("Claude API is not configured. Set ANTHROPIC_API_KEY on the server.", 503);
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system: ruleAuthorSystemPrompt(),
        messages: [{ role: "user", content: instruction }],
      }),
    });
  } catch {
    throw new ClaudeError("The rule authoring service did not respond. Try again.", 502);
  }

  if (!response.ok) {
    throw new ClaudeError("The rule authoring service rejected the request. Try again.", 502);
  }

  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = payload.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");
  if (!text) throw new ClaudeError("The rule authoring service returned an empty response.", 502);
  return text;
}
