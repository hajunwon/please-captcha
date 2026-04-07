import type { Frame } from "puppeteer";
import { SELECTORS } from "../config";
import { ChallengeType } from "../types";
import { AIClient } from "../ai/ai-client";
import { PROMPTS } from "../ai/prompts";
import type { Logger } from "../utils/logger";

export class ChallengeDetector {
  constructor(
    private ai: AIClient,
    private model: string,
    private log: Logger,
  ) {}

  async detect(frame: Frame, screenshot?: Buffer): Promise<ChallengeType> {
    // Phase 1: DOM-based detection (fast)
    const domResult = await this.detectFromDom(frame);
    if (domResult !== ChallengeType.UNKNOWN) {
      this.log.info("Challenge type (DOM):", domResult);
      return domResult;
    }

    // Phase 2: Vision-based detection (fallback)
    if (screenshot) {
      const visionResult = await this.detectFromVision(screenshot);
      this.log.info("Challenge type (Vision):", visionResult);
      return visionResult;
    }

    return ChallengeType.UNKNOWN;
  }

  private async detectFromDom(frame: Frame): Promise<ChallengeType> {
    try {
      // Check for grid
      const gridCells = await frame.$$(SELECTORS.taskImage);
      if (gridCells.length >= 4) {
        return ChallengeType.GRID_SELECT;
      }

      // Check for multiple choice
      const answers = await frame.$$(
        `${SELECTORS.taskAnswers} .task-answer`,
      );
      if (answers.length >= 2) {
        return ChallengeType.MULTI_CHOICE;
      }

      // Check for draggable elements
      const draggable = await frame.$$('[draggable="true"], .drag-item');
      if (draggable.length > 0) {
        return ChallengeType.DRAG_DROP;
      }

      // Check for canvas/area select
      const canvas = await frame.$("canvas");
      if (canvas) {
        return ChallengeType.AREA_SELECT_BBOX;
      }

      // Check for a single large challenge image (area select)
      const singleImage = await frame.$(".challenge-image, .task-image:only-child");
      if (singleImage) {
        return ChallengeType.AREA_SELECT_POINT;
      }
    } catch {}

    return ChallengeType.UNKNOWN;
  }

  private async detectFromVision(screenshot: Buffer): Promise<ChallengeType> {
    const prompt = PROMPTS.classify;
    const response = await this.ai.analyzeImage({
      images: [screenshot],
      prompt: prompt.user(""),
      systemPrompt: prompt.system,
      model: this.model,
      maxTokens: 30,
    });

    const clean = response.trim().toLowerCase().replace(/[^a-z_]/g, "");
    const typeMap: Record<string, ChallengeType> = {
      grid_select: ChallengeType.GRID_SELECT,
      multi_choice: ChallengeType.MULTI_CHOICE,
      area_select_point: ChallengeType.AREA_SELECT_POINT,
      area_select_bbox: ChallengeType.AREA_SELECT_BBOX,
      drag_drop: ChallengeType.DRAG_DROP,
      puzzle: ChallengeType.PUZZLE,
    };

    return typeMap[clean] ?? ChallengeType.PUZZLE;
  }
}
