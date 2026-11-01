import type { ToolSet } from "ai"
import { RENDER_UI_TOOL_NAME } from "@/lib/ai/ui/catalog"
import { EXTERN_UI_TOOL_NAME } from "@/lib/ai/ui/extern-catalog"
import { externUiTool } from "./extern-ui"
import { fetchUrlTool } from "./fetch-url"
import { renderUiTool } from "./render-ui"
import { UPDATE_PLAN_TOOL_NAME, updatePlanTool } from "./update-plan"

export function getChatTools(): ToolSet {
  return {
    fetchUrl: fetchUrlTool,
    [RENDER_UI_TOOL_NAME]: renderUiTool,
    [EXTERN_UI_TOOL_NAME]: externUiTool,
    [UPDATE_PLAN_TOOL_NAME]: updatePlanTool,
  }
}
