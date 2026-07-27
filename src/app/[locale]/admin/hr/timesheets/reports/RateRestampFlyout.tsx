import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertTriangle, Undo } from 'lucide-react';
import { toast } from 'sonner';

interface RateRestampFlyoutProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workerId: string;
    workerName: string;
    referenceEntryId?: string; // Optional, required for THIS_ENTRY/FUTURE/PAST scopes
    currentRate?: number | null;
    onSuccess: () => void;
}

export function RateRestampFlyout({ open, onOpenChange, workerId, workerName, referenceEntryId, currentRate, onSuccess }: RateRestampFlyoutProps) {
    const [scope, setScope] = useState<'THIS_ENTRY' | 'FUTURE' | 'PAST' | 'ALL'>('THIS_ENTRY');
    const [newRate, setNewRate] = useState<string>(currentRate?.toString() || '');
    const [loading, setLoading] = useState(false);
    
    // For undo state tracking
    const [lastAuditId, setLastAuditId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const rateNum = parseFloat(newRate);
        if (isNaN(rateNum) || rateNum < 0) {
            toast.error("Valid hourly rate required");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/hr/timesheet-rates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetWorkerId: workerId,
                    scope,
                    newRate: rateNum,
                    referenceEntryId
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update rates');

            toast.success(`Succesfully updated ${data.count} entries`);
            if (data.auditId) {
                setLastAuditId(data.auditId);
            }
            
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = async () => {
        if (!lastAuditId) return;
        setLoading(true);
        try {
            const res = await fetch('/api/hr/timesheet-rates/undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auditId: lastAuditId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to undo');
            
            toast.success("Restamp undone successfully");
            setLastAuditId(null);
            onSuccess();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle>Update Cost Rate for {workerName}</SheetTitle>
                    <SheetDescription>
                        Modify the hourly cost rate. This affects financial reporting.
                    </SheetDescription>
                </SheetHeader>

                {lastAuditId && (
                    <div className="bg-green-50 border border-green-200 p-4 mt-6 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-green-800">Rates updated successfully.</span>
                        <Button variant="outline" size="sm" onClick={handleUndo} disabled={loading} className="text-green-800 border-green-300">
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo className="w-4 h-4 mr-2" />}
                            Undo Action
                        </Button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                    <div className="space-y-2">
                        <Label>New Hourly Cost (€)</Label>
                        <Input 
                            type="number" 
                            step="0.01" 
                            value={newRate}
                            onChange={(e) => setNewRate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Scope of Change</Label>
                        <RadioGroup value={scope} onValueChange={(val: any) => setScope(val)}>
                            <div className="flex items-start space-x-3 bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                                <RadioGroupItem value="THIS_ENTRY" id="r1" className="mt-1" />
                                <div>
                                    <Label htmlFor="r1" className="font-semibold text-neutral-900 cursor-pointer">Only this entry</Label>
                                    <p className="text-xs text-neutral-500 mt-1">Leaves all other entries and the default profile rate unchanged.</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                                <RadioGroupItem value="FUTURE" id="r2" className="mt-1" />
                                <div>
                                    <Label htmlFor="r2" className="font-semibold text-neutral-900 cursor-pointer">This entry + Future</Label>
                                    <p className="text-xs text-neutral-500 mt-1">Updates this and subsequent entries. Also sets the new rate on the employee profile for future clock-ins.</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                                <RadioGroupItem value="PAST" id="r3" className="mt-1" />
                                <div>
                                    <Label htmlFor="r3" className="font-semibold text-neutral-900 cursor-pointer">Past entries only</Label>
                                    <p className="text-xs text-neutral-500 mt-1">Updates strictly entries prior to this one. Leaves the employee profile rate unchanged.</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 bg-red-50 p-3 rounded-lg border border-red-100">
                                <RadioGroupItem value="ALL" id="r4" className="mt-1" />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="r4" className="font-semibold text-red-900 cursor-pointer">All historical entries (Overwrite)</Label>
                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                    </div>
                                    <p className="text-xs text-red-700/80 mt-1">Danger: Changes the cost rate for ALL past entries for this worker, ignoring prior restamps. Also updates the profile.</p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    <SheetFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Apply Rates
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
