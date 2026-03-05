'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Check,
  Archive,
  Trash2,
  Loader2,
  RefreshCw,
  ArrowRight,
  Inbox,
  AlertTriangle,
  Clock,
  Star,
  Sparkles,
  SkipForward,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { safeFormatRelative, safeFormatAbsolute } from '@/lib/safe-date';
import { typeBgColors } from '@/lib/type-colors';

interface CaptureItem {
  id: string;
  type: string;
  title: string;
  content: string | null;
  tags: string[];
  priority: string;
  status: string;
  dueDate: string | null;
  reminder: string | null;
  pinned: boolean;
  createdAt: string;
}

type ReviewPhase = 'intro' | 'inbox' | 'overdue' | 'done';

interface PhaseConfig {
  id: ReviewPhase;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const PHASES: PhaseConfig[] = [
  {
    id: 'intro',
    label: 'Start Review',
    icon: <Star className="w-4 h-4" />,
    description: "Let's clear your head",
    color: 'text-indigo-500',
  },
  {
    id: 'inbox',
    label: 'Process Inbox',
    icon: <Inbox className="w-4 h-4" />,
    description: 'Triage unprocessed items',
    color: 'text-blue-500',
  },
  {
    id: 'overdue',
    label: 'Overdue Items',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Handle past-due items',
    color: 'text-red-500',
  },
  {
    id: 'done',
    label: 'Complete',
    icon: <Check className="w-4 h-4" />,
    description: 'Review finished!',
    color: 'text-green-500',
  },
];

interface ReviewItemCardProps {
  item: CaptureItem;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSkip: (id: string) => void;
  onAssign: (id: string) => void;
  onPreview: (id: string) => void;
  processing?: boolean;
}

function ReviewItemCard({
  item,
  onArchive,
  onDelete,
  onSkip,
  onAssign,
  onPreview,
  processing,
}: ReviewItemCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-1 w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${typeBgColors[item.type] ?? 'bg-gray-400'}`}>
            {item.type[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-snug">{item.title}</p>
            {item.content && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
              {item.dueDate && (
                <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500">
                  <Clock className="w-2.5 h-2.5" />
                  {safeFormatAbsolute(item.dueDate, 'MMM d', 'overdue')}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{safeFormatRelative(item.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            size="sm"
            variant="default"
            className="gap-1.5 flex-1 min-w-[100px]"
            onClick={() => onAssign(item.id)}
            disabled={processing}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Assign
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 flex-1 min-w-[80px] text-green-600 border-green-500 hover:bg-green-500/10"
            onClick={() => onArchive(item.id)}
            disabled={processing}
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 flex-1 min-w-[80px] text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => onDelete(item.id)}
            disabled={processing}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => onSkip(item.id)}
            disabled={processing}
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => onPreview(item.id)}
            disabled={processing}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DailyReviewProps {
  onSelectItem: (id: string) => void;
  onClose?: () => void;
}

export function DailyReview({ onSelectItem, onClose }: DailyReviewProps) {
  const [phase, setPhase] = useState<ReviewPhase>('intro');
  const [inboxItems, setInboxItems] = useState<CaptureItem[]>([]);
  const [overdueItems, setOverdueItems] = useState<CaptureItem[]>([]);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({ archived: 0, deleted: 0, assigned: 0, skipped: 0 });

  const fetchReviewData = useCallback(async () => {
    setLoading(true);
    try {
      const [inboxRes, todayRes] = await Promise.all([
        fetch('/api/inbox?status=inbox&limit=20&sortBy=oldest'),
        fetch('/api/today'),
      ]);

      if (inboxRes.ok) {
        const data = await inboxRes.json();
        setInboxItems(data.items || []);
      }
      if (todayRes.ok) {
        const data = await todayRes.json();
        setOverdueItems(data.overdue || []);
      }
    } catch {
      toast.error('Failed to load review data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  const markProcessed = (id: string) => {
    setProcessedIds(prev => new Set([...prev, id]));
  };

  const handleArchive = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      markProcessed(id);
      setStats(s => ({ ...s, archived: s.archived + 1 }));
    } catch {
      toast.error('Failed to archive');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'trash' }),
      });
      markProcessed(id);
      setStats(s => ({ ...s, deleted: s.deleted + 1 }));
    } catch {
      toast.error('Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async (id: string) => {
    // Navigate to the item's detail view in the inbox, where user can assign
    markProcessed(id);
    setStats(s => ({ ...s, assigned: s.assigned + 1 }));
    onSelectItem(id);
  };

  const handleSkip = (id: string) => {
    markProcessed(id);
    setStats(s => ({ ...s, skipped: s.skipped + 1 }));
  };

  const handlePreview = (id: string) => {
    onSelectItem(id);
  };

  const visibleInbox = inboxItems.filter(i => !processedIds.has(i.id));
  const visibleOverdue = overdueItems.filter(i => !processedIds.has(i.id));

  const phaseIndex = PHASES.findIndex(p => p.id === phase);
  const progress = Math.round((phaseIndex / (PHASES.length - 1)) * 100);

  const nextPhase = () => {
    const next = PHASES[phaseIndex + 1];
    if (next) setPhase(next.id);
  };

  const prevPhase = () => {
    const prev = PHASES[phaseIndex - 1];
    if (prev) setPhase(prev.id);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Daily Review</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchReviewData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {PHASES.map((p, i) => (
            <span
              key={p.id}
              className={`flex items-center gap-1 cursor-pointer transition-colors ${i <= phaseIndex ? 'text-foreground font-medium' : ''}`}
              onClick={() => setPhase(p.id)}
            >
              {p.icon}
              <span className="hidden sm:inline">{p.label}</span>
            </span>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Phase Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto space-y-4"
        >
          {phase === 'intro' && (
            <div className="flex flex-col items-center text-center py-8 gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Ready to review?</h2>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  This guided review helps you process your inbox, tackle overdue items,
                  and start your day with a clear head.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm text-sm">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Inbox className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span><strong>{inboxItems.length}</strong> inbox items</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span><strong>{overdueItems.length}</strong> overdue</span>
                </div>
              </div>
              <Button size="lg" onClick={nextPhase} className="gap-2 w-full max-w-sm">
                Start Review <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}

          {phase === 'inbox' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-blue-500" />
                    Inbox
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {visibleInbox.length} remaining · Archive, assign, or delete each item
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : visibleInbox.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Check className="w-12 h-12 text-green-500" />
                  <p className="font-medium">Inbox cleared!</p>
                  <p className="text-sm text-muted-foreground">All items have been processed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleInbox.slice(0, 10).map(item => (
                    <ReviewItemCard
                      key={item.id}
                      item={item}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                      onSkip={handleSkip}
                      onAssign={handleAssign}
                      onPreview={handlePreview}
                      processing={actionLoading === item.id}
                    />
                  ))}
                  {visibleInbox.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">
                      + {visibleInbox.length - 10} more items (continue reviewing to see them)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === 'overdue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Overdue
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {visibleOverdue.length} remaining · Address or reschedule past-due items
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : visibleOverdue.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Check className="w-12 h-12 text-green-500" />
                  <p className="font-medium">No overdue items!</p>
                  <p className="text-sm text-muted-foreground">You're all caught up.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleOverdue.map(item => (
                    <ReviewItemCard
                      key={item.id}
                      item={item}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                      onSkip={handleSkip}
                      onAssign={handleAssign}
                      onPreview={handlePreview}
                      processing={actionLoading === item.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center text-center py-8 gap-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Review complete!</h2>
                <p className="text-muted-foreground mt-2">Great work. Here's what you did:</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm text-sm">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Archive className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span><strong>{stats.archived}</strong> archived</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Trash2 className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span><strong>{stats.deleted}</strong> deleted</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span><strong>{stats.assigned}</strong> assigned</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <SkipForward className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span><strong>{stats.skipped}</strong> skipped</span>
                </div>
              </div>
              {onClose && (
                <Button size="lg" onClick={onClose} className="w-full max-w-sm gap-2">
                  Close Review <ArrowRight className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {phase !== 'intro' && phase !== 'done' && (
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="ghost" onClick={prevPhase} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button onClick={nextPhase} className="gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
