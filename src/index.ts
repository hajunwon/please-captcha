import type { Page } from "puppeteer";
import { CaptchaController } from "./captcha-controller";
import type { SolveCaptchaOptions } from "./types";

export async function solveCaptcha(
  page: Page,
  options?: SolveCaptchaOptions,
): Promise<boolean> {
  const controller = new CaptchaController(options);
  return controller.solve(page);
}

export { CaptchaController };
export { ChallengeType } from "./types";
export type {
  SolveCaptchaOptions,
  ChallengeData,
  SolveResult,
  Point,
  DragAction,
  ProviderType,
} from "./types";
