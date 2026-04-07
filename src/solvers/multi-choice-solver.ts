import { BaseSolver } from "./base-solver";
import { ChallengeType } from "../types";
import type { ChallengeData, SolveResult } from "../types";
import { PROMPTS } from "../ai/prompts";

export class MultiChoiceSolver extends BaseSolver {
  canSolve(type: ChallengeType): boolean {
    return type === ChallengeType.MULTI_CHOICE;
  }

  async solve(data: ChallengeData): Promise<SolveResult> {
    const prompt = PROMPTS[ChallengeType.MULTI_CHOICE];

    const images: Buffer[] = [];
    if (data.referenceImage) images.push(data.referenceImage);
    if (data.optionImages?.length) images.push(...data.optionImages);

    // Fallback to full screenshot
    if (images.length === 0) images.push(data.fullScreenshot);

    const optionCount = data.optionImages?.length ?? 3;
    const userPrompt = prompt.user(data.promptText, { optionCount });
    this.log.info(`Multi-choice solve: "${data.promptText}" (${optionCount} options)`);

    const response = await this.ai.analyzeImage({
      images,
      prompt: userPrompt,
      systemPrompt: prompt.system,
      model: this.model,
    });

    const num = parseInt(response.trim(), 10);
    const selectedOption = isNaN(num) ? 0 : num;

    this.log.info("Selected option:", selectedOption);
    return {
      type: ChallengeType.MULTI_CHOICE,
      selectedOption,
      confidence: isNaN(num) ? 0.3 : 0.8,
    };
  }
}
