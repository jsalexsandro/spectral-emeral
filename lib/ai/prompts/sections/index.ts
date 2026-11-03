import type { PromptSection } from "../types"
import { agentLoopSection } from "./agent-loop"
import { capabilitiesSection } from "./capabilities"
import { devicesSection } from "./devices"
import { identitySection } from "./identity"
import { safetySection } from "./safety"
import { styleSection } from "./style"
import { uiAndActionsSection } from "./ui-and-actions"
import { userContextSection } from "./user-context"

export const promptSections: readonly PromptSection[] = [
  identitySection,
  styleSection,
  capabilitiesSection,
  agentLoopSection,
  uiAndActionsSection,
  devicesSection,
  safetySection,
  userContextSection,
]
