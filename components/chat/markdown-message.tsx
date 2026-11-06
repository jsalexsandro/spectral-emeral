import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "cn"
import { ChatMessageToolbar } from "@/components/chat/chat-message-toolbar"

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
  code: ({ className, children }) => (
    <code
      className={cn(
        "rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10",
        className,
      )}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => {
    const text = String(children)

    return (
      <div className="mb-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100 last:mb-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
        {children}
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

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="min-w-0 text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      <ChatMessageToolbar text={content} />
    </div>
  )
}
