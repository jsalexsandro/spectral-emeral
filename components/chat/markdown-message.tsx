"use client"

import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { Children, isValidElement } from "react"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "cn"
import { ChatMessageToolbar } from "@/components/chat/chat-message-toolbar"
import { CodeBlock } from "./code-block"

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return extractText(props.children)
  }
  return ""
}

function getCodeChild(children: ReactNode): {
  className?: string
  code: string
} | null {
  const nodes = Children.toArray(children)
  if (nodes.length !== 1) return null
  const node = nodes[0]
  if (!isValidElement(node)) return null

  const props = node.props as { className?: string; children?: ReactNode }

  // Filhos únicos de <pre> em markdown representam blocos de código
  // (inclusive quando react-markdown usa o componente customizado de `code`).
  return {
    className: props.className,
    code: extractText(props.children).replace(/\n$/, ""),
  }
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1 text-base font-semibold first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1 text-sm font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 mb-1 text-sm font-semibold first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 mb-1 text-sm font-medium first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground italic last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code">) => {
    const isBlock =
      typeof className === "string" && className.includes("language-")

    if (isBlock) {
      return (
        <code className={cn("font-mono", className)} {...props}>
          {children}
        </code>
      )
    }

    return (
      <code
        className={cn(
          "rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => {
    const codeChild = getCodeChild(children)
    if (codeChild) {
      const match = /language-([\w-]+)/.exec(codeChild.className ?? "")
      const language = match?.[1]
      return (
        <div className="mb-3 last:mb-0">
          <CodeBlock code={codeChild.code} language={language} />
        </div>
      )
    }

    const text = extractText(children)
    return (
      <div className="mb-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100 last:mb-0">
        <pre>
          <code>{text}</code>
        </pre>
        <ChatMessageToolbar text={text} />
      </div>
    )
  },
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto rounded-lg border border-border last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-muted px-2 py-1.5 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-2 py-1.5 align-top">
      {children}
    </td>
  ),
  hr: () => <hr className="my-3 border-border" />,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
}

export function MarkdownMessage({
  content,
  timestamp,
}: {
  content: string
  timestamp?: string | Date
}) {
  return (
    <div className="min-w-0 text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      <ChatMessageToolbar text={content} timestamp={timestamp} />
    </div>
  )
}
