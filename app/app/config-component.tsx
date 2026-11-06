"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  Check,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  MonitorSmartphone,
  Moon,
  Settings,
  SlidersHorizontal,
  Sun,
  Trash2,
  User,
} from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTheme, type Theme } from "@/components/theme-provider"
import type { ConfigSection } from "@/lib/config-sections"
import { cn } from "@/lib/utils"
import { ByokSection } from "./byok-section"
import { DevicesSection } from "./devices-section"
import { ChatNotificationToggle } from "@/components/ui/chat-notification"

export type ConfigUser = {
  name?: string | null
  nickname?: string | null
  email?: string | null
  image?: string | null
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

type ConfigComponentProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: ConfigSection
  onSectionChange: (section: ConfigSection) => void
  user: ConfigUser
}

const sections: {
  id: ConfigSection
  label: string
  icon: typeof Settings
}[] = [
  { id: "general", label: "Geral", icon: Settings },
  { id: "account", label: "Conta", icon: User },
  { id: "byok", label: "BYOK", icon: KeyRound },
  { id: "devices", label: "Dispositivos", icon: MonitorSmartphone },
]

const navItemClassName =
  "flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring"

const themeOptions: {
  value: Theme
  label: string
  icon: typeof Sun
}[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
]

function getInitials(user: ConfigUser) {
  const source = user.name?.trim() || user.email?.trim() || "?"
  const parts = source.split(/[\s@._-]+/).filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function ConfigComponent({
  open,
  onOpenChange,
  section,
  onSectionChange,
  user,
}: ConfigComponentProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        padded={false}
        className="h-[min(640px,calc(100dvh-2rem))] max-w-3xl"
      >
        <DialogTitle className="sr-only">Configurações</DialogTitle>
        <DialogDescription className="sr-only">
          Aparência, conta, provedores de IA e dispositivos.
        </DialogDescription>

        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[200px_minmax(0,1fr)] sm:grid-rows-1">
          <aside className="min-h-0 overflow-y-auto border-b border-border bg-muted/40 p-4 sm:border-r sm:border-b-0">
            <p className="mb-3 px-2 font-heading text-sm font-semibold">
              Configurações
            </p>
            <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSectionChange(id)}
                  aria-current={section === id ? "page" : undefined}
                  className={cn(
                    navItemClassName,
                    section === id
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
              <Link
                href="/providers/select-model"
                className={cn(
                  navItemClassName,
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <SlidersHorizontal className="size-4 shrink-0" />
                <span className="truncate">Modelos rápidos</span>
              </Link>
            </nav>
          </aside>

          <section className="min-h-0 min-w-0 overflow-y-auto p-6">
            {section === "general" && <GeneralSection />}
            {section === "account" && <AccountSection user={user} />}
            {section === "byok" && <ByokSection />}
            {section === "devices" && <DevicesSection />}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h3 className="font-heading text-base font-semibold">Aparência</h3>
        <p className="text-sm text-muted-foreground">
          Escolha como o Spectral deve aparecer.
        </p>
      </header>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Tema</p>
          <p className="text-xs text-muted-foreground">
            O modo sistema acompanha a preferência do seu dispositivo.
          </p>
        </div>

        <div
          role="group"
          aria-label="Tema"
          className="flex shrink-0 overflow-hidden rounded-lg border border-border"
        >
          {themeOptions.map(({ value, label, icon: Icon }, index) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex size-8 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                index > 0 && "border-l border-border",
                theme === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      <ChatNotificationToggle />
    </div>
  )
}

function useAutoSave(initialValue: string, field: "name" | "nickname") {
  const router = useRouter()
  const { update } = useSession()
  const [value, setValue] = useState(initialValue)
  const [status, setStatus] = useState<SaveStatus>("idle")
  const savedValue = useRef(initialValue)

  useEffect(() => {
    const trimmed = value.trim()

    if (trimmed === savedValue.current.trim()) {
      return
    }

    if (field === "name" && trimmed.length < 2) {
      return
    }

    const controller = new AbortController()
    setStatus("saving")

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch("/api/user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: trimmed }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Falha ao salvar")
        }

        savedValue.current = trimmed

        await update(
          field === "name"
            ? { user: { name: trimmed } }
            : { user: { nickname: trimmed || null } },
        )
        router.refresh()
        setStatus("saved")
      } catch {
        if (!controller.signal.aborted) {
          setStatus("error")
        }
      }
    }, 600)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [value, field, update, router])

  return { value, setValue, status }
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") {
    return null
  }

  if (status === "saving") {
    return (
      <p
        role="status"
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Loader2 className="size-3 animate-spin" />
        Salvando...
      </p>
    )
  }

  if (status === "saved") {
    return (
      <p role="status" className="flex items-center gap-1 text-xs text-primary">
        <Check className="size-3" />
        Salvo
      </p>
    )
  }

  return (
    <p role="alert" className="text-xs text-destructive">
      Não foi possível salvar. Tente novamente.
    </p>
  )
}

function AccountSection({ user }: { user: ConfigUser }) {
  const name = useAutoSave(user.name ?? "", "name")
  const nickname = useAutoSave(user.nickname ?? "", "nickname")
  const [signOutOpen, setSignOutOpen] = useState(false)

  const displayName = name.value.trim() || user.email || "Usuário"

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h3 className="font-heading text-base font-semibold">Conta</h3>
        <p className="text-sm text-muted-foreground">
          Informações da sua conta.
        </p>
      </header>

      <div className="flex items-center gap-3 rounded-xl border border-border p-4">
        <Avatar className="size-12 shrink-0">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback>
            {getInitials({ name: name.value, email: user.email })}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {user.email && (
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="account-name">Seu nome</Label>
          <Input
            id="account-name"
            value={name.value}
            onChange={(event) => name.setValue(event.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            maxLength={80}
            className="h-10"
          />
          <SaveIndicator status={name.status} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-nickname">Seu apelido</Label>
          <Input
            id="account-nickname"
            value={nickname.value}
            onChange={(event) => nickname.setValue(event.target.value)}
            placeholder="Como quer ser chamado"
            autoComplete="nickname"
            maxLength={40}
            className="h-10"
          />
          <SaveIndicator status={nickname.status} />
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <div className="space-y-1">
          <h4 className="font-heading text-sm font-semibold">Sua conta</h4>
          <p className="text-xs text-muted-foreground">
            Gerencie o acesso à sua conta.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSignOutOpen(true)}
          >
            <LogOut />
            Desconectar
          </Button>
          <Button type="button" variant="destructive" disabled>
            <Trash2 />
            Apagar conta
          </Button>
        </div>
      </div>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar da conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Você precisará entrar novamente para acessar o painel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void signOut({ redirectTo: "/login" })
              }}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

