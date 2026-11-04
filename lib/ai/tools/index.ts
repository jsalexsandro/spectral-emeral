import type { ToolSet } from "ai"
import { RUN_ACTION_TOOL_NAME } from "@/lib/ai/actions/catalog"
import { RENDER_UI_TOOL_NAME } from "@/lib/ai/ui/catalog"
import { createDeviceTools } from "./device-tools"
import { fetchUrlTool } from "./fetch-url"
import { createModelTools } from "./model-tools"
import { createProviderTools } from "./provider-tools"
import { renderUiTool } from "./render-ui"
import { runActionTool } from "./run-action"
import { UPDATE_PLAN_TOOL_NAME, updatePlanTool } from "./update-plan"

type GetChatToolsInput = {
  userId: string
}

export function getChatTools({ userId }: GetChatToolsInput): ToolSet {
  return {
    fetchUrl: fetchUrlTool,
    [RENDER_UI_TOOL_NAME]: renderUiTool,
    [RUN_ACTION_TOOL_NAME]: runActionTool,
    [UPDATE_PLAN_TOOL_NAME]: updatePlanTool,
    ...createProviderTools(userId),
    ...createModelTools(userId),
    ...createDeviceTools(userId),
  }
}
