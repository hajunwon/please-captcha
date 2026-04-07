import type { Page, Frame, ElementHandle } from "puppeteer";

export enum ChallengeType {
  GRID_SELECT = "grid_select",
  MULTI_CHOICE = "multi_choice",
  AREA_SELECT_POINT = "area_select_point",
  AREA_SELECT_BBOX = "area_select_bbox",
  DRAG_DROP = "drag_drop",
  PUZZLE = "puzzle",
  UNKNOWN = "unknown",
}

export interface ChallengeData {
  type: ChallengeType;
  promptText: string;
  fullScreenshot: Buffer;
  gridCells?: Buffer[];
  gridDimensions?: { rows: number; cols: number };
  referenceImage?: Buffer;
  optionImages?: Buffer[];
  challengeImage?: Buffer;
}

export interface SolveResult {
  type: ChallengeType;
  selectedIndices?: number[];
  selectedOption?: number;
  clickPoint?: Point;
  boundingBox?: { x1: number; y1: number; x2: number; y2: number };
  dragActions?: DragAction[];
  confidence: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DragAction {
  from: Point;
  to: Point;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ProviderType = "claude" | "gemini" | "claude-code";

export interface SolveCaptchaOptions {
  provider?: ProviderType;
  apiKey?: string;
  model?: string;
  classifyModel?: string;
  maxRetries?: number;
  timeout?: number;
  onChallenge?: (data: ChallengeData) => void;
  verbose?: boolean;
}

export interface IframeHandles {
  checkboxFrame: Frame;
  challengeFrame: Frame;
  challengeElement: ElementHandle;
}
