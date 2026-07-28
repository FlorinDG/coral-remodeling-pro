import fs from 'fs';
import path from 'path';

const file = path.join(__dirname, 'src/components/time-tracker/components/schedule/CreateShiftForm.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add states
content = content.replace(
  "const [shiftDate, setShiftDate] = useState('');",
  "const [shiftDate, setShiftDate] = useState('');\n  const [shiftEndDate, setShiftEndDate] = useState('');\n  const [includeWeekends, setIncludeWeekends] = useState(false);"
);

// Update onCreateShift signature
content = content.replace(
  /notes\?: string \| null;\n  }\) => Promise<{ id: string } \| unknown>;/,
  "notes?: string | null;\n    status?: string;\n    shiftName?: string;\n    seriesId?: string;\n  }) => Promise<{ id: string } | unknown>;"
);

// We need to completely rewrite handleSubmit logic.
const handleSubmitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?resetForm\(\);\n      setOpen\(false\);\n    \} catch \(error\) \{[\s\S]*?finally \{\n      setLoading\(false\);\n    \}\n  \};/;

const newHandleSubmit = `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (userIds.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    const useRecurring = scheduleType === 'recurring';

    if (!shiftDate) {
      toast.error('Please select a start date');
      return;
    }

    if (useRecurring && selectedDays.length === 0) {
      toast.error('Please select at least one day for recurring shifts');
      return;
    }

    setLoading(true);
    try {
      if (saveAsTemplate && templateName) {
        try {
          await hrCreate('shift-templates', {
            name: templateName,
            shiftStart,
            shiftEnd,
            projectId: projectId || null,
            role: role || null,
            notes: notes || null,
          });
        } catch {
          toast.error('Failed to save template');
        }
      }

      if (useRecurring) {
        const startDate = new Date(shiftDate);
        const shiftsToCreate: Array<any> = [];
        const seriesId = Math.random().toString(36).substring(2, 9);

        for (let week = 0; week < recurringWeeks; week++) {
          for (const dayOfWeek of selectedDays) {
            const date = new Date(startDate);
            const currentDay = date.getDay();
            let daysToAdd = dayOfWeek - currentDay;
            if (daysToAdd < 0) daysToAdd += 7;
            date.setDate(date.getDate() + daysToAdd + (week * 7));
            
            // Note: Include weekends applies to single/leave ranges, but for recurring we trust the user's selected days.
            // If they explicitly selected a weekend day, we shouldn't block it. But if includeWeekends is false, maybe we filter? 
            // We'll leave recurring behavior as selected days.

            for (const uid of userIds) {
              shiftsToCreate.push({
                user_id: uid,
                project_id: projectId || null,
                shift_date: date.toISOString().split('T')[0],
                shift_start: shiftStart,
                shift_end: shiftEnd,
                role: role || null,
                notes: notes || null,
                seriesId
              });
            }
          }
        }

        for (const shift of shiftsToCreate) {
          const result = await onCreateShift(shift);
          const shiftId = result?.data?.id || (result && typeof result === 'object' && 'id' in result ? (result as any).id : null);
          if (pendingAttachments.length > 0 && shiftId) await uploadAttachmentsForShift(shiftId);
          if (selectedTasks.length > 0 && shiftId) await assignTasksToShift(shiftId);
        }

        toast.success(\`Created \${shiftsToCreate.length} recurring shifts across \${userIds.length} employee(s)\`);
      } else {
        // Multi-day consecutive (single) or leave
        const start = new Date(shiftDate);
        const end = shiftEndDate ? new Date(shiftEndDate) : new Date(shiftDate);
        
        // Normalize time so end >= start is safe
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        
        if (end < start) {
          toast.error("End date must be after start date");
          setLoading(false);
          return;
        }

        const isMultiDay = start.getTime() !== end.getTime();
        const seriesId = isMultiDay ? Math.random().toString(36).substring(2, 9) : undefined;
        
        const shiftsToCreate: Array<any> = [];
        let daysCount = 0;
        
        for (let d = new Date(start); d <= end && daysCount < 365; d.setDate(d.getDate() + 1), daysCount++) {
            const dayOfWeek = d.getDay();
            if (!includeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;
            
            for (const uid of userIds) {
              shiftsToCreate.push({
                user_id: uid,
                project_id: scheduleType === 'leave' ? null : (projectId || null),
                shift_date: d.toISOString().split('T')[0],
                shift_start: scheduleType === 'leave' ? '08:00' : shiftStart,
                shift_end: scheduleType === 'leave' ? '17:00' : shiftEnd,
                role: scheduleType === 'leave' ? null : (role || null),
                notes: scheduleType === 'leave' ? \`Leave: \${leaveReason}\${notes ? \` - \${notes}\` : ''}\` : (notes || null),
                status: scheduleType === 'leave' ? 'leave' : 'scheduled',
                shiftName: scheduleType === 'leave' ? leaveReason : undefined,
                seriesId
              });
            }
        }

        if (shiftsToCreate.length === 0) {
            toast.error("No valid days selected (check weekend toggle)");
            setLoading(false);
            return;
        }

        for (const shift of shiftsToCreate) {
          const result = await onCreateShift(shift);
          const shiftId = result?.data?.id || (result && typeof result === 'object' && 'id' in result ? (result as any).id : null);
          if (pendingAttachments.length > 0 && shiftId && scheduleType !== 'leave') {
            await uploadAttachmentsForShift(shiftId);
          }
          if (selectedTasks.length > 0 && shiftId && scheduleType !== 'leave') {
            await assignTasksToShift(shiftId);
          }
        }

        const verb = scheduleType === 'leave' ? 'leave' : 'shift(s)';
        toast.success(\`Created \${shiftsToCreate.length / userIds.length} \${verb} for \${userIds.length} employee(s)\`);
      }

      resetForm();
      setOpen(false);
    } catch (error) {
      toast.error('Failed to create shift');
    } finally {
      setLoading(false);
    }
  };`;

