import type { ChatUiNode, ChatUiProps } from "@/lib/ai/ui/catalog"
import { cn } from "@/lib/utils"

function renderNode(node: ChatUiNode, index: number): React.ReactNode {
  switch (node.type) {
    case "text": {
      const Component =
        node.variant === "h1"
          ? "h1"
          : node.variant === "h2"
            ? "h2"
            : node.variant === "span"
              ? "span"
              : "p"

      const variantClasses =
        node.variant === "h1"
          ? "text-lg font-semibold tracking-tight text-foreground"
          : node.variant === "h2"
            ? "text-base font-semibold text-foreground"
            : node.variant === "muted"
              ? "text-xs text-muted-foreground"
              : node.variant === "caption"
                ? "text-[11px] text-muted-foreground uppercase tracking-wider"
                : node.variant === "span"
                  ? "text-sm text-foreground"
                  : "text-sm text-foreground"

      const weightClasses =
        node.weight === "bold"
          ? "font-bold"
          : node.weight === "semibold"
            ? "font-semibold"
            : node.weight === "medium"
              ? "font-medium"
              : "font-normal"

      return (
        <Component
          key={`text-${index}`}
          className={cn(variantClasses, weightClasses)}
        >
          {node.value}
        </Component>
      )
    }
    case "button": {
      const variantClasses =
        node.variant === "outline"
          ? "border border-border bg-background hover:bg-muted text-foreground"
          : node.variant === "secondary"
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            : node.variant === "ghost"
              ? "hover:bg-muted text-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/80"

      return (
        <button
          key={`button-${index}`}
          type="button"
          onClick={() => {
            if (node.action) {
              console.info("ChatUI.Api Action clicked:", node.action)
            }
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
            variantClasses,
          )}
        >
          {node.label}
        </button>
      )
    }
    case "div": {
      return (
        <div
          key={`div-${index}`}
          className={cn("flex flex-col gap-2.5", node.className)}
        >
          {node.children.map((child, childIndex) =>
            renderNode(child as ChatUiNode, childIndex),
          )}
        </div>
      )
    }
    default:
      return null
  }
}

export function ChatUi({ title, children }: ChatUiProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-soft">
      {title && (
        <div className="mb-3 border-b border-border/60 pb-2.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {children.map((node, index) => renderNode(node, index))}
      </div>
    </div>
  )
}
