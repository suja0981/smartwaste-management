"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import {
  getUserSettings,
  registerDeviceToken,
  unregisterDeviceToken,
  updateUserSettings,
  type UserSettings,
} from "@/lib/api-client"
import {
  clearBrowserPushNotifications,
  getStoredPushToken,
  isPushMessagingSupported,
  registerBrowserPushNotifications,
} from "@/lib/firebase"
import { Bell, Loader2, LogOut, Save, Shield, User, Wifi } from "lucide-react"

const DEFAULT_SETTINGS: UserSettings = {
  full_name: "",
  email: "",
  notifications: {
    criticalBins: true,
    routeUpdates: true,
    systemAlerts: false,
    emailDigest: false,
    pushEnabled: false,
  },
  display: {
    compactMode: false,
    autoRefresh: true,
  },
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <SettingsContent />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function SettingsContent() {
  const { user, logout, updateProfile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const [savedSettings, supported] = await Promise.all([
          getUserSettings(),
          isPushMessagingSupported().catch(() => false),
        ])
        if (!active) return
        setSettings(savedSettings)
        setPushSupported(supported)
      } catch (error) {
        if (!active) return
        setSettings((current) => ({
          ...current,
          full_name: user?.full_name || "",
          email: user?.email || "",
        }))
        toast({
          title: "Could not load settings",
          description: error instanceof Error ? error.message : "Using local defaults for now.",
          variant: "destructive",
        })
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [toast, user?.email, user?.full_name])

  const pushStatusText = useMemo(() => {
    if (!pushSupported) return "This browser does not support web push notifications."
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
      return "Web push is almost ready. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY to enable browser token registration."
    }
    if (settings.notifications.pushEnabled) {
      return "Push notifications are enabled for this device."
    }
    return "Enable push notifications to receive live mobile/browser alerts."
  }, [pushSupported, settings.notifications.pushEnabled])

  const handleSave = async () => {
    setSaving(true)
    try {
      let nextSettings = settings

      if (settings.notifications.pushEnabled) {
        if (!pushSupported) {
          throw new Error("This browser does not support push notifications.")
        }
        const token = await registerBrowserPushNotifications()
        await registerDeviceToken(token)
      } else {
        const existingToken = getStoredPushToken()
        if (existingToken) {
          await unregisterDeviceToken(existingToken).catch(() => {})
        }
        await clearBrowserPushNotifications().catch(() => {})
      }

      nextSettings = await updateUserSettings(settings)
      setSettings(nextSettings)
      updateProfile({ full_name: nextSettings.full_name, email: nextSettings.email })
      toast({
        title: "Settings saved",
        description: "Your preferences are now stored on the server.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save settings."
      if (settings.notifications.pushEnabled) {
        setSettings((current) => ({
          ...current,
          notifications: {
            ...current.notifications,
            pushEnabled: false,
          },
        }))
      }
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage your account, alerts, and display preferences.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Full name
              </Label>
              <Input
                id="name"
                value={settings.full_name}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, full_name: event.target.value }))
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                value={settings.email || user?.email || ""}
                disabled
                className="h-8 text-sm opacity-60"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
          <CardDescription className="text-xs">Choose which alerts you want and whether this device can receive push messages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-xs text-muted-foreground">{pushStatusText}</p>
            </div>
            <Switch
              checked={settings.notifications.pushEnabled}
              onCheckedChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  notifications: {
                    ...current.notifications,
                    pushEnabled: value,
                  },
                }))
              }
            />
          </div>

          {[
            {
              key: "criticalBins",
              label: "Critical bin alerts",
              description: "Notify when bins exceed 90% fill.",
            },
            {
              key: "routeUpdates",
              label: "Route updates",
              description: "Notify when a route is started or updated.",
            },
            {
              key: "systemAlerts",
              label: "System alerts",
              description: "Receive maintenance and sensor error notices.",
            },
            {
              key: "emailDigest",
              label: "Daily email digest",
              description: "Receive a summary of daily operations.",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={settings.notifications[item.key as keyof typeof settings.notifications] as boolean}
                onCheckedChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    notifications: {
                      ...current.notifications,
                      [item.key]: value,
                    },
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Wifi className="h-4 w-4" />
            Display and Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              key: "compactMode",
              label: "Compact mode",
              description: "Use denser cards and tighter spacing.",
            },
            {
              key: "autoRefresh",
              label: "Auto-refresh fallback data",
              description: "Keep minute-based refresh enabled when live sockets reconnect.",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={settings.display[item.key as keyof typeof settings.display] as boolean}
                onCheckedChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    display: {
                      ...current.display,
                      [item.key]: value,
                    },
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button size="sm" onClick={handleSave} className="h-9" disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Save changes
        </Button>

        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-4 px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <Shield className="h-4 w-4" />
                Sign out
              </p>
              <p className="text-xs text-muted-foreground">Sign out of this device and clear registered push tokens.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={handleLogout}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
