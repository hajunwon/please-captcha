import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { toBase64 } from "../utils/image-utils";

export class ClaudeClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyzeImage(opts: {
    images: Buffer[];
    prompt: string;
    systemPrompt: string;
    model: string;
    maxTokens?: number;
  }): Promise<string> {
    const imageBlocks: ImageBlockParam[] = opts.images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: toBase64(img),
      },
    }));

    const messages: MessageParam[] = [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: opts.prompt },
        ],
      },
    ];

    const response = await this.client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 256,
      system: opts.systemPrompt,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }

  parseJsonFromResponse<T>(raw: string): T | null {
    // Try direct parse
    try {
      return JSON.parse(raw) as T;
    } catch {}

    // Extract JSON array
    const arrayMatch = raw.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch {}
    }

    // Extract JSON object
    const objMatch = raw.match(/\{[\s\S]*?\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {}
    }

    // Extract comma-separated numbers
    const nums = raw.match(/\d+/g);
    if (nums) {
      try {
        return nums.map(Number) as unknown as T;
      } catch {}
    }

    return null;
  }
}
