"use client"

import { useState } from "react"
import { Ellipsis, Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useChatSession, type ChatSummary } from "./chat-provider"
import { useRouter } from "next/navigation"

type MyChatsProps = {
  collapsed?: boolean
}

export function MyChats({ collapsed = false }: MyChatsProps) {
  const {
    chatId,
    isDraft,
    chats,
    chatsLoading,
    chatsError,
    deleteChat,
    renameChat,
  } = useChatSession()
  const [pendingDelete, setPendingDelete] = useState<ChatSummary | null>(null)
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const router = useRouter()

  if (collapsed) {
    return (
      <div className="mt-3 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto border-t border-border pt-3">
        {chats.slice(0, 12).map((chat) => (
          <Tooltip key={chat.id}>
            <TooltipTrigger
              type="button"
              onClick={() => router.push(`/chat/${chat.id}`)}
              aria-current={!isDraft && chatId === chat.id ? "page" : undefined}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                !isDraft && chatId === chat.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <MessageSquare className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="right">{chat.title}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
        Chats
      </p>

      {chatsLoading && chats.length === 0 ? (
        <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Carregando...
        </p>
      ) : chatsError && chats.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Não foi possível carregar os chats.
        </p>
      ) : chats.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Nenhum chat ainda.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {chats.map((chat) => {
            const active = !isDraft && chatId === chat.id
            const isRenaming = renamingChatId === chat.id

            return (
              <li
                key={chat.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {isRenaming ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const value = renameValue.trim()
                      if (value && value !== chat.title) {
                        void renameChat(chat.id, value)
                      }
                      setRenamingChatId(null)
                      setRenameValue("")
                    }}
                    className="flex w-full items-center gap-1 px-2 py-1.5"
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        const value = renameValue.trim()
                        if (value && value !== chat.title) {
                          void renameChat(chat.id, value)
                        }
                        setRenamingChatId(null)
                        setRenameValue("")
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault()
                          setRenamingChatId(null)
                          setRenameValue("")
                        }
                      }}
                      className="min-w-0 flex-1 rounded-md bg-background px-2 py-1 text-sm font-medium ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={chat.title}
                      aria-label="Novo nome do chat"
                    />
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push(`/chat/${chat.id}`)}
                      aria-current={active ? "page" : undefined}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <MessageSquare className="size-3.5 shrink-0" />
                      <span className="truncate">{chat.title}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Opções de ${chat.title}`}
                        className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring hover:bg-accent hover:text-accent-foreground data-popup-open:opacity-100"
                      >
                        <Ellipsis className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameValue(chat.title)
                            setRenamingChatId(chat.id)
                          }}
                        >
                          <Pencil />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setPendingDelete(chat)}
                        >
                          <Trash2 />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chat?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa “{pendingDelete?.title}” e todas as mensagens serão
              removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const chat = pendingDelete
                setPendingDelete(null)

                if (chat) {
                  void deleteChat(chat.id)
                  if (!isDraft && chatId === chat.id) {
                    router.push("/app")
                  }
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
