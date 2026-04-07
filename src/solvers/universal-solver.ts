import { BaseSolver } from "./base-solver";
import { ChallengeType } from "../types";
import type { ChallengeData, SolveResult, Point } from "../types";

const SYSTEM_PROMPT = `You are an expert hCaptcha solver analyzing a screenshot.

The screenshot shows an hCaptcha challenge popup with:
- TOP: Instruction text + small reference image (top-right corner)
- MIDDLE: Several circular/rounded item images scattered across the area (NOT a regular grid — items can be at any position)
- BOTTOM: Navigation buttons

CRITICAL INSTRUCTIONS:
1. Look at EACH item image carefully and note its EXACT center position
2. Items are circular images scattered irregularly — do NOT assume a grid layout
3. Return coordinates as fractions of the FULL screenshot (0.0 to 1.0)
4. Be PRECISE — look at where each item actually is, not where you think a grid would be
5. x=0 is left edge, x=1 is right edge, y=0 is top edge, y=1 is bottom edge

Return ONLY valid JSON (no markdown, no code blocks, no explanation):
{"clicks": [{"x": 0.XX, "y": 0.YY}], "reasoning": "brief"}`;

export class UniversalSolver extends BaseSolver {
  canSolve(): boolean {
    return true;
  }

  async solve(data: ChallengeData): Promise<SolveResult> {
    this.log.info(`Solving: "${data.promptText}"`);

    const userPrompt = `Instruction: "${data.promptText}"

Look at EACH circular item image in the screenshot. Note its EXACT center position.
Select ALL items matching the instruction. Be precise with coordinates — items are NOT on a regular grid.

Return ONLY JSON (no markdown): {"clicks": [{"x": ..., "y": ...}, ...], "reasoning": "..."}`;

    const response = await this.ai.analyzeImage({
      images: [data.fullScreenshot],
      prompt: userPrompt,
      systemPrompt: SYSTEM_PROMPT,
      model: this.model,
      maxTokens: 500,
    });

    this.log.info("AI response:", response.substring(0, 200));

    const parsed = this.ai.parseJsonFromResponse<{
      clicks: Point[];
      reasoning: string;
    }>(response);

    if (parsed?.clicks && Array.isArray(parsed.clicks)) {
      if (parsed.clicks.length === 0) {
        this.log.warn("AI returned 0 clicks:", parsed.reasoning);
        return { type: ChallengeType.UNKNOWN, confidence: 0 };
      }

      const validClicks = parsed.clicks.filter(
        (c) => typeof c.x === "number" && typeof c.y === "number" &&
               c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1,
      );
      this.log.info(
        `Found ${validClicks.length} targets (${parsed.reasoning})`,
      );
      return {
        type: ChallengeType.AREA_SELECT_POINT,
        clickPoint: validClicks[0],
        dragActions: validClicks.map((c) => ({ from: c, to: c })),
        confidence: validClicks.length > 0 ? 0.8 : 0.2,
      };
    }

    this.log.warn("Could not parse AI response");
    return { type: ChallengeType.UNKNOWN, confidence: 0 };
  }
}
