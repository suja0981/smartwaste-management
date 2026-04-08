"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createBin, type CreateBinRequest } from "@/lib/api-client"
import { Plus, MapPin } from "lucide-react"

type Props = {
    onSuccess: () => void
}

const EMPTY_FORM = {
    id: "",
    location: "",
    capacity_liters: "",
    fill_level_percent: "0",
    latitude: "",
    longitude: "",
}

export function AddBinDialog({ onSuccess }: Props) {
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [form, setForm] = useState(EMPTY_FORM)
    const [errors, setErrors] = useState<Partial<typeof EMPTY_FORM>>({})

    const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((f) => ({ ...f, [field]: e.target.value }))
        setErrors((err) => ({ ...err, [field]: undefined }))
    }

    const validate = () => {
        const next: Partial<typeof EMPTY_FORM> = {}
        if (!form.id.trim()) next.id = "Bin ID is required"
        if (!form.location.trim()) next.location = "Location is required"
        if (!form.capacity_liters || Number(form.capacity_liters) < 1)
            next.capacity_liters = "Capacity must be at least 1 litre"
        const fillNum = Number(form.fill_level_percent)
        if (isNaN(fillNum) || fillNum < 0 || fillNum > 100)
            next.fill_level_percent = "Fill level must be 0 – 100"
        if (form.latitude !== "") {
            const lat = Number(form.latitude)
            if (isNaN(lat) || lat < -90 || lat > 90) next.latitude = "Latitude must be between −90 and 90"
        }
        if (form.longitude !== "") {
            const lng = Number(form.longitude)
            if (isNaN(lng) || lng < -180 || lng > 180) next.longitude = "Longitude must be between −180 and 180"
        }
        setErrors(next)
        return Object.keys(next).length === 0
    }

    const handleSubmit = async () => {
        if (!validate()) return
        try {
            setLoading(true)

            const binData: CreateBinRequest = {
                id: form.id.trim(),
                location: form.location.trim(),
                capacity_liters: Number(form.capacity_liters),
                fill_level_percent: Number(form.fill_level_percent),
                ...(form.latitude !== "" && { latitude: Number(form.latitude) }),
                ...(form.longitude !== "" && { longitude: Number(form.longitude) }),
            }

            await createBin(binData)

            toast({
                title: "Bin added",
                description: `Bin ${form.id} registered successfully`,
            })

            setOpen(false)
            setForm(EMPTY_FORM)
            setErrors({})
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

    const handleClose = () => {
        setOpen(false)
        setForm(EMPTY_FORM)
        setErrors({})
    }

    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Bin
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-background rounded-lg shadow-lg w-full max-w-md">
                        <div className="p-6 space-y-4">
                            <h3 className="text-lg font-semibold">Add New Bin</h3>

                            {/* Bin ID */}
                            <div className="space-y-1">
                                <Label htmlFor="add-bin-id">Bin ID <span className="text-destructive">*</span></Label>
                                <Input
                                    id="add-bin-id"
                                    placeholder="e.g. bin01"
                                    value={form.id}
                                    onChange={set("id")}
                                    className={errors.id ? "border-destructive" : ""}
                                />
                                {errors.id && <p className="text-xs text-destructive">{errors.id}</p>}
                            </div>

                            {/* Location */}
                            <div className="space-y-1">
                                <Label htmlFor="add-bin-loc">Location <span className="text-destructive">*</span></Label>
                                <Input
                                    id="add-bin-loc"
                                    placeholder="e.g. Gandhi Nagar Market"
                                    value={form.location}
                                    onChange={set("location")}
                                    className={errors.location ? "border-destructive" : ""}
                                />
                                {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
                            </div>

                            {/* Lat / Lng side-by-side */}
                            <div className="space-y-1">
                                <Label className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                    GPS Coordinates <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Input
                                            placeholder="Latitude"
                                            type="number"
                                            step="any"
                                            value={form.latitude}
                                            onChange={set("latitude")}
                                            className={errors.latitude ? "border-destructive" : ""}
                                        />
                                        {errors.latitude && <p className="text-xs text-destructive mt-0.5">{errors.latitude}</p>}
                                    </div>
                                    <div>
                                        <Input
                                            placeholder="Longitude"
                                            type="number"
                                            step="any"
                                            value={form.longitude}
                                            onChange={set("longitude")}
                                            className={errors.longitude ? "border-destructive" : ""}
                                        />
                                        {errors.longitude && <p className="text-xs text-destructive mt-0.5">{errors.longitude}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Capacity */}
                            <div className="space-y-1">
                                <Label htmlFor="add-bin-cap">Capacity (litres) <span className="text-destructive">*</span></Label>
                                <Input
                                    id="add-bin-cap"
                                    placeholder="e.g. 100"
                                    type="number"
                                    min="1"
                                    value={form.capacity_liters}
                                    onChange={set("capacity_liters")}
                                    className={errors.capacity_liters ? "border-destructive" : ""}
                                />
                                {errors.capacity_liters && <p className="text-xs text-destructive">{errors.capacity_liters}</p>}
                            </div>

                            {/* Fill Level */}
                            <div className="space-y-1">
                                <Label htmlFor="add-bin-fill">Initial Fill Level (%)</Label>
                                <Input
                                    id="add-bin-fill"
                                    placeholder="0"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={form.fill_level_percent}
                                    onChange={set("fill_level_percent")}
                                    className={errors.fill_level_percent ? "border-destructive" : ""}
                                />
                                {errors.fill_level_percent && <p className="text-xs text-destructive">{errors.fill_level_percent}</p>}
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={handleClose} disabled={loading}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSubmit} disabled={loading}>
                                    {loading ? "Saving…" : "Add Bin"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
