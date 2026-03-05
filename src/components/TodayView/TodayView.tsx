'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarCheck,
  AlertTriangle,
  Pin,
  Bell,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Archive,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { safeFormatRelative, safeFormatAbsolute, safeIsToday } from '@/lib/safe-date';
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
  reminderSent: boolean;
  pinned: boolean;
  projectId: string | null;
  createdAt: string;
}

interface TodayData {
  overdue: CaptureItem[];
  dueToday: CaptureItem[];
  pinned: CaptureItem[];
  pastReminders: CaptureItem[];
  counts: {
    overdue: number;
    dueToday: number;
    pinned: number;
    pastReminders: number;
    total: number;
  };
}

interface TodaySectionProps {
  title: string;
  icon: React.ReactNode;
  items: CaptureItem[];
  accentClass: string;
  emptyMessage: string;
  onItemClick: (item: CaptureItem) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

function TodaySection({
  title,
  icon,
  items,
  accentClass,
  emptyMessage,
  onItemClick,
  onArchive,
  onDelete,
}: TodaySectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <div className={`flex items-center gap-2 ${accentClass}`}>
            {icon}
            {title}
            <Badge variant="secondary" className="ml-1 text-xs">{items.length}</Badge>
          </div>
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                <ul className="divide-y">
                  {items.map(item => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                    >
                      {/* Type indicator */}
                      <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-white text-xs ${typeBgColors[item.type] ?? 'bg-gray-400'}`}>
                        {item.type[0].toUpperCase()}
                      </div>

                      {/* Main content */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => onItemClick(item)}
                      >
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.dueDate && (
                            <Badge
                              variant="outline"
                              className={`text-xs gap-1 ${safeIsToday(item.dueDate) ? 'border-amber-500 text-amber-600 bg-amber-500/10' : 'border-red-500 text-red-600 bg-red-500/10'}`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {safeIsToday(item.dueDate) ? 'Due today' : `Due ${safeFormatAbsolute(item.dueDate, 'MMM d', 'overdue')}`}
                            </Badge>
                          )}
                          {item.reminder && !item.reminderSent && (
                            <Badge variant="outline" className="text-xs gap-1 border-purple-500 text-purple-600 bg-purple-500/10">
                              <Bell className="w-2.5 h-2.5" />
                              {safeFormatAbsolute(item.reminder, 'MMM d, h:mm a', 'reminder')}
                            </Badge>
                          )}
                          {item.priority !== 'none' && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${item.priority === 'high' ? 'border-purple-400 text-purple-600' : item.priority === 'medium' ? 'border-amber-400 text-amber-600' : 'border-indigo-400 text-indigo-600'}`}
                            >
                              {item.priority}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{safeFormatRelative(item.createdAt)}</span>
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-green-600"
                          title="Archive"
                          onClick={(e) => { e.stopPropagation(); onArchive(item.id); }}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

interface TodayViewProps {
  onSelectItem: (id: string) => void;
}

export function TodayView({ onSelectItem }: TodayViewProps) {
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/today');
      if (!res.ok) throw new Error('Failed to load today data');
      const json: TodayData = await res.json();
      setData(json);
    } catch (err) {
      setError('Failed to load today view. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const handleItemClick = (item: CaptureItem) => {
    onSelectItem(item.id);
  };

  const handleArchive = async (id: string) => {
    try {
      await fetch(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      toast.success('Archived');
      fetchToday();
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'trash' }),
      });
      toast.success('Moved to trash');
      fetchToday();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const today = new Date();
  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const dayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Today</h1>
          </div>
          <p className="text-muted-foreground text-sm">{greeting} · {dayStr}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchToday} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary pills */}
      {data && (
        <div className="flex flex-wrap gap-2">
          {data.counts.overdue > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 text-sm font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {data.counts.overdue} overdue
            </div>
          )}
          {data.counts.dueToday > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm font-medium">
              <Clock className="w-3.5 h-3.5" />
              {data.counts.dueToday} due today
            </div>
          )}
          {data.counts.pinned > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 text-sm font-medium">
              <Pin className="w-3.5 h-3.5" />
              {data.counts.pinned} pinned
            </div>
          )}
          {data.counts.pastReminders > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 text-sm font-medium">
              <Bell className="w-3.5 h-3.5" />
              {data.counts.pastReminders} missed reminders
            </div>
          )}
          {data.counts.total === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-600 text-sm font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All clear for today!
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm">
          {error}
        </div>
      )}

      {/* Sections */}
      {data && (
        <div className="space-y-4">
          {data.counts.overdue > 0 && (
            <TodaySection
              title="Overdue"
              icon={<AlertTriangle className="w-4 h-4" />}
              items={data.overdue}
              accentClass="text-red-600 dark:text-red-400"
              emptyMessage="No overdue items."
              onItemClick={handleItemClick}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}

          <TodaySection
            title="Due Today"
            icon={<Clock className="w-4 h-4" />}
            items={data.dueToday}
            accentClass="text-amber-600 dark:text-amber-400"
            emptyMessage="Nothing due today. Enjoy your day!"
            onItemClick={handleItemClick}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />

          {data.counts.pastReminders > 0 && (
            <TodaySection
              title="Missed Reminders"
              icon={<Bell className="w-4 h-4" />}
              items={data.pastReminders}
              accentClass="text-purple-600 dark:text-purple-400"
              emptyMessage="No missed reminders."
              onItemClick={handleItemClick}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          )}

          <TodaySection
            title="Pinned"
            icon={<Pin className="w-4 h-4" />}
            items={data.pinned}
            accentClass="text-blue-600 dark:text-blue-400"
            emptyMessage="No pinned items. Pin important items to keep them visible here."
            onItemClick={handleItemClick}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* Keyboard hint */}
      <p className="text-xs text-muted-foreground text-center pt-2">
        Click any item to open it in the inbox · Archive or delete with the hover actions
      </p>
    </div>
  );
}
