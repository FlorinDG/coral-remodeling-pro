"use client";
import { useState } from 'react';
import { Loader2, Check, X, Clock, FileText, Calendar, ClipboardList, CheckCheck } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/time-tracker/components/ui/tabs';
import { Checkbox } from '@/components/time-tracker/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/time-tracker/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/time-tracker/components/ui/alert-dialog';
import { useApprovalRequests, ApprovalRequest } from '@/components/time-tracker/hooks/useApprovalRequests';
import { useTimeOffRequests } from '@/components/time-tracker/hooks/useTimeOffRequests';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export function ApprovalManager() {
  const { requests, loading, approveRequest, rejectRequest, bulkApprove, bulkReject, refetch } = useApprovalRequests();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [selectedTimeOff, setSelectedTimeOff] = useState<Set<string>>(new Set());

  // Fetch all pending time off requests from all users (admin view)
  const [timeOffRequests, setTimeOffRequests] = useState<Array<{
    id: string;
    user_id: string;
    request_type: string;
    start_date: string;
    end_date: string;
    notes: string | null;
    status: string;
    created_at: string;
    user_profile?: { full_name: string } | null;
  }>>([]);
  const [timeOffLoading, setTimeOffLoading] = useState(true);

  // Fetch time off requests
  useState(() => {
    const fetchTimeOffRequests = async () => {
      setTimeOffLoading(true);
      const { data, error } = await supabase
        .from('time_off_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Get profiles
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds.length > 0 ? userIds : ['no-match']);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        setTimeOffRequests(data.map(r => ({
          ...r,
          user_profile: profileMap.get(r.user_id) || null,
        })));
      }
      setTimeOffLoading(false);
    };
    fetchTimeOffRequests();
  });

  const handleApprove = async () => {
    if (!confirmAction) return;
    setProcessingId(confirmAction.id);

    const { error } = await approveRequest(confirmAction.id);
    if (error) {
      toast.error('Failed to approve request');
    } else {
      toast.success('Request approved');
    }
    setProcessingId(null);
    setConfirmAction(null);
  };

  const handleReject = async () => {
    if (!confirmAction) return;
    setProcessingId(confirmAction.id);

    const { error } = await rejectRequest(confirmAction.id);
    if (error) {
      toast.error('Failed to reject request');
    } else {
      toast.success('Request rejected');
    }
    setProcessingId(null);
    setConfirmAction(null);
  };

  const handleBulkAction = async () => {
    if (!bulkConfirmAction || selectedRequests.size === 0) return;
    setBulkProcessing(true);

    const ids = Array.from(selectedRequests);
    
    if (bulkConfirmAction === 'approve') {
      const { error, successCount } = await bulkApprove(ids);
      if (error) {
        toast.error('Failed to approve some requests');
      } else {
        toast.success(`${successCount} request(s) approved`);
      }
    } else {
      const { error, successCount } = await bulkReject(ids);
      if (error) {
        toast.error('Failed to reject some requests');
      } else {
        toast.success(`${successCount} request(s) rejected`);
      }
    }

    setSelectedRequests(new Set());
    setBulkProcessing(false);
    setBulkConfirmAction(null);
  };

  const handleBulkTimeOffAction = async (action: 'Approved' | 'Rejected') => {
    if (selectedTimeOff.size === 0) return;
    setBulkProcessing(true);

    const ids = Array.from(selectedTimeOff);
    
    const { error } = await supabase
      .from('time_off_requests')
      .update({ status: action })
      .in('id', ids);

    if (error) {
      toast.error(`Failed to ${action.toLowerCase()} some requests`);
    } else {
      toast.success(`${ids.length} request(s) ${action.toLowerCase()}`);
      setTimeOffRequests(prev => prev.map(r => 
        ids.includes(r.id) ? { ...r, status: action } : r
      ));
    }

    setSelectedTimeOff(new Set());
    setBulkProcessing(false);
  };

  const handleTimeOffAction = async (id: string, action: 'Approved' | 'Rejected') => {
    setProcessingId(id);
    const { error } = await supabase
      .from('time_off_requests')
      .update({ status: action })
      .eq('id', id);

    if (error) {
      toast.error(`Failed to ${action.toLowerCase()} request`);
    } else {
      toast.success(`Request ${action.toLowerCase()}`);
      setTimeOffRequests(prev => prev.map(r => r.id === id ? { ...r, status: action } : r));
    }
    setProcessingId(null);
  };

  const toggleRequestSelection = (id: string) => {
    setSelectedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTimeOffSelection = (id: string) => {
    setSelectedTimeOff(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllRequests = (checked: boolean) => {
    if (checked) {
      setSelectedRequests(new Set(pendingApprovals.map(r => r.id)));
    } else {
      setSelectedRequests(new Set());
    }
  };

  const toggleAllTimeOff = (checked: boolean) => {
    if (checked) {
      setSelectedTimeOff(new Set(pendingTimeOff.map(r => r.id)));
    } else {
      setSelectedTimeOff(new Set());
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'shift_edit': return ClipboardList;
      case 'late_entry': return Clock;
      case 'time_off': return Calendar;
      default: return FileText;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'shift_edit': return 'Shift Edit';
      case 'late_entry': return 'Late Entry';
      case 'time_off': return 'Time Off';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'Pending':
        return <Badge variant="outline" className="text-secondary border-secondary/30">Pending</Badge>;
      case 'approved':
      case 'Approved':
        return <Badge variant="outline" className="text-primary border-primary/30">Approved</Badge>;
      case 'rejected':
      case 'Rejected':
        return <Badge variant="outline" className="text-destructive border-destructive/30">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingApprovals = requests.filter(r => r.status === 'pending');
  const pendingTimeOff = timeOffRequests.filter(r => r.status === 'Pending');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Approval Requests
        </CardTitle>
        <CardDescription>Review and manage pending approvals</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="time-off" className="space-y-4">
          <TabsList>
            <TabsTrigger value="time-off" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Time Off
              {pendingTimeOff.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {pendingTimeOff.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shifts" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" />
              Shifts & Entries
              {pendingApprovals.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {pendingApprovals.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="time-off">
            {timeOffLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : timeOffRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No time off requests
              </div>
            ) : (
              <div className="space-y-3">
                {/* Bulk Actions for Time Off */}
                {pendingTimeOff.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id="select-all-timeoff"
                      checked={selectedTimeOff.size === pendingTimeOff.length && pendingTimeOff.length > 0}
                      onCheckedChange={toggleAllTimeOff}
                    />
                    <label htmlFor="select-all-timeoff" className="text-sm font-medium cursor-pointer">
                      Select all pending ({pendingTimeOff.length})
                    </label>
                    {selectedTimeOff.size > 0 && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {selectedTimeOff.size} selected
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-primary border-primary/30 hover:bg-primary/10"
                          onClick={() => handleBulkTimeOffAction('Approved')}
                          disabled={bulkProcessing}
                        >
                          {bulkProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCheck className="h-4 w-4 mr-1" />
                          )}
                          Approve All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleBulkTimeOffAction('Rejected')}
                          disabled={bulkProcessing}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject All
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeOffRequests.map(request => (
                        <TableRow key={request.id}>
                          <TableCell>
                            {request.status === 'Pending' && (
                              <Checkbox
                                checked={selectedTimeOff.has(request.id)}
                                onCheckedChange={() => toggleTimeOffSelection(request.id)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {request.user_profile?.full_name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{request.request_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(request.start_date), 'MMM d')} - {format(parseISO(request.end_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {request.notes || '-'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(request.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            {request.status === 'Pending' && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleTimeOffAction(request.id, 'Approved')}
                                  disabled={processingId === request.id}
                                >
                                  {processingId === request.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleTimeOffAction(request.id, 'Rejected')}
                                  disabled={processingId === request.id}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="shifts">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No approval requests
              </div>
            ) : (
              <div className="space-y-3">
                {/* Bulk Actions for Shifts & Entries */}
                {pendingApprovals.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id="select-all-requests"
                      checked={selectedRequests.size === pendingApprovals.length && pendingApprovals.length > 0}
                      onCheckedChange={toggleAllRequests}
                    />
                    <label htmlFor="select-all-requests" className="text-sm font-medium cursor-pointer">
                      Select all pending ({pendingApprovals.length})
                    </label>
                    {selectedRequests.size > 0 && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {selectedRequests.size} selected
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-primary border-primary/30 hover:bg-primary/10"
                          onClick={() => setBulkConfirmAction('approve')}
                          disabled={bulkProcessing}
                        >
                          <CheckCheck className="h-4 w-4 mr-1" />
                          Approve All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setBulkConfirmAction('reject')}
                          disabled={bulkProcessing}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject All
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map(request => {
                        const Icon = getRequestTypeIcon(request.request_type);
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              {request.status === 'pending' && (
                                <Checkbox
                                  checked={selectedRequests.has(request.id)}
                                  onCheckedChange={() => toggleRequestSelection(request.id)}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {getRequestTypeLabel(request.request_type)}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {request.user_profile?.full_name || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {request.requester_profile?.full_name || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {format(parseISO(request.created_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(request.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              {request.status === 'pending' && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => setConfirmAction({ id: request.id, action: 'approve' })}
                                    disabled={processingId === request.id}
                                  >
                                    {processingId === request.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setConfirmAction({ id: request.id, action: 'reject' })}
                                    disabled={processingId === request.id}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Single Item Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'approve' ? 'Approve Request?' : 'Reject Request?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'approve'
                ? 'This will approve the request and allow the changes to be applied.'
                : 'This will reject the request. The requester will be notified.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction?.action === 'approve' ? handleApprove : handleReject}
              className={confirmAction?.action === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={!!bulkConfirmAction} onOpenChange={() => setBulkConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkConfirmAction === 'approve' ? 'Approve All Selected?' : 'Reject All Selected?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirmAction === 'approve'
                ? `This will approve ${selectedRequests.size} request(s) and allow the changes to be applied.`
                : `This will reject ${selectedRequests.size} request(s). The requesters will be notified.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              className={bulkConfirmAction === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
              disabled={bulkProcessing}
            >
              {bulkProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {bulkConfirmAction === 'approve' ? `Approve ${selectedRequests.size}` : `Reject ${selectedRequests.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}