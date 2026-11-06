"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, Copy, MoreHorizontal } from "lucide-react"
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
      className="size-6"
    >
      {active && ActiveIcon ? (
        <ActiveIcon className="size-3.5" />
      ) : (
        <Icon className="size-3.5" />
      )}
    </Button>
  )
}

export function ChatMessageToolbar({
  text,
  timestamp,
  items,
}: {
  text: string
  timestamp?: string | Date
  items?: Array<{
    icon: React.ElementType
    activeIcon?: React.ElementType
    text: string
    onClick: () => void
  }>
}) {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    : null

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
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button size="icon" variant="outline" aria-label="Mais opções" className="size-6">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuItem className="text-xs">
            {formattedDate && formattedTime ? (
              <>
                {formattedDate} às {formattedTime}
              </>
            ) : (
              "Sem data"
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
