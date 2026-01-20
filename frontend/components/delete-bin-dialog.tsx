"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { deleteBin, type Bin } from "@/lib/api-client"
import { Trash2 } from "lucide-react"

type Props = {
    bin: Bin
    onSuccess: () => void
}

export function DeleteBinDialog({ bin, onSuccess }: Props) {
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        try {
            setLoading(true)

            await deleteBin(bin.id)

            toast({
                title: "Bin deleted",
                description: `Bin ${bin.id} has been deleted successfully`,
            })

            setOpen(false)
            onSuccess()
        } catch (e) {
            toast({
                title: "Error",
                description: e instanceof Error ? e.message : "Something went wrong",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(true)}
                className="h-8 w-8 p-0 text-destructive"
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-lg p-6 w-full max-w-sm space-y-4">
                        <h3 className="text-lg font-semibold text-destructive">
                            Delete Bin
                        </h3>

                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete bin{" "}
                            <span className="font-medium">{bin.id}</span>?
                            <br />
                            This action cannot be undone.
                        </p>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={loading}
                            >
                                {loading ? "Deleting..." : "Delete"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
