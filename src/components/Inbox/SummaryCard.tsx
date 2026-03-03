'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SecureMarkdown } from '@/components/ui/secure-markdown';

interface SummaryCardProps {
  content: string;
  maxLength?: number;
  className?: string;
}

export function SummaryCard({ content, maxLength = 3, className }: SummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if content is long enough to need summarization
  const isLongContent = content.length > 500;
  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200); // Average 200 words per minute

  // Auto-generate summary for long content
  useEffect(() => {
    if (isLongContent && !summary && !error) {
      generateSummary();
    }
  }, [content, isLongContent]);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, maxLength }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError('Could not generate summary');
      toast.error('Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  if (!isLongContent) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="w-4 h-4 text-primary" />
          <span>Summary</span>
          {readingTime > 2 && (
            <Badge variant="outline" className="text-xs">
              {readingTime} min read
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {error && (
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSummary}
              className="h-7 px-2 text-xs"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 px-2 text-xs"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Show
              </>
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-muted/50 rounded-lg border text-sm">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating summary...</span>
                </div>
              ) : error ? (
                <div className="text-muted-foreground">
                  {error}
                </div>
              ) : summary ? (
                <SecureMarkdown className="max-w-none">
                  {summary}
                </SecureMarkdown>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
