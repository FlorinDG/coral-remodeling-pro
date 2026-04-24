// @ts-nocheck
"use client";
// @ts-nocheck — Legacy Supabase component, progressive migration to camelCase
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { usePushNotifications } from '@/components/time-tracker/hooks/usePushNotifications';
import { toast } from 'sonner';

export function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('Notifications disabled');
      } else {
        toast.error('Failed to disable notifications');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Notifications enabled! You will receive reminders before your shifts.');
      } else if (permission === 'denied') {
        toast.error('Notification permission denied. Please enable in browser settings.');
      } else {
        toast.error('Failed to enable notifications');
      }
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in your browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Push Notifications
        </CardTitle>
        <CardDescription>
          Get reminded to clock in and out before your scheduled shifts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {isSubscribed ? 'Notifications Enabled' : 'Notifications Disabled'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isSubscribed
                ? "You'll receive reminders 5 minutes before shifts"
                : 'Enable to receive shift reminders'}
            </p>
          </div>
          <Button
            onClick={handleToggle}
            disabled={loading}
            variant={isSubscribed ? 'outline' : 'default'}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              'Disable'
            ) : (
              'Enable'
            )}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {permission === 'denied' && (
          <p className="text-sm text-destructive">
            Notifications are blocked. Please allow notifications in your browser settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
