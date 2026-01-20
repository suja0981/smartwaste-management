"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { updateBin, type Bin, type UpdateBinRequest } from "@/lib/api-client"
import { Edit2 } from "lucide-react"

type Props = {
    bin: Bin
    onSuccess: () => void
}

export function EditBinDialog({ bin, onSuccess }: Props) {
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [form, setForm] = useState({
        location: bin.location,
        capacity_liters: bin.capacity_liters.toString(),
        fill_level_percent: bin.fill_level_percent.toString(),
    })

    const handleSubmit = async () => {
        try {
            setLoading(true)

            const updateData: UpdateBinRequest = {
                location: form.location,
                capacity_liters: Number(form.capacity_liters),
                fill_level_percent: Number(form.fill_level_percent),
            }

            await updateBin(bin.id, updateData)

            toast({
                title: "Bin updated",
                description: `Bin ${bin.id} updated successfully`,
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
                className="h-8 w-8 p-0"
            >
                <Edit2 className="h-4 w-4" />
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-lg p-6 w-full max-w-md space-y-4">
                        <h3 className="text-lg font-semibold">Edit Bin {bin.id}</h3>

                        <Input
                            placeholder="Location"
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />

                        <Input
                            placeholder="Capacity (liters)"
                            type="number"
                            value={form.capacity_liters}
                            onChange={(e) => setForm({ ...form, capacity_liters: e.target.value })}
                        />

                        <Input
                            placeholder="Fill Level (%)"
                            type="number"
                            min="0"
                            max="100"
                            value={form.fill_level_percent}
                            onChange={(e) => setForm({ ...form, fill_level_percent: e.target.value })}
                        />

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading ? "Saving..." : "Update Bin"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
