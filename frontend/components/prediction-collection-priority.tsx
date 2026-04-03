"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getCollectionPriority, getBins, type Bin } from "@/lib/api-client"
import { Zap, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export function PredictionCollectionPriority() {
    const { data: priority = [], isLoading: priorityLoading, refetch } = useQuery({
        queryKey: ["collection-priority"],
        queryFn: getCollectionPriority,
        refetchInterval: 60_000,
        staleTime: 30_000,
    })

    // bins are already cached from other components — no extra network cost
    const { data: binsArr = [], isLoading: binsLoading } = useQuery<Bin[]>({
        queryKey: ["bins"],
        queryFn: () => getBins(),
        staleTime: 30_000,
    })

    const loading = priorityLoading || binsLoading
    const bins = useMemo(
        () => new Map(binsArr.map((b) => [b.id, b])),
        [binsArr]
    )

    const getUrgencyColor = (fill: number) => {
        if (fill >= 90) return { badge: "bg-red-100 text-red-700", dot: "bg-red-500" }
        if (fill >= 80) return { badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" }
        if (fill >= 60) return { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" }
        return { badge: "bg-green-100 text-green-700", dot: "bg-green-500" }
    }

    const topBins = priority.slice(0, 8)

    return (
        <Card className="h-full">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Zap className="h-5 w-5 text-amber-500" />
                            Collection Priority
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Optimized route order
                        </CardDescription>
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={loading}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                        <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
                    </button>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : topBins.length > 0 ? (
                    <div className="space-y-1.5">
                        {topBins.map((binId, idx) => {
                            const bin = bins.get(binId)
                            if (!bin) return null

                            const fill = bin.fill_level_percent ?? 0
                            const urgency = getUrgencyColor(fill)

                            return (
                                <div
                                    key={binId}
                                    className="flex items-center gap-2 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors group"
                                >
                                    {/* Position */}
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold shrink-0">
                                        {idx + 1}
                                    </div>

                                    {/* Bin Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{bin.id}</p>
                                        <p className="text-xs text-muted-foreground truncate">{bin.location}</p>
                                    </div>

                                    {/* Fill Level */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <div className={cn("h-2 w-2 rounded-full", urgency.dot)} />
                                        <Badge className={urgency.badge} variant="secondary">
                                            {fill}%
                                        </Badge>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-8 text-center">
                        <p className="text-xs text-muted-foreground">
                            No bins ready for collection
                        </p>
                    </div>
                )}

                {priority.length > topBins.length && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                        +{priority.length - topBins.length} more in queue
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
