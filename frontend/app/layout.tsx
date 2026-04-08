import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { QueryProvider } from "@/components/query-provider"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"
import { RealtimeBinsProvider } from "@/hooks/useRealtimeBins"
import "./globals.css"
// Leaflet CSS moved to app/map/page.tsx — only loaded on the map page



export const metadata: Metadata = {
  title: "Smart Waste Management Dashboard",
  description: "AI + IoT Smart Waste Management System",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <AuthProvider>
        <QueryProvider>
          <ThemeProvider>
              <RealtimeBinsProvider>
                <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
                  {children}
                </Suspense>
                <Toaster />
              </RealtimeBinsProvider>
            </ThemeProvider>
        </QueryProvider>
        </AuthProvider>

        <Analytics />
      </body>
    </html>
  )
}
