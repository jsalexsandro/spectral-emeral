import type { ToolSet } from "ai"
import { RUN_ACTION_TOOL_NAME } from "@/lib/ai/actions/catalog"
import { RENDER_HTML_TOOL_NAME } from "@/lib/ai/ui/html-policy"
import { createDeviceTools } from "./device-tools"
import { fetchUrlTool } from "./fetch-url"
import { createModelTools } from "./model-tools"
import { createProviderTools } from "./provider-tools"
import { renderHtmlTool } from "./render-html"
import { runActionTool } from "./run-action"
import { UPDATE_PLAN_TOOL_NAME, updatePlanTool } from "./update-plan"

type GetChatToolsInput = {
  userId: string
}

export function getChatTools({ userId }: GetChatToolsInput): ToolSet {
  return {
    fetchUrl: fetchUrlTool,
    [RENDER_HTML_TOOL_NAME]: renderHtmlTool,
    [RUN_ACTION_TOOL_NAME]: runActionTool,
    [UPDATE_PLAN_TOOL_NAME]: updatePlanTool,
    ...createProviderTools(userId),
    ...createModelTools(userId),
    ...createDeviceTools(userId),
  }
}
