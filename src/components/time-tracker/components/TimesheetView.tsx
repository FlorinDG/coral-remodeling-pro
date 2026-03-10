"use client";
import { useState, useEffect, useMemo } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/time-tracker/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/time-tracker/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/time-tracker/components/ui/dropdown-menu';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { format, startOfMonth, endOfMonth, parseISO, differenceInMinutes } from 'date-fns';

interface TimesheetEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  task_description: string | null;
  project_id: string | null;
  project_name: string | null;
}

interface ConsolidatedEntry {
  date: string;
  dateFormatted: string;
  project_id: string | null;
  project_name: string | null;
  first_clock_in: string;
  last_clock_out: string | null;
  total_work_minutes: number;
  break_minutes: number;
  has_in_progress: boolean;
}

interface TimesheetViewProps {
  userId?: string;
}

export function TimesheetView({ userId }: TimesheetViewProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const targetUserId = userId || user?.id;

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!targetUserId) return;
      
      setLoading(true);
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(new Date(year, month - 1));

      // Fetch clock entries
      const { data: clockData, error: clockError } = await supabase
        .from('clock_entries')
        .select('id, clock_in_time, clock_out_time, task_description')
        .eq('user_id', targetUserId)
        .gte('clock_in_time', start.toISOString())
        .lte('clock_in_time', end.toISOString())
        .order('clock_in_time', { ascending: true });

      if (clockError || !clockData) {
        setLoading(false);
        return;
      }

      // Fetch shifts linked to these clock entries to get project info
      const clockEntryIds = clockData.map(e => e.id);
      const { data: shiftsData } = await supabase
        .from('scheduled_shifts')
        .select('clock_entry_id, project_id, projects(name)')
        .in('clock_entry_id', clockEntryIds.length > 0 ? clockEntryIds : ['no-match']);

      // Create a map of clock_entry_id to project info
      const shiftProjectMap = new Map<string, { project_id: string | null; project_name: string | null }>();
      shiftsData?.forEach(shift => {
        if (shift.clock_entry_id) {
          shiftProjectMap.set(shift.clock_entry_id, {
            project_id: shift.project_id,
            project_name: (shift.projects as { name: string } | null)?.name || null,
          });
        }
      });

      // Merge clock entries with project info
      const entriesWithProjects: TimesheetEntry[] = clockData.map(entry => ({
        ...entry,
        project_id: shiftProjectMap.get(entry.id)?.project_id || null,
        project_name: shiftProjectMap.get(entry.id)?.project_name || null,
      }));

      setEntries(entriesWithProjects);
      setLoading(false);
    };

    fetchEntries();
  }, [targetUserId, selectedMonth]);

  // Consolidate entries by date and project, calculate breaks
  const consolidatedEntries = useMemo(() => {
    const grouped = new Map<string, {
      entries: TimesheetEntry[];
      project_id: string | null;
      project_name: string | null;
    }>();

    // Group entries by date and project
    entries.forEach(entry => {
      const date = format(parseISO(entry.clock_in_time), 'yyyy-MM-dd');
      const projectKey = entry.project_id || 'no-project';
      const key = `${date}|${projectKey}`;

      const existing = grouped.get(key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        grouped.set(key, {
          entries: [entry],
          project_id: entry.project_id,
          project_name: entry.project_name,
        });
      }
    });

    // Calculate consolidated data for each group
    const result: ConsolidatedEntry[] = [];
    
    grouped.forEach((group) => {
      // Sort entries by clock_in_time
      const sortedEntries = group.entries.sort((a, b) => 
        new Date(a.clock_in_time).getTime() - new Date(b.clock_in_time).getTime()
      );

      const firstEntry = sortedEntries[0];
      const lastEntry = sortedEntries[sortedEntries.length - 1];
      const date = format(parseISO(firstEntry.clock_in_time), 'yyyy-MM-dd');
      
      // Calculate total work minutes
      let totalWorkMinutes = 0;
      sortedEntries.forEach(entry => {
        if (entry.clock_out_time) {
          totalWorkMinutes += differenceInMinutes(
            parseISO(entry.clock_out_time), 
            parseISO(entry.clock_in_time)
          );
        }
      });

      // Calculate break minutes (gaps between consecutive entries)
      let breakMinutes = 0;
      for (let i = 1; i < sortedEntries.length; i++) {
        const prevEntry = sortedEntries[i - 1];
        const currEntry = sortedEntries[i];
        if (prevEntry.clock_out_time) {
          const gap = differenceInMinutes(
            parseISO(currEntry.clock_in_time),
            parseISO(prevEntry.clock_out_time)
          );
          if (gap > 0) {
            breakMinutes += gap;
          }
        }
      }

      const hasInProgress = sortedEntries.some(e => !e.clock_out_time);

      result.push({
        date,
        dateFormatted: format(parseISO(date), 'dd/MM/yyyy'),
        project_id: group.project_id,
        project_name: group.project_name,
        first_clock_in: format(parseISO(firstEntry.clock_in_time), 'HH:mm'),
        last_clock_out: lastEntry.clock_out_time 
          ? format(parseISO(lastEntry.clock_out_time), 'HH:mm') 
          : null,
        total_work_minutes: totalWorkMinutes,
        break_minutes: breakMinutes,
        has_in_progress: hasInProgress,
      });
    });

    // Sort by date descending
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const totalHours = useMemo(() => {
    let totalMins = 0;
    entries.forEach(entry => {
      if (entry.clock_out_time) {
        totalMins += differenceInMinutes(parseISO(entry.clock_out_time), parseISO(entry.clock_in_time));
      }
    });
    return (totalMins / 60).toFixed(1);
  }, [entries]);

  const exportToXLSX = () => {
    const headers = ['Date', 'Clock In', 'Clock Out', 'Break', 'Total Hours', 'Project'];
    const rows = consolidatedEntries.map(entry => [
      entry.dateFormatted,
      entry.first_clock_in,
      entry.last_clock_out || 'In progress',
      formatMinutes(entry.break_minutes),
      entry.has_in_progress ? 'In progress' : formatMinutes(entry.total_work_minutes),
      entry.project_name || '-',
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheet');
    
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 20 }
    ];
    
    XLSX.writeFile(workbook, `timesheet-${selectedMonth}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    
    doc.setFontSize(18);
    doc.text(`Timesheet - ${monthLabel}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Total Hours: ${totalHours}`, 14, 32);
    doc.text(`Total Days: ${consolidatedEntries.length}`, 14, 38);
    
    const tableData = consolidatedEntries.map(entry => [
      entry.dateFormatted,
      entry.first_clock_in,
      entry.last_clock_out || 'In progress',
      formatMinutes(entry.break_minutes),
      entry.has_in_progress ? 'In progress' : formatMinutes(entry.total_work_minutes),
      entry.project_name || '-',
    ]);

    autoTable(doc, {
      head: [['Date', 'Clock In', 'Clock Out', 'Break', 'Total', 'Project']],
      body: tableData,
      startY: 45,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`timesheet-${selectedMonth}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle>Timesheet</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToXLSX}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download XLSX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : consolidatedEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No timesheet entries for this month
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-4">
              Total: <span className="font-semibold text-foreground">{totalHours} hours</span> across {consolidatedEntries.length} days
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Project</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedEntries.map((entry, idx) => (
                    <TableRow key={`${entry.date}-${entry.project_id || 'none'}-${idx}`}>
                      <TableCell className="font-medium">
                        {entry.dateFormatted}
                      </TableCell>
                      <TableCell>{entry.first_clock_in}</TableCell>
                      <TableCell>
                        {entry.last_clock_out || <span className="text-primary">In progress</span>}
                      </TableCell>
                      <TableCell>{formatMinutes(entry.break_minutes)}</TableCell>
                      <TableCell>
                        {entry.has_in_progress ? (
                          <span className="text-primary">In progress</span>
                        ) : (
                          formatMinutes(entry.total_work_minutes)
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.project_name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
