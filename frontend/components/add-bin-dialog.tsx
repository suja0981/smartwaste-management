"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { createBin, type CreateBinRequest } from "@/lib/api-client"

type Props = {
    onSuccess: () => void
}

export function AddBinDialog({ onSuccess }: Props) {
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [form, setForm] = useState({
        id: "",
        location: "",
        location_type: "Residential",
        capacity_liters: "",
        fill_level_percent: "0",
    })

    const handleSubmit = async () => {
        try {
            setLoading(true)

            const binData: CreateBinRequest = {
                id: form.id,
                location: form.location,
                capacity_liters: Number(form.capacity_liters),
                fill_level_percent: Number(form.fill_level_percent),
            }

            await createBin(binData)

            toast({
                title: "Bin added",
                description: `Bin ${form.id} registered successfully`,
            })

            setOpen(false)
            setForm({ id: "", location: "", location_type: "Residential", capacity_liters: "", fill_level_percent: "0" })
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
            <Button size="sm" onClick={() => setOpen(true)}>
                + Add Bin
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-lg p-6 w-full max-w-md space-y-4">
                        <h3 className="text-lg font-semibold">Add New Bin</h3>

                        <Input
                            placeholder="Bin ID"
                            value={form.id}
                            onChange={(e) => setForm({ ...form, id: e.target.value })}
                        />

                        <Input
                            placeholder="Location"
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />

                        <select
                            className="w-full border rounded-md px-3 py-2 bg-background"
                            value={form.location_type}
                            onChange={(e) =>
                                setForm({ ...form, location_type: e.target.value })
                            }
                        >
                            <option>Residential</option>
                            <option>Commercial</option>
                            <option>Industrial</option>
                        </select>

                        <Input
                            placeholder="Capacity (liters)"
                            type="number"
                            value={form.capacity_liters}
                            onChange={(e) => setForm({ ...form, capacity_liters: e.target.value })}
                        />

                        <Input
                            placeholder="Initial Fill Level (%)"
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
                                {loading ? "Saving..." : "Add Bin"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
