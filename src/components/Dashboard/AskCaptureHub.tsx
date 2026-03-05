'use client';

import { useState } from 'react';
import { Archive, ArrowUpRight, FileText, FolderOpen, Loader2, MessageSquare, Sparkles, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface AskCitation {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  reason: string;
}

interface AskAction {
  type: 'open_item' | 'archive_item' | 'tag_item' | 'assign_project' | 'insert_scratchpad';
  label: string;
  itemId?: string;
  projectId?: string;
  tags?: string[];
  content?: string;
}

interface AskResponse {
  answer: string;
  citations: AskCitation[];
  actions: AskAction[];
  meta?: {
    provider: string;
    model: string | null;
  };
}

interface AskCaptureHubProps {
  onSelectItem?: (id: string) => void;
  onOpenCapture?: (module: string) => void;
}

async function ensureScratchpad(): Promise<{ id: string; title: string; content: string; tags: string[] }> {
  const existing = await fetch('/api/scratchpad');
  if (existing.ok) {
    return existing.json();
  }

  const created = await fetch('/api/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'scratchpad',
      title: 'Scratchpad',
      content: '',
      tags: ['scratchpad'],
      status: 'inbox',
    }),
  });

  if (!created.ok) {
    const body = await created.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to create scratchpad');
  }

  const scratchpad = await created.json();
  return {
    id: scratchpad.id,
    title: scratchpad.title,
    content: scratchpad.content || '',
    tags: Array.isArray(scratchpad.tags) ? scratchpad.tags : ['scratchpad'],
  };
}

export function AskCaptureHub({ onSelectItem, onOpenCapture }: AskCaptureHubProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to ask Capture Hub');
      }
      setResult(data);
    } catch (error) {
      toast.error('Ask Capture Hub failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: AskAction) => {
    setRunningAction(action.label);
    try {
      if (action.type === 'open_item' && action.itemId) {
        onSelectItem?.(action.itemId);
        return;
      }

      if (action.type === 'archive_item' && action.itemId) {
        const response = await fetch(`/api/capture/${action.itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'archived' }),
        });
        if (!response.ok) throw new Error('Failed to archive item');
        toast.success('Item archived');
        return;
      }

      if (action.type === 'tag_item' && action.itemId && action.tags && action.tags.length > 0) {
        const existing = await fetch(`/api/capture/${action.itemId}`);
        const item = await existing.json();
        if (!existing.ok) throw new Error(item.error || 'Failed to load item');

        const mergedTags = Array.from(new Set([...(Array.isArray(item.tags) ? item.tags : []), ...action.tags]));
        const response = await fetch(`/api/capture/${action.itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: mergedTags }),
        });
        if (!response.ok) throw new Error('Failed to update tags');
        toast.success('Tags added');
        return;
      }

      if (action.type === 'assign_project' && action.itemId && action.projectId) {
        const response = await fetch(`/api/capture/${action.itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: action.projectId, status: 'assigned' }),
        });
        if (!response.ok) throw new Error('Failed to assign project');
        toast.success('Item assigned to project');
        return;
      }

      if (action.type === 'insert_scratchpad') {
        const scratchpad = await ensureScratchpad();
        const contentToInsert = action.content || result?.answer || '';
        const updatedContent = `${scratchpad.content.trim()}\n\n## Capture Hub Answer\n${contentToInsert}`.trim();

        const response = await fetch('/api/scratchpad', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: scratchpad.id,
            title: scratchpad.title,
            content: updatedContent,
            tags: Array.from(new Set([...(scratchpad.tags || []), 'scratchpad'])),
          }),
        });
        if (!response.ok) throw new Error('Failed to update scratchpad');
        onOpenCapture?.('scratchpad');
        toast.success('Answer sent to scratchpad');
      }
    } catch (error) {
      toast.error('Action failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/8 via-background to-amber-500/8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          Ask Capture Hub
        </CardTitle>
        <CardDescription>
          Ask questions over your saved captures and act on the answer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What did I save about the launch checklist?"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !loading) {
                void handleAsk();
              }
            }}
          />
          <Button onClick={handleAsk} disabled={loading || !question.trim()} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Ask
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm leading-6">{result.answer}</p>
              {result.meta && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {result.meta.provider}
                  {result.meta.model ? ` • ${result.meta.model}` : ''}
                </div>
              )}
            </div>

            {result.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.actions.map((action) => (
                  <Button
                    key={`${action.type}-${action.label}`}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => void runAction(action)}
                    disabled={runningAction === action.label}
                  >
                    {action.type === 'archive_item' && <Archive className="w-3.5 h-3.5" />}
                    {action.type === 'tag_item' && <Tag className="w-3.5 h-3.5" />}
                    {action.type === 'assign_project' && <FolderOpen className="w-3.5 h-3.5" />}
                    {action.type === 'insert_scratchpad' && <FileText className="w-3.5 h-3.5" />}
                    {action.type === 'open_item' && <ArrowUpRight className="w-3.5 h-3.5" />}
                    {runningAction === action.label ? 'Working...' : action.label}
                  </Button>
                ))}
              </div>
            )}

            {result.citations.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Citations</div>
                <div className="space-y-2">
                  {result.citations.map((citation) => (
                    <button
                      key={citation.id}
                      className="w-full rounded-xl border border-border/70 bg-background/70 p-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => onSelectItem?.(citation.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{citation.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{citation.reason}</div>
                        </div>
                        <ArrowUpRight className="mt-0.5 w-4 h-4 text-muted-foreground" />
                      </div>
                      {citation.snippet && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{citation.snippet}</p>
                      )}
                      {citation.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {citation.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[11px]">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
