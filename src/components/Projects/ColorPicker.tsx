'use client';

import { Check } from 'lucide-react';
import { Label } from '@/components/ui/label';

export const PROJECT_COLOR_PRESETS = [
  { value: '#6366f1', name: 'Indigo' },
  { value: '#8b5cf6', name: 'Violet' },
  { value: '#ec4899', name: 'Pink' },
  { value: '#ef4444', name: 'Red' },
  { value: '#f97316', name: 'Orange' },
  { value: '#eab308', name: 'Yellow' },
  { value: '#22c55e', name: 'Green' },
  { value: '#14b8a6', name: 'Teal' },
  { value: '#06b6d4', name: 'Cyan' },
  { value: '#3b82f6', name: 'Blue' },
  { value: '#64748b', name: 'Slate' },
] as const;

export const DEFAULT_PROJECT_COLOR = '#6366f1';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label = 'Color' }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select project color">
        {PROJECT_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            role="radio"
            aria-checked={value === preset.value}
            aria-label={preset.name}
            title={preset.name}
            className={`w-8 h-8 rounded-lg border-2 transition-all duration-150 flex items-center justify-center ${
              value === preset.value
                ? 'scale-110 border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground/20'
                : 'border-transparent hover:scale-105 hover:border-foreground/30'
            }`}
            style={{ backgroundColor: preset.value }}
            onClick={() => onChange(preset.value)}
          >
            {value === preset.value && (
              <Check className="w-4 h-4 text-white drop-shadow-sm" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
