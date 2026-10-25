import { useSyncExternalStore, type ReactNode } from 'react'

import { getPauseInfo, subscribePause } from '@/api/pauseStore'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { browserLocale } from '@/lib/locale'
import { pausedCopy } from './pausedStrings'

/**
 * Renders the booking flow, or — once any public call answered
 * `409 operator_paused` — a friendly "back in season from <date>" screen.
 * The flow is unmounted while paused so no booking can start.
 */
export function PausedGate({ children }: { children: ReactNode }) {
  const info = useSyncExternalStore(subscribePause, getPauseInfo)
  if (!info) return <>{children}</>
  const { title, body } = pausedCopy(info.resumeOn, browserLocale())
  return (
    <div className="min-h-screen embedded:min-h-0 bg-background text-foreground">
      <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
        <Card role="status" data-testid="paused-screen">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{body}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
