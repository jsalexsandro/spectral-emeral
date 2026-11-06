import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { HTML_UI_CLASSES } from "./html-policy"

function readSafelist() {
  const css = readFileSync(
    new URL("../../../app/globals.css", import.meta.url),
    "utf8",
  )
  const classes = new Set<string>()

  for (const match of css.matchAll(/@source inline\("([^"]+)"\)/g)) {
    for (const className of match[1].split(/\s+/)) {
      classes.add(className)
    }
  }

  return classes
}

describe("generative html tailwind safelist", () => {
  it("includes every allowed class", () => {
    const safelist = readSafelist()
    const missing = HTML_UI_CLASSES.filter(
      (className) => !safelist.has(className),
    )

    expect(missing).toEqual([])
  })
})
