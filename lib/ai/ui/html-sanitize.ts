import DOMPurify from "isomorphic-dompurify"
import {
  HTML_UI_ACTION_ATTRIBUTE,
  HTML_UI_ATTRIBUTES,
  HTML_UI_INPUT_TYPE_SET,
  HTML_UI_TAGS,
  HTML_UI_WIDGET_ATTRIBUTES,
  isAllowedHtmlUri,
  parseHtmlAction,
  sanitizeHtmlClassList,
} from "./html-policy"

const allowedAttributes = new Set<string>(HTML_UI_ATTRIBUTES)

/**
 * Widgets v2 podem usar atributos `data-*` e `id` como ganchos de estado e
 * consulta dentro do iframe. Como o documento tem origem opaca, esses
 * atributos não alcançam o app; em HTML estático (v1) continuam bloqueados.
 */
type SanitizeHtmlOptions = {
  widget?: boolean
}

let activeOptions: SanitizeHtmlOptions = {}

const safeDataAttributePattern = /^data-[a-z0-9-]+$/

const forbiddenTags = [
  "audio",
  "base",
  "canvas",
  "embed",
  "form",
  "iframe",
  "link",
  "math",
  "meta",
  "object",
  "script",
  "source",
  "style",
  "svg",
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

      if (name.startsWith("data-")) {
        const keepDataAttribute =
          name === HTML_UI_ACTION_ATTRIBUTE ||
          (activeOptions.widget === true &&
            safeDataAttributePattern.test(name))

        if (!keepDataAttribute) {
          element.removeAttribute(name)
        }

        continue
      }

      if (name.startsWith("aria-") && !allowedAttributes.has(name)) {
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

    if (tagName === "input") {
      const inputType = element.getAttribute("type")?.toLowerCase() ?? ""

      if (!HTML_UI_INPUT_TYPE_SET.has(inputType)) {
        element.setAttribute("type", "text")
      }
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

export function sanitizeHtml(
  html: string,
  options: SanitizeHtmlOptions = {},
): string {
  configureDomPurify()

  const allowWidgetAttributes = options.widget === true

  activeOptions = options

  try {
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [...HTML_UI_TAGS],
      ALLOWED_ATTR: allowWidgetAttributes
        ? [...HTML_UI_WIDGET_ATTRIBUTES]
        : [...HTML_UI_ATTRIBUTES],
      ALLOW_ARIA_ATTR: true,
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: forbiddenTags,
      FORBID_ATTR: allowWidgetAttributes ? ["style"] : ["id", "style"],
    })

    return String(sanitized).trim()
  } finally {
    activeOptions = {}
  }
}
