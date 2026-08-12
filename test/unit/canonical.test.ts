import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { atomicWrite, canonicalDigest, canonicalize } from "../../src/context/Canonicalize.js"

describe("canonical artifacts", () => {
  it("serializes semantically equivalent key orders identically", () => {
    expect(canonicalize({ z: 1, a: { y: 2, x: 3 } })).toBe(canonicalize({ a: { x: 3, y: 2 }, z: 1 }))
  })

  it("produces stable digests", () => {
    expect(canonicalDigest({ b: true, a: [1, 2] })).toBe(canonicalDigest({ a: [1, 2], b: true }))
  })

  it("changes the digest when semantic data changes", () => {
    expect(canonicalDigest({ value: 1 })).not.toBe(canonicalDigest({ value: 2 }))
  })

  it("serializes empty objects and arrays deterministically", () => {
    expect(canonicalize({})).toBe("{}\n")
    expect(canonicalize([])).toBe("[]\n")
    expect(canonicalize({ nested: {} })).toBe("{\"nested\":{}}\n")
    expect(canonicalize([[]])).toBe("[[]]\n")
  })

  it("produces stable digests for empty objects and arrays", () => {
    const emptyObjectDigest = canonicalDigest({})
    const emptyArrayDigest = canonicalDigest([])

    expect(canonicalDigest({})).toBe(emptyObjectDigest)
    expect(canonicalDigest([])).toBe(emptyArrayDigest)
    expect(emptyObjectDigest).not.toBe(emptyArrayDigest)
  })

  it("atomically writes stable UTF-8 bytes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zeitgeist-canonical-"))
    const path = join(directory, "artifact.json")
    await Effect.runPromise(atomicWrite(path, canonicalize({ text: "Bali ✓" })))
    expect(await readFile(path, "utf8")).toBe("{\"text\":\"Bali ✓\"}\n")
  })
})
