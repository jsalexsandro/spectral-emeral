import type { PromptSection } from "../types"
import { agentLoopSection } from "./agent-loop"
import { capabilitiesSection } from "./capabilities"
import { devicesSection } from "./devices"
import { identitySection } from "./identity"
import { providersAndModelsSection } from "./providers-and-models"
import { safetySection } from "./safety"
import { styleSection } from "./style"
import { uiAndActionsSection } from "./ui-and-actions"
import { userContextSection } from "./user-context"

export const promptSections: readonly PromptSection[] = [
  identitySection,
  styleSection,
  capabilitiesSection,
  providersAndModelsSection,
  agentLoopSection,
  uiAndActionsSection,
  devicesSection,
  safetySection,
  userContextSection,
]
