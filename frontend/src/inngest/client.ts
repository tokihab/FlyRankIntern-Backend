import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "ai-decision-flow",
  baseUrl: process.env.INNGEST_BASE_URL || "http://inngest:8288",
  isDev: process.env.NODE_ENV !== "production" || process.env.INNGEST_DEV === "1",
});