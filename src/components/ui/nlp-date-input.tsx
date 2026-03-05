'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { parseDateNL, previewDateNL } from '@/lib/parse-date-nl';
import { CalendarCheck, AlertCircle } from 'lucide-react';

interface NlpDateInputProps {
  value: string;
  onChange: (isoString: string | null) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

/**
 * A text input that accepts natural language dates (powered by chrono-node).
 * Shows a live parsed preview below the input.
 *
 * @example
 *   <NlpDateInput value={dueDate} onChange={setDueDate} placeholder="tomorrow at 3pm" />
 */
export function NlpDateInput({
  value,
  onChange,
  placeholder = 'e.g. tomorrow at 3pm, next Monday, in 2 hours',
  className,
  id,
}: NlpDateInputProps) {
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  // Sync external ISO value → display in the input as the preview text
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setRaw(d.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        }));
        setPreview(null);
        setInvalid(false);
      }
    } else {
      setRaw('');
      setPreview(null);
      setInvalid(false);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setRaw(text);

    if (!text.trim()) {
      setPreview(null);
      setInvalid(false);
      onChange(null);
      return;
    }

    const parsed = parseDateNL(text);
    if (parsed) {
      const humanPreview = previewDateNL(text);
      setPreview(humanPreview);
      setInvalid(false);
      onChange(parsed);
    } else {
      setPreview(null);
      setInvalid(true);
      onChange(null);
    }
  };

  return (
    <div className="space-y-1">
      <Input
        id={id}
        value={raw}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        aria-invalid={invalid}
        aria-describedby={id ? `${id}-preview` : undefined}
      />
      {preview && (
        <p
          id={id ? `${id}-preview` : undefined}
          className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
        >
          <CalendarCheck className="w-3 h-3 flex-shrink-0" />
          {preview}
        </p>
      )}
      {invalid && raw.trim() && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          Date not recognised — try "tomorrow", "next Monday", or "Jan 15"
        </p>
      )}
    </div>
  );
}
