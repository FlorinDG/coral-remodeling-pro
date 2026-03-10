"use client";
import { useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/components/time-tracker/integrations/supabase/client';

interface AttachmentLinkProps {
  filePath: string;
  children: ReactNode;
  className?: string;
}

export function AttachmentLink({ filePath, children, className }: AttachmentLinkProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (!error && data) {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };

    fetchSignedUrl();
  }, [filePath]);

  if (loading || !signedUrl) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

interface AttachmentImageProps {
  filePath: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}

export function AttachmentImage({ filePath, alt, className, fallback }: AttachmentImageProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (!error && data) {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };

    fetchSignedUrl();
  }, [filePath]);

  if (loading) {
    return fallback || <div className={className} />;
  }

  if (!signedUrl) {
    return fallback || null;
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
    />
  );
}
