import { exec } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import { randomBytes } from "crypto";
import { toBase64 } from "../utils/image-utils";

export interface AnalyzeImageOptions {
  images: Buffer[];
  prompt: string;
  systemPrompt: string;
  model: string;
  maxTokens?: number;
}

export interface AIProvider {
  analyzeImage(opts: AnalyzeImageOptions): Promise<string>;
}

// --- Claude Provider ---

export class ClaudeProvider implements AIProvider {
  private client: any;

  constructor(apiKey: string) {
    // Lazy import to avoid requiring the package if not used
    const Anthropic = require("@anthropic-ai/sdk").default;
    this.client = new Anthropic({ apiKey });
  }

  async analyzeImage(opts: AnalyzeImageOptions): Promise<string> {
    const imageBlocks = opts.images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: toBase64(img),
      },
    }));

    const response = await this.client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 256,
      system: opts.systemPrompt,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: opts.prompt }],
        },
      ],
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    return textBlock?.text ?? "";
  }
}

// --- Gemini Provider ---

export class GeminiProvider implements AIProvider {
  private client: any;

  constructor(apiKey: string) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async analyzeImage(opts: AnalyzeImageOptions): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: opts.model,
      systemInstruction: opts.systemPrompt,
    });

    const imageParts = opts.images.map((img) => ({
      inlineData: {
        mimeType: "image/png",
        data: toBase64(img),
      },
    }));

    const result = await model.generateContent([
      ...imageParts,
      { text: opts.prompt },
    ]);

    return result.response.text();
  }
}

// --- Claude Code CLI Provider (no API key needed) ---

export class ClaudeCodeProvider implements AIProvider {
  async analyzeImage(opts: AnalyzeImageOptions): Promise<string> {
    // Save images to temp files
    const tempFiles: string[] = [];

    for (const img of opts.images) {
      const tempPath = join(
        tmpdir(),
        `captcha-${randomBytes(4).toString("hex")}.png`,
      );
      writeFileSync(tempPath, img);
      tempFiles.push(tempPath);
    }

    // Build prompt: tell Claude to read the image files
    const fileRefs = tempFiles
      .map((f, i) => `Image ${i}: ${f.replace(/\\/g, "/")}`)
      .join("\n");

    const fullPrompt = [
      opts.systemPrompt,
      "",
      "Read the following image files and analyze them.",
      fileRefs,
      "",
      opts.prompt,
    ].join("\n");

    try {
      // Strip ANTHROPIC_API_KEY from env so claude CLI uses OAuth login
      const cleanEnv = { ...process.env };
      delete cleanEnv.ANTHROPIC_API_KEY;

      const result = await new Promise<string>((resolve, reject) => {
        let stdoutBuf = "";
        let stderrBuf = "";

        const proc = exec(
          `claude -p --output-format json --model sonnet --allowedTools Read --dangerously-skip-permissions`,
          { timeout: 60_000, maxBuffer: 10 * 1024 * 1024, env: cleanEnv },
        );

        proc.stdout?.on("data", (d) => { stdoutBuf += d; });
        proc.stderr?.on("data", (d) => { stderrBuf += d; });

        proc.on("error", (e) => reject(new Error(`claude spawn error: ${e.message}`)));
        proc.on("close", (code) => {
          if (stdoutBuf.length > 0) return resolve(stdoutBuf);
          reject(new Error(`claude CLI exit ${code}, stderr: ${stderrBuf || "(empty)"}, prompt length: ${fullPrompt.length}`));
        });

        if (proc.stdin) {
          proc.stdin.on("error", () => {});
          proc.stdin.write(fullPrompt);
          proc.stdin.end();
        }
      });

      const parsed = JSON.parse(result);
      if (parsed.is_error) {
        throw new Error(`claude CLI error: ${parsed.result}`);
      }
      return parsed.result ?? "";
    } finally {
      for (const f of tempFiles) {
        try { unlinkSync(f); } catch {}
      }
    }
  }
}

// --- Unified Client ---

export class AIClient {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  async analyzeImage(opts: AnalyzeImageOptions): Promise<string> {
    return this.provider.analyzeImage(opts);
  }

  parseJsonFromResponse<T>(raw: string): T | null {
    // Try direct parse
    try {
      return JSON.parse(raw) as T;
    } catch {}

    // Extract from markdown code block (```json ... ``` or ``` ... ```)
    const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim()) as T;
      } catch {}
    }

    // Extract JSON object (greedy - find the largest valid JSON)
    const objMatches = raw.match(/\{[\s\S]*\}/);
    if (objMatches) {
      try {
        return JSON.parse(objMatches[0]) as T;
      } catch {}
    }

    // Extract JSON array
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
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

// --- Factory ---

export type ProviderType = "claude" | "gemini" | "claude-code";

export function createAIClient(provider: ProviderType, apiKey: string): AIClient {
  switch (provider) {
    case "claude":
      return new AIClient(new ClaudeProvider(apiKey));
    case "gemini":
      return new AIClient(new GeminiProvider(apiKey));
    case "claude-code":
      return new AIClient(new ClaudeCodeProvider());
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
