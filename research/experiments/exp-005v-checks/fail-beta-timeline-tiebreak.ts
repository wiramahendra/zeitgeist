import { join } from "node:path"
import { pathToFileURL } from "node:url"

const main = async (): Promise<void> => {
  const root = process.cwd()
  const { sortTimeline, timelineCompare } = await import(pathToFileURL(join(root, "src/domain/Timeline.js")).href)

  const events = sortTimeline([
    { timestamp: "2026-01-01T00:00:00.000Z", eventType: "deploy", subject: "checkout-api", evidenceIds: ["a"] },
    { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "inventory-api", evidenceIds: ["b"] },
    { timestamp: "2026-01-01T00:00:00.000Z", eventType: "alert", subject: "checkout-api", evidenceIds: ["c"] }
  ])
  const order = events.map((event) => `${event.eventType}:${event.subject}`)
  if (JSON.stringify(order) !== JSON.stringify(["alert:checkout-api", "alert:inventory-api", "deploy:checkout-api"])) {
    throw new Error(`sort order: ${order.join(",")}`)
  }
  if (!(timelineCompare({ timestamp: "t", eventType: "a", subject: "z" }, { timestamp: "t", eventType: "b", subject: "a" }) < 0)) {
    throw new Error("compare fail")
  }
  console.log("PASS")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
