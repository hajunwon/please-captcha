import type { Page, Frame, ElementHandle } from "puppeteer";
import { SELECTORS, TIMING } from "../config";
import { randomDelay } from "../utils/delay";
import type { IframeHandles, Rect } from "../types";
import type { Logger } from "../utils/logger";

export class IframeAccessor {
  constructor(
    private page: Page,
    private log: Logger,
  ) {}

  async getCheckboxFrame(): Promise<Frame> {
    const el = await this.page.waitForSelector(SELECTORS.checkboxIframe, {
      timeout: TIMING.challengeWait,
    });
    if (!el) throw new Error("Checkbox iframe not found");
    const frame = await el.contentFrame();
    if (!frame) throw new Error("Cannot access checkbox iframe content");
    return frame;
  }

  async clickCheckbox(frame: Frame): Promise<void> {
    await frame.waitForSelector(SELECTORS.checkbox, { visible: true });
    await randomDelay(TIMING.checkboxClickDelay.min, TIMING.checkboxClickDelay.max);
    await frame.click(SELECTORS.checkbox);
    this.log.info("Clicked checkbox");
  }

  async waitForChallengeOrPass(): Promise<"challenge" | "passed"> {
    const result = await Promise.race([
      this.page
        .waitForSelector(SELECTORS.challengeIframe, {
          visible: true,
          timeout: TIMING.challengeWait,
        })
        .then(() => "challenge" as const),
      this.pollForToken().then(() => "passed" as const),
    ]);
    return result;
  }

  async getChallengeFrame(): Promise<{ frame: Frame; element: ElementHandle }> {
    const el = await this.page.waitForSelector(SELECTORS.challengeIframe, {
      visible: true,
      timeout: TIMING.challengeWait,
    });
    if (!el) throw new Error("Challenge iframe not found");
    const frame = await el.contentFrame();
    if (!frame) throw new Error("Cannot access challenge iframe content");
    return { frame, element: el };
  }

  async getIframeRect(element: ElementHandle): Promise<Rect> {
    const box = await element.boundingBox();
    if (!box) throw new Error("Cannot get iframe bounding box");
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  private async pollForToken(): Promise<string> {
    const maxWait = TIMING.challengeWait;
    const interval = 200;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      try {
        const token = await this.page.$eval(
          SELECTORS.responseInput,
          (el) => (el as HTMLInputElement).value,
        );
        if (token && token.length > 0) return token;
      } catch {}
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error("Token poll timeout");
  }
}
