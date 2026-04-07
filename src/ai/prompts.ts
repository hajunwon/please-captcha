import { ChallengeType } from "../types";

interface PromptTemplate {
  system: string;
  user: (promptText: string, meta?: Record<string, unknown>) => string;
}

const GRID_SELECT: PromptTemplate = {
  system: `You are an expert image classifier solving a visual CAPTCHA challenge. You will see images from a grid. Your task is to identify which images match the given description.

Rules:
- Be thorough: select ALL matching images, including borderline cases
- It's better to over-select slightly than to miss a match
- Return ONLY a JSON array of 0-based indices
- No explanation, just the JSON array`,

  user: (promptText, meta) => {
    const count = (meta?.cellCount as number) ?? 9;
    return `Task: "${promptText}"

There are ${count} images numbered 0 through ${count - 1}, provided in order. Which images match the task description?

Return a JSON array of matching indices, e.g. [0, 3, 5]`;
  },
};

const MULTI_CHOICE: PromptTemplate = {
  system: `You are solving a visual multiple-choice CAPTCHA. You will see a reference image followed by option images. Pick the single best matching option.

Rules:
- The first image is the reference/question image
- Following images are the options, numbered starting from 0
- Return ONLY the option number (single integer)
- No explanation`,

  user: (promptText, meta) => {
    const count = (meta?.optionCount as number) ?? 3;
    return `Task: "${promptText}"

The first image is the reference. The following ${count} images are options numbered 0 to ${count - 1}.

Which option number is correct? Return only the number.`;
  },
};

const AREA_SELECT_POINT: PromptTemplate = {
  system: `You are identifying a specific point in an image for a CAPTCHA challenge. Return precise coordinates as fractions of image dimensions (0.0 to 1.0).

Rules:
- x is horizontal (0=left, 1=right), y is vertical (0=top, 1=bottom)
- Be as precise as possible
- Return ONLY JSON: {"x": 0.XX, "y": 0.YY}`,

  user: (promptText) =>
    `Task: "${promptText}"

Click on the exact point described. Return coordinates as JSON: {"x": 0.XX, "y": 0.YY}`,
};

const AREA_SELECT_BBOX: PromptTemplate = {
  system: `You are drawing a bounding box around an object in an image for a CAPTCHA challenge. Return two corner coordinates as fractions of image dimensions (0.0 to 1.0).

Rules:
- Coordinates are fractions: x (0=left, 1=right), y (0=top, 1=bottom)
- x1,y1 is top-left corner, x2,y2 is bottom-right corner
- Make the box tight around the target object
- Return ONLY JSON: {"x1": 0.XX, "y1": 0.YY, "x2": 0.XX, "y2": 0.YY}`,

  user: (promptText) =>
    `Task: "${promptText}"

Draw a tight bounding box around the described object. Return as JSON: {"x1": ..., "y1": ..., "x2": ..., "y2": ...}`,
};

const DRAG_DROP: PromptTemplate = {
  system: `You are solving a drag-and-drop CAPTCHA puzzle. Identify which elements need to be dragged and where they should go. Return coordinates as fractions of image dimensions (0.0 to 1.0).

Rules:
- Carefully identify the draggable elements and their target positions
- x is horizontal (0=left, 1=right), y is vertical (0=top, 1=bottom)
- Return ONLY a JSON array of drag actions: [{"from": {"x": ..., "y": ...}, "to": {"x": ..., "y": ...}}, ...]`,

  user: (promptText) =>
    `Task: "${promptText}"

Identify each draggable element and its target. Return as JSON array:
[{"from": {"x": 0.XX, "y": 0.YY}, "to": {"x": 0.XX, "y": 0.YY}}, ...]`,
};

const PUZZLE: PromptTemplate = {
  system: `You are solving a visual logic/shape puzzle in a CAPTCHA. Analyze the image carefully, reason about the pattern, and determine the correct action.

Rules:
- First briefly reason about what you see (1-2 sentences max)
- Then provide the answer
- If it requires clicking: return {"action": "click", "x": 0.XX, "y": 0.YY}
- If it requires selecting from options: return {"action": "select", "index": N}
- If it requires dragging: return {"action": "drag", "from": {"x": ..., "y": ...}, "to": {"x": ..., "y": ...}}`,

  user: (promptText) =>
    `Task: "${promptText}"

Analyze this puzzle and determine the correct action. Return as JSON.`,
};

const CLASSIFY: PromptTemplate = {
  system: `You classify hCaptcha challenge types from screenshots. Return ONLY one of these exact strings:
grid_select, multi_choice, area_select_point, area_select_bbox, drag_drop, puzzle`,

  user: () =>
    `What type of hCaptcha challenge is shown in this screenshot? Return ONLY the type name.`,
};

export const PROMPTS: Record<string, PromptTemplate> = {
  [ChallengeType.GRID_SELECT]: GRID_SELECT,
  [ChallengeType.MULTI_CHOICE]: MULTI_CHOICE,
  [ChallengeType.AREA_SELECT_POINT]: AREA_SELECT_POINT,
  [ChallengeType.AREA_SELECT_BBOX]: AREA_SELECT_BBOX,
  [ChallengeType.DRAG_DROP]: DRAG_DROP,
  [ChallengeType.PUZZLE]: PUZZLE,
  classify: CLASSIFY,
};
