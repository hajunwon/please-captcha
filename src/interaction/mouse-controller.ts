import type { Page, Frame, ElementHandle } from "puppeteer";
import { createCursor, GhostCursor } from "ghost-cursor";
import type { Rect, Point } from "../types";
import { randomDelay, randomInt } from "../utils/delay";
import { TIMING } from "../config";
import type { Logger } from "../utils/logger";

export class MouseController {
  private cursor: GhostCursor;

  constructor(
    private page: Page,
    private log: Logger,
  ) {
    this.cursor = createCursor(page);
  }

  async clickInFrame(
    frame: Frame,
    iframeRect: Rect,
    selector: string,
    opts?: { jitter?: number },
  ): Promise<void> {
    const elRect = await frame.$eval(selector, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

    const jitter = opts?.jitter ?? 0.3;
    const targetX =
      iframeRect.x +
      elRect.x +
      elRect.width * (0.5 + (Math.random() - 0.5) * jitter);
    const targetY =
      iframeRect.y +
      elRect.y +
      elRect.height * (0.5 + (Math.random() - 0.5) * jitter);

    await randomDelay(TIMING.microDelay.min, TIMING.microDelay.max);
    await this.cursor.moveTo({ x: targetX, y: targetY });
    await randomDelay(30, 100);
    await this.cursor.click();
  }

  async clickAtRelative(
    iframeRect: Rect,
    elementRect: Rect,
    relPoint: Point,
  ): Promise<void> {
    const x = iframeRect.x + elementRect.x + elementRect.width * relPoint.x;
    const y = iframeRect.y + elementRect.y + elementRect.height * relPoint.y;

    await randomDelay(TIMING.microDelay.min, TIMING.microDelay.max);
    await this.cursor.moveTo({ x, y });
    await randomDelay(30, 80);
    await this.cursor.click();
  }

  async clickGridCell(
    frame: Frame,
    iframeRect: Rect,
    cellIndex: number,
  ): Promise<void> {
    const selector = `.task-image:nth-child(${cellIndex + 1})`;
    try {
      await this.clickInFrame(frame, iframeRect, selector);
    } catch {
      // Fallback: try alternative selector
      const altSelector = `.task-image`;
      const cells = await frame.$$(altSelector);
      if (cells[cellIndex]) {
        const box = await cells[cellIndex].boundingBox();
        if (box) {
          const x =
            iframeRect.x +
            box.x +
            box.width * (0.3 + Math.random() * 0.4);
          const y =
            iframeRect.y +
            box.y +
            box.height * (0.3 + Math.random() * 0.4);
          await this.cursor.moveTo({ x, y });
          await randomDelay(30, 80);
          await this.cursor.click();
        }
      }
    }
  }

  async clickMultiChoiceOption(
    frame: Frame,
    iframeRect: Rect,
    optionIndex: number,
  ): Promise<void> {
    const selector = `.task-answers .task-answer:nth-child(${optionIndex + 1})`;
    try {
      await this.clickInFrame(frame, iframeRect, selector);
    } catch {
      const opts = await frame.$$(".task-answer");
      if (opts[optionIndex]) {
        const box = await opts[optionIndex].boundingBox();
        if (box) {
          const x = iframeRect.x + box.x + box.width * (0.3 + Math.random() * 0.4);
          const y = iframeRect.y + box.y + box.height * (0.3 + Math.random() * 0.4);
          await this.cursor.moveTo({ x, y });
          await randomDelay(30, 80);
          await this.cursor.click();
        }
      }
    }
  }

  async drag(
    iframeRect: Rect,
    elementRect: Rect,
    from: Point,
    to: Point,
  ): Promise<void> {
    const fromX = iframeRect.x + elementRect.x + elementRect.width * from.x;
    const fromY = iframeRect.y + elementRect.y + elementRect.height * from.y;
    const toX = iframeRect.x + elementRect.x + elementRect.width * to.x;
    const toY = iframeRect.y + elementRect.y + elementRect.height * to.y;

    await this.cursor.moveTo({ x: fromX, y: fromY });
    await randomDelay(80, 200);
    await this.page.mouse.down();
    await randomDelay(50, 150);

    // Move in steps for realism
    const steps = randomInt(8, 15);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Bezier-ish curve with slight overshoot
      const progress = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cx = fromX + (toX - fromX) * progress + (Math.random() - 0.5) * 3;
      const cy = fromY + (toY - fromY) * progress + (Math.random() - 0.5) * 3;
      await this.page.mouse.move(cx, cy);
      await randomDelay(15, 40);
    }

    await this.page.mouse.move(toX, toY);
    await randomDelay(50, 150);
    await this.page.mouse.up();
  }

  async clickAbsolute(x: number, y: number): Promise<void> {
    // Add small random jitter for human-likeness
    const jitterX = (Math.random() - 0.5) * 6;
    const jitterY = (Math.random() - 0.5) * 6;
    await randomDelay(TIMING.microDelay.min, TIMING.microDelay.max);
    await this.cursor.moveTo({ x: x + jitterX, y: y + jitterY });
    await randomDelay(30, 80);
    await this.cursor.click();
  }

  async getElementRect(
    frame: Frame,
    selector: string,
  ): Promise<Rect | null> {
    try {
      return await frame.$eval(selector, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    } catch {
      return null;
    }
  }
}