content = content.replace(handleSubmitRegex, newHandleSubmit);

// Helper for UI date range
const dateUiRegex = /<PopoverTrigger asChild>\s*<Button\s*variant="outline"\s*className=\{cn\(\s*'w-full justify-start text-left font-normal',\s*!shiftDate && 'text-muted-foreground'\s*\)\}\s*>\s*<CalendarIcon className="mr-2 h-4 w-4" \/>\s*\{shiftDate \? format\(getParsedDate\(shiftDate\)!, 'PPP'\) : 'Select date'\}\s*<\/Button>\s*<\/PopoverTrigger>\s*<PopoverContent className="w-auto p-0" align="start">\s*<Calendar\s*mode="single"\s*selected=\{getParsedDate\(shiftDate\)\}\s*onSelect=\{\(date\) => setShiftDate\(formatDateStr\(date\)\)\}\s*initialFocus\s*\/>\s*<\/PopoverContent>/g;

const newDateUi = `<PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal h-auto py-2',
                                !shiftDate && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              <div className="flex flex-col items-start gap-1">
                                <span>{shiftDate ? (shiftEndDate && shiftEndDate !== shiftDate ? \`\${format(getParsedDate(shiftDate)!, 'MMM d')} - \${format(getParsedDate(shiftEndDate)!, 'MMM d, yyyy')}\` : format(getParsedDate(shiftDate)!, 'PPP')) : 'Select date range'}</span>
                                {shiftDate && shiftEndDate && shiftEndDate !== shiftDate && (
                                  <span className="text-xs text-muted-foreground">
                                    {Math.round((new Date(shiftEndDate).getTime() - new Date(shiftDate).getTime()) / (1000 * 3600 * 24)) + 1} days (excl. weekends if toggled)
                                  </span>
                                )}
                              </div>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="range"
                              selected={{
                                from: getParsedDate(shiftDate),
                                to: shiftEndDate ? getParsedDate(shiftEndDate) : getParsedDate(shiftDate)
                              }}
                              onSelect={(range) => {
                                if (range?.from) setShiftDate(formatDateStr(range.from));
                                if (range?.to) setShiftEndDate(formatDateStr(range.to));
                                else if (range?.from) setShiftEndDate(formatDateStr(range.from));
                              }}
                              initialFocus
                              numberOfMonths={2}
                            />
                            <div className="p-3 border-t flex items-center space-x-2">
                              <Checkbox 
                                id="include-weekends" 
                                checked={includeWeekends} 
                                onCheckedChange={(checked) => setIncludeWeekends(!!checked)}
                              />
                              <Label htmlFor="include-weekends" className="text-sm font-normal cursor-pointer">Include weekends</Label>
                            </div>
                          </PopoverContent>`;

content = content.replace(dateUiRegex, newDateUi);

fs.writeFileSync(file, content);
console.log('Update complete.');
