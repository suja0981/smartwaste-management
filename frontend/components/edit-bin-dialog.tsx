"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { updateBin, type Bin, type UpdateBinRequest } from "@/lib/api-client"
import { Edit2, MapPin } from "lucide-react"
import { Label } from "@/components/ui/label"

type Props = {
    bin: Bin
    onSuccess: () => void
}

export function EditBinDialog({ bin, onSuccess }: Props) {
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const makeForm = () => ({
        location: bin.location,
        capacity_liters: bin.capacity_liters.toString(),
        fill_level_percent: bin.fill_level_percent.toString(),
        latitude: bin.latitude != null ? String(bin.latitude) : "",
        longitude: bin.longitude != null ? String(bin.longitude) : "",
    })

    const [form, setForm] = useState(makeForm)
    const [errors, setErrors] = useState<Partial<ReturnType<typeof makeForm>>>({})

    const set = (field: keyof ReturnType<typeof makeForm>) =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setForm((f) => ({ ...f, [field]: e.target.value }))
            setErrors((err) => ({ ...err, [field]: undefined }))
        }

    const validate = () => {
        const next: Partial<ReturnType<typeof makeForm>> = {}
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

            const updateData: UpdateBinRequest = {
                location: form.location.trim(),
                capacity_liters: Number(form.capacity_liters),
                fill_level_percent: Number(form.fill_level_percent),
                ...(form.latitude !== "" && { latitude: Number(form.latitude) }),
                ...(form.longitude !== "" && { longitude: Number(form.longitude) }),
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

    const handleOpen = () => { setForm(makeForm()); setErrors({}); setOpen(true) }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                onClick={handleOpen}
                className="h-8 w-8 p-0"
            >
                <Edit2 className="h-4 w-4" />
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-background rounded-lg shadow-lg w-full max-w-md">
                        <div className="p-6 space-y-4">
                            <h3 className="text-lg font-semibold">Edit Bin {bin.id}</h3>

                            {/* Location */}
                            <div className="space-y-1">
                                <Label htmlFor="edit-bin-loc">Location <span className="text-destructive">*</span></Label>
                                <Input
                                    id="edit-bin-loc"
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
                                <Label htmlFor="edit-bin-cap">Capacity (litres) <span className="text-destructive">*</span></Label>
                                <Input
                                    id="edit-bin-cap"
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
                                <Label htmlFor="edit-bin-fill">Fill Level (%)</Label>
                                <Input
                                    id="edit-bin-fill"
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
                                <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSubmit} disabled={loading}>
                                    {loading ? "Saving…" : "Update Bin"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
