import DOMPurify from "isomorphic-dompurify"
import {
  HTML_UI_ACTION_ATTRIBUTE,
  HTML_UI_ATTRIBUTES,
  HTML_UI_TAGS,
  isAllowedHtmlUri,
  parseHtmlAction,
  sanitizeHtmlClassList,
} from "./html-policy"

const allowedAttributes = new Set<string>(HTML_UI_ATTRIBUTES)

const forbiddenTags = [
  "audio",
  "base",
  "canvas",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "object",
  "script",
  "select",
  "source",
  "style",
  "svg",
  "textarea",
  "track",
  "video",
]

let configured = false

function configureDomPurify() {
  if (configured) {
    return
  }

  configured = true

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const element = node as Element
    const tagName = element.tagName?.toLowerCase()

    if (!tagName) {
      return
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name

      if (
        (name.startsWith("data-") && name !== HTML_UI_ACTION_ATTRIBUTE) ||
        (name.startsWith("aria-") && !allowedAttributes.has(name))
      ) {
        element.removeAttribute(name)
      }
    }

    const className = element.getAttribute("class")

    if (className !== null) {
      const sanitizedClassName = sanitizeHtmlClassList(className)

      if (sanitizedClassName) {
        element.setAttribute("class", sanitizedClassName)
      } else {
        element.removeAttribute("class")
      }
    }

    const actionValue = element.getAttribute(HTML_UI_ACTION_ATTRIBUTE)

    if (actionValue !== null) {
      const action = parseHtmlAction(actionValue)

      if (!action || (tagName !== "button" && tagName !== "a")) {
        element.removeAttribute(HTML_UI_ACTION_ATTRIBUTE)
      }
    }

    if (tagName === "button") {
      element.setAttribute("type", "button")
    }

    if (tagName === "a") {
      const href = element.getAttribute("href")

      if (href !== null && !isAllowedHtmlUri(href)) {
        element.removeAttribute("href")
      }

      if (element.getAttribute("target") === "_blank") {
        element.setAttribute("rel", "noopener noreferrer")
      }
    }
  })
}

export function sanitizeHtml(html: string): string {
  configureDomPurify()

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...HTML_UI_TAGS],
    ALLOWED_ATTR: [...HTML_UI_ATTRIBUTES],
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: forbiddenTags,
    FORBID_ATTR: ["id", "style"],
  })

  return String(sanitized).trim()
}
