// @ts-nocheck
"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText, Download, Check, Clock, AlertCircle,
  ChevronRight, X, Pen, Loader2, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/time-tracker/contexts/AuthContext';
import { getHrDocuments, acknowledgeHrDocument } from '@/app/actions/hr-documents';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Document {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  content: string | null;
  requires_signature: boolean;
  deadline: string | null;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

// ── Signature Pad ────────────────────────────────────────────────────

function SignaturePad({
  onSign,
  onClear,
}: {
  onSign: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'currentColor';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (hasSignature && canvasRef.current) {
      onSign(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear();
  };

  // Set canvas size on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Pen className="w-4 h-4" />
          Your Signature
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearCanvas}
          className="text-xs"
        >
          Clear
        </Button>
      </div>
      <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white dark:bg-black/20">
        <canvas
          ref={canvasRef}
          className="w-full h-32 cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Draw your signature above to acknowledge
      </p>
    </div>
  );
}

// ── Main Documents Component ─────────────────────────────────────────

export function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getHrDocuments();
      setDocuments(data as unknown as Document[]);
    } catch (err) {
      console.warn('[Documents] Error:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleAcknowledge = async () => {
    if (!selectedDoc) return;

    if (selectedDoc.requires_signature && !signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    setAcknowledging(true);
    try {
      await acknowledgeHrDocument(selectedDoc.id, signatureData);

      toast.success('Document acknowledged');
      setSelectedDoc(null);
      setSignatureData(null);
      fetchDocuments();
    } catch (err) {
      toast.error('Failed to acknowledge document');
    } finally {
      setAcknowledging(false);
    }
  };

  // Don't render if table doesn't exist or no documents
  if (loading || documents.length === 0) return null;

  const pendingDocs = documents.filter(d => !d.acknowledged);
  const acknowledgedDocs = documents.filter(d => d.acknowledged);

  return (
    <section className="w-full animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">Documents</h2>
          {pendingDocs.length > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-amber-500 rounded-full">
              {pendingDocs.length}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {/* Pending documents first */}
        {pendingDocs.map(doc => (
          <button
            key={doc.id}
            onClick={() => setSelectedDoc(doc)}
            className="w-full text-left bg-card border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 hover:shadow-sm hover:border-amber-300 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground truncate">{doc.title}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex-shrink-0">
                    Action Required
                  </span>
                </div>
                {doc.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                )}
                {doc.deadline && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Due {formatDistanceToNow(parseISO(doc.deadline), { addSuffix: true })}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          </button>
        ))}

        {/* Acknowledged documents */}
        {acknowledgedDocs.slice(0, 3).map(doc => (
          <button
            key={doc.id}
            onClick={() => setSelectedDoc(doc)}
            className="w-full text-left bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all duration-200 group opacity-75"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-muted-foreground truncate">{doc.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acknowledged {doc.acknowledged_at ? format(parseISO(doc.acknowledged_at), 'MMM d, yyyy') : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Document Detail Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => { setSelectedDoc(null); setSignatureData(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border-0 bg-background/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {selectedDoc?.title}
            </DialogTitle>
            {selectedDoc?.description && (
              <DialogDescription>{selectedDoc.description}</DialogDescription>
            )}
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-4 pt-2">
              {/* Document content */}
              {selectedDoc.content && (
                <div className="bg-muted/30 rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedDoc.content}
                </div>
              )}

              {/* File download link */}
              {selectedDoc.file_url && (
                <a
                  href={selectedDoc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors group"
                >
                  <Download className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-primary group-hover:underline">
                    Download Document
                  </span>
                </a>
              )}

              {/* Status */}
              {selectedDoc.acknowledged ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                  <Check className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="text-sm font-semibold text-secondary">Acknowledged</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedDoc.acknowledged_at
                        ? format(parseISO(selectedDoc.acknowledged_at), 'MMMM d, yyyy \'at\' h:mm a')
                        : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Signature pad (if required) */}
                  {selectedDoc.requires_signature && (
                    <SignaturePad
                      onSign={setSignatureData}
                      onClear={() => setSignatureData(null)}
                    />
                  )}

                  {/* Acknowledge button */}
                  <Button
                    onClick={handleAcknowledge}
                    disabled={acknowledging || (selectedDoc.requires_signature && !signatureData)}
                    className="w-full"
                    size="lg"
                  >
                    {acknowledging ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Acknowledging...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        {selectedDoc.requires_signature ? 'Sign & Acknowledge' : 'Acknowledge'}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
