import { BaseSolver } from "./base-solver";
import { ChallengeType } from "../types";
import type { ChallengeData, SolveResult } from "../types";
import { PROMPTS } from "../ai/prompts";

export class AreaSelectSolver extends BaseSolver {
  canSolve(type: ChallengeType): boolean {
    return (
      type === ChallengeType.AREA_SELECT_POINT ||
      type === ChallengeType.AREA_SELECT_BBOX
    );
  }

  async solve(data: ChallengeData): Promise<SolveResult> {
    const isPoint = data.type === ChallengeType.AREA_SELECT_POINT;
    const promptKey = isPoint
      ? ChallengeType.AREA_SELECT_POINT
      : ChallengeType.AREA_SELECT_BBOX;
    const prompt = PROMPTS[promptKey];

    const image = data.challengeImage ?? data.fullScreenshot;
    this.log.info(`Area select (${isPoint ? "point" : "bbox"}): "${data.promptText}"`);

    const response = await this.ai.analyzeImage({
      images: [image],
      prompt: prompt.user(data.promptText),
      systemPrompt: prompt.system,
      model: this.model,
    });

    if (isPoint) {
      const coords = this.ai.parseJsonFromResponse<{
        x: number;
        y: number;
      }>(response);
      if (coords && typeof coords.x === "number") {
        this.log.info("Click point:", coords);
        return {
          type: ChallengeType.AREA_SELECT_POINT,
          clickPoint: { x: clamp(coords.x), y: clamp(coords.y) },
          confidence: 0.7,
        };
      }
    } else {
      const box = this.ai.parseJsonFromResponse<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }>(response);
      if (box && typeof box.x1 === "number") {
        this.log.info("Bounding box:", box);
        return {
          type: ChallengeType.AREA_SELECT_BBOX,
          boundingBox: {
            x1: clamp(box.x1),
            y1: clamp(box.y1),
            x2: clamp(box.x2),
            y2: clamp(box.y2),
          },
          confidence: 0.7,
        };
      }
    }

    this.log.warn("Failed to parse area select response:", response);
    return {
      type: data.type,
      clickPoint: { x: 0.5, y: 0.5 },
      confidence: 0.1,
    };
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
