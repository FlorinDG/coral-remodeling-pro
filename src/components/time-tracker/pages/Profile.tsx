"use client";
import { useEffect } from 'react';
import { useRouter } from "@/i18n/routing";

import { useTranslation } from 'react-i18next';
import { Loader2, ArrowLeft, Sun, Moon, Monitor, Globe, Lock, Mail, HelpCircle, MessageSquare } from 'lucide-react';
import { Header } from '@/components/time-tracker/components/Header';
import { Button } from '@/components/time-tracker/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/time-tracker/components/ui/card';
import { Label } from '@/components/time-tracker/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/time-tracker/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/time-tracker/components/ui/accordion';
import { Input } from '@/components/time-tracker/components/ui/input';
import { Textarea } from '@/components/time-tracker/components/ui/textarea';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { useTheme } from '@/components/time-tracker/contexts/ThemeContext';
import { useUserPreferences } from '@/components/time-tracker/hooks/useUserPreferences';
import { languages } from '@/components/time-tracker/i18n';
import { toast } from '@/components/time-tracker/hooks/use-toast';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';
import { translateToEnglish } from '@/components/time-tracker/lib/translateService';
import { useState } from 'react';

const timezones = [
  'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Europe/Brussels', 'Europe/Bucharest', 'Europe/Moscow', 'America/New_York',
  'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai',
];

export default function Profile() {
  const router = useRouter();
  const navigate = useRouter();
  const { t, i18n } = useTranslation();
  const { user, profile, loading, resetPassword } = useAuth();
  const { theme } = useTheme();
  const { preferences, updateLanguage, updateTheme, updateTimezone, isUpdating } = useUserPreferences();
  
  const [newEmail, setNewEmail] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/time-tracker/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleResetPassword = async () => {
    const { error } = await resetPassword(user.email!);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: t('profile.resetLinkSent') });
    }
  };

  const handleEmailChangeRequest = async () => {
    if (!newEmail.trim()) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('approval_requests').insert({
        user_id: user.id,
        requested_by: user.id,
        entity_type: 'email_change',
        request_type: 'email_change',
        request_data: { new_email: newEmail, old_email: user.email },
      });
      
      if (error) throw error;
      toast({ title: t('common.success'), description: t('profile.emailChangeRequested') });
      setNewEmail('');
    } catch (err: unknown) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupportSubmit = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    
    setIsSubmitting(true);
    try {
      const translatedMessage = await translateToEnglish(supportMessage, i18n.language);
      
      const { error } = await supabase.from('support_messages').insert({
        user_id: user.id,
        subject: supportSubject,
        message: supportMessage,
        original_language: i18n.language,
        translated_message: translatedMessage,
      });
      
      if (error) throw error;
      toast({ title: t('common.success'), description: t('profile.messageSent') });
      setSupportSubject('');
      setSupportMessage('');
    } catch (err: unknown) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" onClick={() => router.push("/admin/time-tracker")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('common.back')}
        </Button>
        
        <h1 className="text-3xl font-bold text-foreground mb-8">{t('profile.title')}</h1>

        <div className="space-y-6">
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.personalInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('profile.fullName')}</Label>
                <p className="text-foreground">{profile?.full_name}</p>
              </div>
              <div>
                <Label>{t('profile.email')}</Label>
                <p className="text-foreground">{user.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="w-5 h-5" /> {t('profile.appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('profile.theme')}</Label>
                <Select value={preferences?.theme || theme} onValueChange={updateTheme} disabled={isUpdating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light"><Sun className="w-4 h-4 inline mr-2" />{t('profile.themeLight')}</SelectItem>
                    <SelectItem value="dark"><Moon className="w-4 h-4 inline mr-2" />{t('profile.themeDark')}</SelectItem>
                    <SelectItem value="auto"><Monitor className="w-4 h-4 inline mr-2" />{t('profile.themeAuto')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('profile.language')}</Label>
                <Select value={preferences?.language || i18n.language} onValueChange={updateLanguage} disabled={isUpdating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <Globe className="w-4 h-4 inline mr-2" />{lang.nativeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('profile.timezone')}</Label>
                <Select value={preferences?.timezone || 'UTC'} onValueChange={updateTimezone} disabled={isUpdating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timezones.map(tz => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />{t('profile.security')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('profile.resetPassword')}</Label>
                <p className="text-sm text-muted-foreground mb-2">{t('profile.resetPasswordDesc')}</p>
                <Button onClick={handleResetPassword}>{t('profile.sendResetLink')}</Button>
              </div>
              <div>
                <Label>{t('profile.changeEmail')}</Label>
                <p className="text-sm text-muted-foreground mb-2">{t('profile.changeEmailDesc')}</p>
                <div className="flex gap-2">
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={t('profile.newEmail')} />
                  <Button onClick={handleEmailChangeRequest} disabled={isSubmitting || !newEmail.trim()}>{t('profile.requestChange')}</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5" />{t('profile.faq')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {[1,2,3,4,5].map(i => (
                  <AccordionItem key={i} value={`q${i}`}>
                    <AccordionTrigger>{t(`faq.q${i}`)}</AccordionTrigger>
                    <AccordionContent>{t(`faq.a${i}`)}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />{t('profile.contactSupport')}</CardTitle>
              <CardDescription>{t('profile.contactSupportDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('profile.subject')}</Label>
                <Input value={supportSubject} onChange={e => setSupportSubject(e.target.value)} />
              </div>
              <div>
                <Label>{t('profile.message')}</Label>
                <Textarea value={supportMessage} onChange={e => setSupportMessage(e.target.value)} rows={4} />
              </div>
              <Button onClick={handleSupportSubmit} disabled={isSubmitting || !supportSubject.trim() || !supportMessage.trim()}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('profile.sendMessage')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
