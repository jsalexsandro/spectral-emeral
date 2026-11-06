"use client"

import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { useCallback, useState } from "react"

export function ChatMessageToolbarItem({
  icon,
  activeIcon,
  text,
  onClick,
}: {
  icon: React.ElementType
  activeIcon?: React.ElementType
  text: string
  onClick: () => void
}) {
  const [active, setActive] = useState(false)

  const handleClick = useCallback(() => {
    onClick()
    setActive(true)
    setTimeout(() => setActive(false), 2000)
  }, [onClick])

  const Icon = icon
  const ActiveIcon = activeIcon

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={handleClick}
      aria-label={text}
      disabled={active}
    >
      {active && ActiveIcon ? (
        <ActiveIcon className="size-4" />
      ) : (
        <Icon className="size-4" />
      )}
    </Button>
  )
}

export function ChatMessageToolbar({
  text,
  items,
}: {
  text: string
  items?: Array<{
    icon: React.ElementType
    activeIcon?: React.ElementType
    text: string
    onClick: () => void
  }>
}) {
  return (
    <div className="flex justify-end gap-1 pt-1">
      {items?.map((item, index) => (
        <ChatMessageToolbarItem
          key={index}
          icon={item.icon}
          activeIcon={item.activeIcon}
          text={item.text}
          onClick={item.onClick}
        />
      ))}
      <ChatMessageToolbarItem
        icon={Copy}
        activeIcon={Check}
        text="Copiar"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
          } catch {
            // clipboard não disponível ou negado
          }
        }}
      />
    </div>
  )
}
