import type { SolveCaptchaOptions, ProviderType } from "./types";

export const PROVIDER_DEFAULTS: Record<
  string,
  { model: string; classifyModel: string; envKey: string }
> = {
  claude: {
    model: "claude-sonnet-4-5-20250929",
    classifyModel: "claude-haiku-4-5-20251001",
    envKey: "ANTHROPIC_API_KEY",
  },
  gemini: {
    model: "gemini-2.5-flash",
    classifyModel: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
  },
  "claude-code": {
    model: "sonnet",
    classifyModel: "sonnet",
    envKey: "",
  },
};

export const TIMING = {
  checkboxClickDelay: { min: 300, max: 800 },
  cellClickDelay: { min: 100, max: 300 },
  submitDelay: { min: 400, max: 800 },
  challengeWait: 10_000,
  betweenRounds: { min: 500, max: 1500 },
  microDelay: { min: 30, max: 150 },
} as const;

export const SELECTORS = {
  checkboxIframe: 'iframe[src*="hcaptcha.com"][src*="frame=checkbox"]',
  challengeIframe: 'iframe[src*="hcaptcha.com"][src*="frame=challenge"]',
  checkbox: "#checkbox",
  promptText: ".prompt-text",
  taskGrid: ".task-grid",
  taskImage: ".task-image",
  taskAnswers: ".task-answers",
  submitButton: ".button-submit",
  refreshButton: ".refresh-button",
  challengeImage: ".challenge-example .image",
  responseInput: '[name="h-captcha-response"]',
} as const;

export function resolveConfig(opts?: SolveCaptchaOptions) {
  const provider: ProviderType = opts?.provider ?? "gemini";
  const defaults = PROVIDER_DEFAULTS[provider];

  return {
    provider,
    apiKey: opts?.apiKey ?? (defaults.envKey ? process.env[defaults.envKey] : "") ?? "",
    model: opts?.model ?? defaults.model,
    classifyModel: opts?.classifyModel ?? defaults.classifyModel,
    maxRetries: opts?.maxRetries ?? 10,
    timeout: opts?.timeout ?? 300_000,
    verbose: opts?.verbose ?? false,
    onChallenge: opts?.onChallenge,
  };
}
