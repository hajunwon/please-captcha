import type { Page, Frame } from "puppeteer";
import { writeFileSync } from "fs";
import sharp from "sharp";
import { resolveConfig, SELECTORS, TIMING } from "./config";
import { ChallengeType } from "./types";
import type { SolveCaptchaOptions } from "./types";
import { createAIClient } from "./ai/ai-client";
import { IframeAccessor } from "./extraction/iframe-accessor";
import { MouseController } from "./interaction/mouse-controller";
import { UniversalSolver } from "./solvers/universal-solver";
import { randomDelay, delay } from "./utils/delay";
import { Logger } from "./utils/logger";

export class CaptchaController {
  private config;
  private log: Logger;
  private solver: UniversalSolver;

  constructor(opts?: SolveCaptchaOptions) {
    this.config = resolveConfig(opts);
    this.log = new Logger(this.config.verbose);
    const ai = createAIClient(this.config.provider, this.config.apiKey);
    this.solver = new UniversalSolver(ai, this.config.model, this.log);
  }

  async solve(page: Page): Promise<boolean> {
    const deadline = Date.now() + this.config.timeout;
    const iframes = new IframeAccessor(page, this.log);
    const mouse = new MouseController(page, this.log);

    this.log.info("Finding checkbox...");
    const checkboxFrame = await iframes.getCheckboxFrame();
    await iframes.clickCheckbox(checkboxFrame);

    this.log.info("Waiting for challenge...");
    const outcome = await iframes.waitForChallengeOrPass();
    if (outcome === "passed") {
      this.log.info("Passive pass!");
      return true;
    }

    for (let round = 0; round < this.config.maxRetries; round++) {
      if (Date.now() > deadline) {
        this.log.error("Timeout");
        return false;
      }

      this.log.info(`--- Round ${round + 1} ---`);
      try {
        const success = await this.solveChallenge(page, iframes, mouse);
        if (success) {
          this.log.info("Captcha solved!");
          return true;
        }
      } catch (err) {
        this.log.error("Round error:", err);
      }

      await randomDelay(TIMING.betweenRounds.min, TIMING.betweenRounds.max);
    }

    this.log.error("Max retries reached");
    return false;
  }

  private async solveChallenge(
    page: Page,
    iframes: IframeAccessor,
    mouse: MouseController,
  ): Promise<boolean> {
    for (let pageNum = 0; pageNum < 5; pageNum++) {
      const { frame, element } = await iframes.getChallengeFrame();
      const iframeRect = await iframes.getIframeRect(element);

      // Wait for content to actually render (not just network idle)
      await this.waitForContentReady(page, iframeRect);

      // Detect unsupported challenge types
      const isSupported = await this.checkChallengeType(frame);
      if (!isSupported) {
        this.log.info("Unsupported challenge, refreshing...");
        await this.clickRefresh(frame, mouse, iframeRect);
        await delay(2000);
        await this.waitForNetworkIdle(page);
        return false;
      }

      const { currentPage, totalPages } = await this.getPagination(frame);
      this.log.info(`Page ${currentPage}/${totalPages}`);

      const promptText = await this.extractPrompt(frame);
      this.log.info("Prompt:", promptText);

      // Screenshot via page clip — does NOT touch iframe
      const screenshotBuf = await this.safeScreenshot(page, iframeRect);

      // Debug: save screenshot
      if (this.config.verbose) {
        const debugPath = `debug-round-p${currentPage}.png`;
        try { writeFileSync(debugPath, screenshotBuf); } catch {}
      }

      const result = await this.solver.solve({
        type: ChallengeType.UNKNOWN,
        promptText,
        fullScreenshot: screenshotBuf,
      });

      this.log.info("Confidence:", result.confidence);

      // Execute clicks
      if (result.dragActions?.length) {
        for (const action of result.dragActions) {
          const pt = action.from;
          const vx = iframeRect.x + pt.x * iframeRect.width;
          const vy = iframeRect.y + pt.y * iframeRect.height;
          this.log.info(`Click (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)}) -> viewport (${vx.toFixed(0)}, ${vy.toFixed(0)})`);
          await mouse.clickAbsolute(vx, vy);
          await randomDelay(TIMING.cellClickDelay.min, TIMING.cellClickDelay.max);
        }
      }

      // Click submit
      await randomDelay(TIMING.submitDelay.min, TIMING.submitDelay.max);
      try {
        await mouse.clickInFrame(frame, iframeRect, SELECTORS.submitButton);
        this.log.info("Clicked submit");
      } catch (err) {
        this.log.warn("Submit click failed:", err);
      }

      // Wait for hCaptcha to process + transition to next state
      // Phase 1: wait for grid to go blank (fade-out)
      // Phase 2: check success
      // Phase 3: if still visible, waitForContentReady handles the rest
      await this.waitForGridBlank(page, iframeRect);
      // Mandatory cooldown after blank — hCaptcha animates the transition
      await delay(1500);

      if (await this.checkSuccess(page)) return true;

      const stillVisible = await this.isChallengeVisible(page);
      if (!stillVisible) return false;
    }

    return false;
  }

