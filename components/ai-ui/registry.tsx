import type { ReactNode } from "react"
import type { RenderUiInput, UiComponentName } from "@/lib/ai/ui/catalog"
import { Callout } from "./callout"
import { ChatUi } from "./chat-ui"
import { DataTable } from "./data-table"
import { InfoCard } from "./info-card"
import { SourceList } from "./source-list"
import { StatGrid } from "./stat-grid"
import { Timeline } from "./timeline"

export const aiUiRegistry = {
  callout: Callout,
  infoCard: InfoCard,
  statGrid: StatGrid,
  dataTable: DataTable,
  timeline: Timeline,
  sourceList: SourceList,
  chatUi: ChatUi,
} as const satisfies Record<UiComponentName, unknown>

export function renderAiUiComponent(input: RenderUiInput): ReactNode {
  switch (input.component) {
    case "callout":
      return <Callout {...input.props} />
    case "infoCard":
      return <InfoCard {...input.props} />
    case "statGrid":
      return <StatGrid {...input.props} />
    case "dataTable":
      return <DataTable {...input.props} />
    case "timeline":
      return <Timeline {...input.props} />
    case "sourceList":
      return <SourceList {...input.props} />
    case "chatUi":
      return <ChatUi {...input.props} />
    default: {
      const exhaustive: never = input
      return exhaustive
    }
  }
}
