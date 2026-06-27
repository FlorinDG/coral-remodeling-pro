"use client";
import { useState, useEffect, ReactNode } from 'react';

interface AttachmentLinkProps {
  filePath: string;
  children: ReactNode;
  className?: string;
}

export function AttachmentLink({ filePath, children, className }: AttachmentLinkProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filePath) {
      setLoading(false);
      return;
    }

    if (filePath.startsWith('http')) {
      setSignedUrl(filePath);
    } else if (filePath.startsWith('/api/files/')) {
      setSignedUrl(filePath);
    } else {
      // Assume Blob storage path or legacy path, use api route
      setSignedUrl(`/api/files/${filePath.replace(/^\/+/, '')}`);
    }
    setLoading(false);
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
    if (!filePath) {
      setLoading(false);
      return;
    }

    if (filePath.startsWith('http')) {
      setSignedUrl(filePath);
    } else if (filePath.startsWith('/api/files/')) {
      setSignedUrl(filePath);
    } else {
      // Assume Blob storage path or legacy path, use api route
      setSignedUrl(`/api/files/${filePath.replace(/^\/+/, '')}`);
    }
    setLoading(false);
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