  private async safeScreenshot(
    page: Page,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<Buffer> {
    const shot = await page.screenshot({
      type: "png",
      clip: {
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
    return Buffer.from(shot);
  }

  private async checkChallengeType(frame: Frame): Promise<boolean> {
    try {
      const hasVideo = await frame.$("video, [class*=video]");
      if (hasVideo) {
        this.log.warn("Video challenge — unsupported");
        return false;
      }
      const hasDraggable = await frame.$('[draggable="true"], [class*=drag]');
      if (hasDraggable) {
        this.log.warn("Drag-drop challenge — unsupported");
        return false;
      }
    } catch {}
    return true;
  }

  private async clickRefresh(
    frame: Frame,
    mouse: MouseController,
    iframeRect: { x: number; y: number; width: number; height: number },
  ): Promise<void> {
    try {
      await mouse.clickInFrame(frame, iframeRect, SELECTORS.refreshButton);
      this.log.info("Clicked refresh");
    } catch {
      this.log.warn("Refresh click failed");
    }
  }

  /**
   * Wait until the challenge content is actually rendered (not just network idle).
   * Takes rapid screenshots and checks if the middle area has non-white pixels.
   */
  /**
   * Wait until the grid area has actual image content (not blank white).
   * Uses sharp to check pixel color variance in the center of the grid area.
   */
  /**
   * After submit, wait for the grid area to go blank (hCaptcha fade-out),
   * indicating the transition has started.
   */
  private async waitForGridBlank(
    page: Page,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<void> {
    const gridClip = {
      x: Math.round(rect.x + rect.width * 0.15),
      y: Math.round(rect.y + rect.height * 0.35),
      width: Math.round(rect.width * 0.7),
      height: Math.round(rect.height * 0.4),
    };

    const start = Date.now();
    // Wait until grid goes blank OR 4 seconds (success may skip animation)
    for (let i = 0; i < 20; i++) {
      const shot = await page.screenshot({ type: "png", clip: gridClip });
      try {
        const { channels } = await sharp(Buffer.from(shot)).stats();
        const isBlank = channels.every((ch) => ch.stdev < 10);
        if (isBlank) {
          this.log.info(`Grid blank after ${Date.now() - start}ms`);
          return;
        }
      } catch {}
      await delay(200);
    }
    this.log.info(`Grid blank wait timeout ${Date.now() - start}ms`);
  }

  private async waitForContentReady(
    page: Page,
    rect: { x: number; y: number; width: number; height: number },
  ): Promise<void> {
    const start = Date.now();
    // Grid area: roughly 35%-75% height, 15%-85% width of the challenge
    const gridClip = {
      x: Math.round(rect.x + rect.width * 0.15),
      y: Math.round(rect.y + rect.height * 0.35),
      width: Math.round(rect.width * 0.7),
      height: Math.round(rect.height * 0.4),
    };

    for (let i = 0; i < 30; i++) {
      const shot = await page.screenshot({ type: "png", clip: gridClip });
      const buf = Buffer.from(shot);

      // Use sharp to get pixel stats — check if there's actual color variance
      try {
        const { channels } = await sharp(buf).stats();
        // If any channel has stdev > 15, there's real content (not solid white)
        const hasContent = channels.some((ch) => ch.stdev > 15);
        if (hasContent) {
          this.log.info(`Content ready after ${Date.now() - start}ms`);
          return;
        }
      } catch {}

      await delay(200);
    }
    this.log.warn(`Content wait timeout after ${Date.now() - start}ms — proceeding anyway`);
  }

  private async waitForNetworkIdle(page: Page): Promise<void> {
    const start = Date.now();
    let pending = 0;
    let lastActivity = Date.now();

    const onReq = () => { pending++; lastActivity = Date.now(); };
    const onRes = () => { pending = Math.max(0, pending - 1); lastActivity = Date.now(); };

    page.on("request", onReq);
    page.on("response", onRes);
    page.on("requestfailed", onRes);

    try {
      while (Date.now() - start < 8000) {
        if (pending === 0 && Date.now() - lastActivity > 500) {
          this.log.info(`Network idle ${Date.now() - start}ms`);
          return;
        }
        await delay(50);
      }
      this.log.warn("Network idle timeout");
    } finally {
      page.off("request", onReq);
      page.off("response", onRes);
      page.off("requestfailed", onRes);
    }
  }

  private async getPagination(frame: Frame): Promise<{ currentPage: number; totalPages: number }> {
    try {
      const info = await frame.$eval(SELECTORS.submitButton, (el) => {
        const aria = el.getAttribute("aria-label") || "";
        return aria;
      });
      const match = info.match(/(\d+)\s*페이지\s*중\s*(\d+)/);
      if (match) return { totalPages: parseInt(match[1]), currentPage: parseInt(match[2]) };
      const matchEn = info.match(/page\s*(\d+)\s*of\s*(\d+)/i);
      if (matchEn) return { currentPage: parseInt(matchEn[1]), totalPages: parseInt(matchEn[2]) };
    } catch {}
    return { currentPage: 1, totalPages: 1 };
  }

  private async extractPrompt(frame: Frame): Promise<string> {
    for (const sel of [SELECTORS.promptText, "h2", ".challenge-header", "[class*=prompt]"]) {
      try {
        const text = await frame.$eval(sel, (el) => el.textContent?.trim() ?? "");
        if (text.length > 3) return text;
      } catch {}
    }
    return "unknown task";
  }

  private async checkSuccess(page: Page): Promise<boolean> {
    try {
      const token = await page.$eval(
        SELECTORS.responseInput,
        (el) => (el as HTMLInputElement).value,
      );
      if (token && token.length > 10) return true;
    } catch {}
    return false;
  }

  private async isChallengeVisible(page: Page): Promise<boolean> {
    try {
      const el = await page.$(SELECTORS.challengeIframe);
      if (!el) return false;
      return await el.isIntersectingViewport();
    } catch {
      return false;
    }
  }
}
