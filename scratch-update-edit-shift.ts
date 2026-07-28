import fs from 'fs';
import path from 'path';

const file = path.join(__dirname, 'src/components/time-tracker/components/schedule/EditShiftDialog.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add states
content = content.replace(
  "const [editScope, setEditScope] = useState<EditScope>('occurrence');",
  "const [editScope, setEditScope] = useState<EditScope>('occurrence');\n  const [isConvertingToRecurring, setIsConvertingToRecurring] = useState(false);\n  const [recurringWeeks, setRecurringWeeks] = useState(4);\n  const [selectedDays, setSelectedDays] = useState<number[]>([]);"
);

// 2. Add onCreateShift to props
content = content.replace(
  "  onDeleteShift: (shiftId: string, scope?: EditScope) => Promise<void>;",
  "  onCreateShift?: (shift: any) => Promise<any>;\n  onDeleteShift: (shiftId: string, scope?: EditScope) => Promise<void>;"
);

// 3. Update destructured props
content = content.replace(
  "  onDeleteShift,\n  onStatusChange,\n  canManage,",
  "  onCreateShift,\n  onDeleteShift,\n  onStatusChange,\n  canManage,"
);

// 4. Add UI for "Make Recurring"
const recurringUIRegex = /<div className="pt-4 border-t mt-6">\s*<ScopePicker/;
const recurringUIReplacement = `{canManage && !shift?.seriesId && !isConvertingToRecurring && (
                <div className="pt-4 border-t mt-6">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsConvertingToRecurring(true)} className="w-full">
                    <Repeat className="h-4 w-4 mr-2" /> Make Recurring
                  </Button>
                </div>
              )}

              {isConvertingToRecurring && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50 mt-6 relative">
                  <Button type="button" variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0" onClick={() => setIsConvertingToRecurring(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Label className="text-base font-semibold">Make Recurring</Label>
                  
                  <div>
                    <Label>Repeat for (weeks)</Label>
                    <Input type="number" min={1} max={52} value={recurringWeeks} onChange={e => setRecurringWeeks(parseInt(e.target.value) || 1)} className="mt-1" />
                  </div>
                  
                  <div>
                    <Label>Days of week</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                        <Badge 
                          key={d} 
                          variant={selectedDays.includes(i) ? 'default' : 'outline'}
                          className="cursor-pointer px-3 py-1 text-sm"
                          onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                        >
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground italic">
                    Will generate {selectedDays.length * recurringWeeks} additional shifts.
                  </div>
                </div>
              )}

              {canManage && shift?.seriesId && (
                <div className="pt-4 border-t mt-6">
                  <ScopePicker`;

content = content.replace(recurringUIRegex, recurringUIReplacement);

// 5. Update handleSubmit to handle recurring conversion
const handleSubmitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?if \(!shift\) return;[\s\S]*?setLoading\(true\);[\s\S]*?try \{[\s\S]*?await onUpdateShift\(shift\.id, \{[\s\S]*?\}, editScope\);[\s\S]*?if \(status !== shift\.status\) \{[\s\S]*?await onStatusChange\(shift\.id, status\);[\s\S]*?\}[\s\S]*?toast\.success\('Shift updated'\);[\s\S]*?onOpenChange\(false\);[\s\S]*?\} catch \{[\s\S]*?toast\.error\('Failed to update shift'\);[\s\S]*?\} finally \{[\s\S]*?setLoading\(false\);[\s\S]*?\}\n  \};/;

const newHandleSubmit = `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;

    if (isConvertingToRecurring && selectedDays.length === 0) {
      toast.error('Select at least one day for recurring shifts');
      return;
    }

    setLoading(true);
    try {
      let seriesId = shift.seriesId;
      
      if (isConvertingToRecurring && onCreateShift) {
        seriesId = Math.random().toString(36).substring(2, 9);
        const startDate = new Date(shiftDate);
        const shiftsToCreate: Array<any> = [];

        for (let week = 0; week < recurringWeeks; week++) {
          for (const dayOfWeek of selectedDays) {
            const date = new Date(startDate);
            const currentDay = date.getDay();
            let daysToAdd = dayOfWeek - currentDay;
            if (daysToAdd < 0) daysToAdd += 7;
            date.setDate(date.getDate() + daysToAdd + (week * 7));
            
            const dateStr = date.toISOString().split('T')[0];
            // Don't create a duplicate of the exact same day
            if (dateStr === shiftDate) continue;

            shiftsToCreate.push({
              user_id: userId,
              project_id: projectId || null,
              shift_date: dateStr,
              shift_start: shiftStart,
              shift_end: shiftEnd,
              role: role || null,
              notes: notes || null,
              seriesId,
              status
            });
          }
        }

        for (const s of shiftsToCreate) {
          await onCreateShift(s);
        }
      }

      await onUpdateShift(shift.id, {
        user_id: userId,
        project_id: projectId || null,
        shift_date: shiftDate,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        role: role || null,
        notes: notes || null,
        ...(seriesId ? { seriesId } : {})
      }, editScope);

      if (status !== shift.status) {
        await onStatusChange(shift.id, status);
      }

      toast.success(isConvertingToRecurring ? 'Shift converted to recurring' : 'Shift updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update shift');
    } finally {
      setLoading(false);
    }
  };`;

content = content.replace(handleSubmitRegex, newHandleSubmit);

// 6. Import Repeat and X
content = content.replace(
  "import { Loader2, Calendar, Clock, MapPin, AlignLeft, CheckCircle2, Circle, Search, Plus, ListTodo, Paperclip, FileText, Image } from 'lucide-react';",
  "import { Loader2, Calendar, Clock, MapPin, AlignLeft, CheckCircle2, Circle, Search, Plus, ListTodo, Paperclip, FileText, Image, Repeat, X } from 'lucide-react';"
);

fs.writeFileSync(file, content);
console.log('Update complete.');
