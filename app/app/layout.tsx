import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { AppActionsProvider } from "./app-actions-provider"
import { AppSidebar } from "./app-sidebar"
import { ChatNotificationProvider } from "@/components/chat/chat-notification-provider"
import { ChatProvider } from "./chat-provider"
import { AppSessionProvider } from "./session-provider"

export const instant = false

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = {
    name: session.user.name,
    nickname: session.user.nickname,
    email: session.user.email,
    image: session.user.image,
  }

  return (
    <AppSessionProvider session={session}>
      <ChatNotificationProvider>
        <AppActionsProvider user={user}>
          <ChatProvider>
            <div className="flex h-dvh w-full overflow-hidden bg-background">
              <AppSidebar user={user} />
              <main className="flex min-w-0 flex-1 flex-col">{children}</main>
            </div>
          </ChatProvider>
        </AppActionsProvider>
      </ChatNotificationProvider>
    </AppSessionProvider>
  )
}
