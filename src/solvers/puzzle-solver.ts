import { BaseSolver } from "./base-solver";
import { ChallengeType } from "../types";
import type { ChallengeData, SolveResult } from "../types";
import { PROMPTS } from "../ai/prompts";

export class PuzzleSolver extends BaseSolver {
  canSolve(type: ChallengeType): boolean {
    return type === ChallengeType.PUZZLE || type === ChallengeType.UNKNOWN;
  }

  async solve(data: ChallengeData): Promise<SolveResult> {
    const prompt = PROMPTS[ChallengeType.PUZZLE];
    const image = data.challengeImage ?? data.fullScreenshot;

    this.log.info(`Puzzle solve: "${data.promptText}"`);

    const response = await this.ai.analyzeImage({
      images: [image],
      prompt: prompt.user(data.promptText),
      systemPrompt: prompt.system,
      model: this.model,
      maxTokens: 512,
    });

    const parsed = this.ai.parseJsonFromResponse<{
      action: string;
      x?: number;
      y?: number;
      index?: number;
      from?: { x: number; y: number };
      to?: { x: number; y: number };
    }>(response);

    if (!parsed) {
      this.log.warn("Failed to parse puzzle response:", response);
      return { type: ChallengeType.PUZZLE, confidence: 0 };
    }

    switch (parsed.action) {
      case "click":
        return {
          type: ChallengeType.PUZZLE,
          clickPoint: { x: parsed.x ?? 0.5, y: parsed.y ?? 0.5 },
          confidence: 0.6,
        };
      case "select":
        return {
          type: ChallengeType.PUZZLE,
          selectedOption: parsed.index ?? 0,
          confidence: 0.6,
        };
      case "drag":
        if (parsed.from && parsed.to) {
          return {
            type: ChallengeType.PUZZLE,
            dragActions: [{ from: parsed.from, to: parsed.to }],
            confidence: 0.6,
          };
        }
        break;
    }

    return { type: ChallengeType.PUZZLE, confidence: 0.2 };
  }
}
