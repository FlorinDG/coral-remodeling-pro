import React, { useState, useEffect } from 'react';
import { hrList, hrCreate } from '@/components/time-tracker/lib/hr-api';
import { Loader2, Plus, Calendar, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ManualEntryModal({ open, onOpenChange, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    
    // Form state
    const [userId, setUserId] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('17:00');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (open && employees.length === 0) {
            hrList<Employee>('employees').then(data => setEmployees(data)).catch(console.error);
        }
        if (open) {
            setDate(new Date().toISOString().split('T')[0]);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !date || !startTime || !endTime) return;
        
        setLoading(true);
        try {
            const clockInTime = new Date(`${date}T${startTime}:00`).toISOString();
            const clockOutTime = new Date(`${date}T${endTime}:00`).toISOString();
            
            await hrCreate('clock-entries', {
                userId,
                clockInTime,
                clockOutTime,
                taskDescription: description,
                approvalStatus: 'approved',
                photos: [],
            });
            onSuccess();
            onOpenChange(false);
            
            // Reset
            setUserId('');
            setDescription('');
        } catch (err) {
            console.error('Failed to create manual entry:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Handmatige Invoer</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Medewerker</Label>
                        <Select value={userId} onValueChange={setUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecteer een medewerker" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.firstName} {emp.lastName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Datum</Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Starttijd</Label>
                            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Eindtijd</Label>
                            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Omschrijving</Label>
                        <Textarea 
                            placeholder="Beschrijf de uitgevoerde werkzaamheden..." 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                        />
                    </div>
                    
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
                        <Button type="submit" disabled={loading || !userId || !date}>
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Opslaan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
