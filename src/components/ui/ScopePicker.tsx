import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type EditScope = 'occurrence' | 'following' | 'series';

interface ScopePickerProps {
  value: EditScope;
  onChange: (value: EditScope) => void;
  disabled?: boolean;
  seriesId?: string | null;
  actionName?: string;
  countContext?: string;
}

export function ScopePicker({ 
  value, 
  onChange, 
  disabled = false, 
  seriesId, 
  actionName = 'Apply changes to',
  countContext
}: ScopePickerProps) {
  
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">{actionName}</Label>
      <RadioGroup 
        value={value} 
        onValueChange={(val) => onChange(val as EditScope)}
        disabled={disabled}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="occurrence" id="scope-occurrence" />
          <Label htmlFor="scope-occurrence" className="font-normal cursor-pointer">
            This occurrence only
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="following" id="scope-following" disabled={!seriesId} />
          <Label 
            htmlFor="scope-following" 
            className={`font-normal ${!seriesId ? 'opacity-50' : 'cursor-pointer'}`}
          >
            This and following occurrences
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="series" id="scope-series" disabled={!seriesId} />
          <Label 
            htmlFor="scope-series" 
            className={`font-normal ${!seriesId ? 'opacity-50' : 'cursor-pointer'}`}
          >
            Entire series
            {!seriesId && <span className="text-xs text-muted-foreground ml-2">(Not part of a series)</span>}
          </Label>
        </div>
      </RadioGroup>
      {countContext && (
        <p className="text-xs text-muted-foreground italic mt-2">{countContext}</p>
      )}
    </div>
  );
}
