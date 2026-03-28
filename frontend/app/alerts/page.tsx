// app/alerts/page.tsx
// AI Alerts page removed — no CCTV in this project.
// Redirect to dashboard instead of showing a dead "feature removed" message.

import { redirect } from "next/navigation"

export default function AlertsPage() {
  redirect("/")
}