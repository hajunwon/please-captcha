import type { Frame, ElementHandle } from "puppeteer";
import { SELECTORS } from "../config";
import { sliceGrid } from "../utils/image-utils";
import type { ChallengeType, ChallengeData } from "../types";
import type { Logger } from "../utils/logger";

export class ImageExtractor {
  constructor(private log: Logger) {}

  async extract(
    frame: Frame,
    type: ChallengeType,
  ): Promise<Partial<ChallengeData>> {
    const fullScreenshot = await this.screenshotFrame(frame);
    const result: Partial<ChallengeData> = { fullScreenshot };

    switch (type) {
      case "grid_select":
        await this.extractGrid(frame, result);
        break;
      case "multi_choice":
        await this.extractMultiChoice(frame, result);
        break;
      default:
        result.challengeImage = fullScreenshot;
        break;
    }

    return result;
  }

  private async extractGrid(
    frame: Frame,
    result: Partial<ChallengeData>,
  ): Promise<void> {
    try {
      const cellCount = await frame.$$eval(
        SELECTORS.taskImage,
        (els) => els.length,
      );

      let rows: number, cols: number;
      if (cellCount === 16) {
        rows = 4;
        cols = 4;
      } else {
        rows = 3;
        cols = 3;
      }
      result.gridDimensions = { rows, cols };

      // Screenshot the grid area
      const gridEl = await frame.$(SELECTORS.taskGrid);
      if (gridEl) {
        const gridShot = await gridEl.screenshot({ type: "png" });
        const gridBuffer = Buffer.from(gridShot);
        result.gridCells = await sliceGrid(gridBuffer, rows, cols);
        this.log.info(`Extracted ${rows}x${cols} grid (${result.gridCells.length} cells)`);
        return;
      }
    } catch (e) {
      this.log.warn("Grid DOM extraction failed, using full screenshot");
    }

    // Fallback: slice the full screenshot
    result.gridDimensions = { rows: 3, cols: 3 };
    result.gridCells = await sliceGrid(result.fullScreenshot!, 3, 3);
  }

  private async extractMultiChoice(
    frame: Frame,
    result: Partial<ChallengeData>,
  ): Promise<void> {
    try {
      // Reference image
      const refEl = await frame.$(SELECTORS.challengeImage);
      if (refEl) {
        const shot = await refEl.screenshot({ type: "png" });
        result.referenceImage = Buffer.from(shot);
      }

      // Option images
      const optionEls = await frame.$$(
        `${SELECTORS.taskAnswers} .task-answer .image`,
      );
      result.optionImages = [];
      for (const el of optionEls) {
        const shot = await el.screenshot({ type: "png" });
        result.optionImages.push(Buffer.from(shot));
      }
      this.log.info(`Extracted ${result.optionImages.length} choice options`);
    } catch (e) {
      this.log.warn("Multi-choice extraction failed, using full screenshot");
      result.challengeImage = result.fullScreenshot;
    }
  }

  private async screenshotFrame(frame: Frame): Promise<Buffer> {
    // Try to screenshot just the challenge body
    try {
      const body = await frame.$("body");
      if (body) {
        const shot = await body.screenshot({ type: "png" });
        return Buffer.from(shot);
      }
    } catch {}

    // Fallback: full page screenshot
    const page = frame.page();
    const shot = await page.screenshot({ type: "png" });
    return Buffer.from(shot);
  }
}
