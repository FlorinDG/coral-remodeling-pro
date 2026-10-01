"use client";
/** A finger/mouse signature pad. Emits a PNG data URL after each stroke. Shared by the crew's
 *  document acknowledgement and the work-order signature (WO-3). */
import { useEffect, useRef, useState } from 'react';
import { Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SignaturePad({
  onSign,
  onClear,
  label = 'Your Signature',
  clearLabel = 'Clear',
  hint = 'Draw your signature above to acknowledge',
  large = false,
}: {
  onSign: (dataUrl: string) => void;
  onClear: () => void;
  label?: string;
  clearLabel?: string;
  hint?: string;
  /** A finger signature is imprecise: a tall pad (≈ half the screen, at least 16rem) with a thicker line. */
  large?: boolean;
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
    ctx.lineWidth = large ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
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

  // The drawing surface matches the box on screen — on mount, and again when the box changes size
  // (turning the phone). Resizing clears a canvas, so a half-drawn signature is cleared visibly
  // and the parent told, rather than kept at the wrong scale.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width), h = Math.round(rect.height);
      if (canvas.width === w && canvas.height === h) return;
      const hadContent = canvas.width > 0 && canvas.height > 0;
      canvas.width = w;
      canvas.height = h;
      if (hadContent) { setHasSignature(false); onClear(); }
    };
    canvas.width = 0; canvas.height = 0;
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Pen className="w-4 h-4" />
          {label}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearCanvas}
          className="text-sm"
        >
          {clearLabel}
        </Button>
      </div>
      <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className={`w-full ${large ? 'h-[max(16rem,45vh)]' : 'h-32'} cursor-crosshair touch-none`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="text-sm text-muted-foreground text-center">
        {hint}
      </p>
    </div>
  );
}

