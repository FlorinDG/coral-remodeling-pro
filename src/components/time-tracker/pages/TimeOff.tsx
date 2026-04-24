// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { useState } from 'react';

import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useTimeOffRequests } from '@/components/time-tracker/hooks/useTimeOffRequests';
import { Header } from '@/components/time-tracker/components/Header';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/time-tracker/components/ui/select';
import { Badge } from '@/components/time-tracker/components/ui/badge';
import { Loader2, Plus, Trash2, Calendar, ArrowLeft } from 'lucide-react';
import { Link } from "@/i18n/routing";
import { useRouter } from "@/i18n/routing";

import { toast } from 'sonner';
import { format } from 'date-fns';

export default function TimeOff() {
  const router = useRouter();
  const navigate = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { requests, loading, createRequest, deleteRequest, refetch } = useTimeOffRequests();
  
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState('Vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push("/admin/hr/time-tracker/auth");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setSubmitting(true);
    const { data, error } = await createRequest(requestType, startDate, endDate, notes);
    setSubmitting(false);

    if (error) {
      toast.error('Failed to create request');
    } else {
      toast.success('Time off request created');
      setShowForm(false);
      setRequestType('Vacation');
      setStartDate('');
      setEndDate('');
      setNotes('');
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteRequest(id);
    if (error) {
      toast.error('Failed to delete request');
    } else {
      toast.success('Request deleted');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-secondary/10 text-secondary border-secondary/20';
      case 'Rejected': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Top back button */}
        <Link 
          href="/admin/hr/time-tracker" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Time Off Requests</h1>
            <p className="text-muted-foreground">Manage your vacation and leave requests</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>New Time Off Request</CardTitle>
              <CardDescription>Submit a request for time off</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Request Type</Label>
                    <Select value={requestType} onValueChange={setRequestType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vacation">Vacation</SelectItem>
                        <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                        <SelectItem value="Personal">Personal</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Submit Request
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No time off requests</h3>
              <p className="text-muted-foreground mb-4">You haven't submitted any time off requests yet.</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{request.request_type}</span>
                        <Badge variant="outline" className={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.start_date), 'MMM d, yyyy')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                      </p>
                      {request.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{request.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(request.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Bottom back button */}
        <div className="mt-8 flex justify-center">
          <Link 
            href="/admin/hr/time-tracker" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
