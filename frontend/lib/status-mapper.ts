// Maps backend status values to frontend display values

export function mapBinStatus(backendStatus: string): 'critical' | 'warning' | 'normal' | 'offline' {
  switch (backendStatus.toLowerCase()) {
    case 'full':
      return 'critical'
    case 'warning':
      return 'warning'
    case 'offline':
    case 'maintenance':
      return 'offline'
    case 'ok':
    default:
      return 'normal'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'critical':
    case 'full':
      return 'bg-destructive text-destructive-foreground'
    case 'warning':
      return 'bg-secondary text-secondary-foreground'
    case 'normal':
    case 'ok':
      return 'bg-primary text-primary-foreground'
    case 'offline':
    case 'maintenance':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'critical':
    case 'full':
      return 'Critical'
    case 'warning':
      return 'Warning'
    case 'normal':
    case 'ok':
      return 'Normal'
    case 'offline':
      return 'Offline'
    case 'maintenance':
      return 'Maintenance'
    default:
      return 'Unknown'
  }
}

export function mapAlertSeverity(alertType: string): 'high' | 'medium' | 'low' {
  switch (alertType.toLowerCase()) {
    case 'fire':
    case 'overflow':
      return 'high'
    case 'spill':
      return 'medium'
    case 'vandalism':
    default:
      return 'low'
  }
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  return date.toLocaleDateString()
}