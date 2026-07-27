"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { hrUpdate } from '@/components/time-tracker/lib/hr-api';

interface CostRateEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employeeId: string;
    currentRate: number;
    onSuccess?: () => void;
}

export function CostRateEditor({ open, onOpenChange, employeeId, currentRate, onSuccess }: CostRateEditorProps) {
    const [rate, setRate] = useState(currentRate.toString());
    const [scope, setScope] = useState('forward'); // 'forward' | 'all'
    const [loading, setLoading] = useState(false);

    const handleApply = async () => {
        setLoading(true);
        try {
            // Note: In a full implementation, we'd have a specific API endpoint to handle the scope logic
            // e.g. POST /api/hr/employees/[id]/cost-rate
            // For this phase, we update the canonical rate on Employee. 
            // The "All past" scope requires a dedicated backend job to restamp ClockEntries.
            await hrUpdate('employees', employeeId, { hourlyCost: parseFloat(rate) });
            
            if (scope === 'all') {
                // Future: trigger restamp job for all past entries
                console.log("Restamping all past entries not yet implemented in backend.");
            }
            
            if (onSuccess) onSuccess();
            onOpenChange(false);
        } catch (err) {
            console.error("Failed to update cost rate:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Uurtarief (Kosten) Aanpassen</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Nieuw Tarief (€/uur)</Label>
                        <Input 
                            type="number" 
                            step="0.01" 
                            value={rate} 
                            onChange={(e) => setRate(e.target.value)} 
                        />
                    </div>
                    
                    <div className="space-y-3">
                        <Label>Toepassingsbereik</Label>
                        <RadioGroup value={scope} onValueChange={setScope} className="space-y-2">
                            <div className="flex items-start space-x-3 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-100 dark:border-neutral-700">
                                <RadioGroupItem value="forward" id="r-forward" className="mt-1" />
                                <div>
                                    <Label htmlFor="r-forward" className="font-medium">Vanaf vandaag (Standaard)</Label>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Nieuwe uren krijgen dit tarief. Historische uren en marges blijven ongewijzigd.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-100 dark:border-neutral-700 opacity-60">
                                <RadioGroupItem value="all" id="r-all" className="mt-1" disabled />
                                <div>
                                    <Label htmlFor="r-all" className="font-medium text-amber-700 dark:text-amber-500 flex items-center gap-2">
                                        Alle uren uit het verleden (Binnenkort)
                                    </Label>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Herbereken alle kosten en projectmarges met terugwerkende kracht.
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
                    <Button onClick={handleApply} disabled={loading}>Opslaan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
