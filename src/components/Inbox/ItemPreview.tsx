'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  X,
  Trash2,
  Save,
  ExternalLink,
  Plus,
  Clock,
  Loader2,
  Pin,
  Copy,
  Check,
  RotateCcw,
  MoreHorizontal,
  FileText,
  Bell,
  Calendar as CalendarIcon,
  Link2,
  Unlink,
  Link2Off,
  FolderOpen,
  ZoomIn,
  X as XIcon,
  Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { safeFormatRelative, safeFormatAbsolute, safeParseDate, safeIsPast, safeIsToday, safeIsTomorrow } from '@/lib/safe-date';
import { SecureMarkdown } from '@/components/ui/secure-markdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LinkCreator } from '@/components/Knowledge/LinkCreator';
import { SummaryCard } from '@/components/Inbox/SummaryCard';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';

interface CaptureItem {
  id: string;
  type: string;
  title: string;
  content: string | null;
  extractedText: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  metadata: any;
  tags: string[];
  priority: string;
  status: string;
  assignedTo: string | null;
  projectId: string | null;
  dueDate: string | null;
  reminder: string | null;
  reminderSent?: boolean;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

interface LinkedItem {
  id: string;
  relationType: string;
  note: string | null;
  sourceId?: string;
  targetId?: string;
  sourceItem?: {
    id: string;
    title: string;
    type: string;
    status: string;
  } | null;
  targetItem?: {
    id: string;
    title: string;
    type: string;
    status: string;
  } | null;
}

interface ItemPreviewProps {
  item: CaptureItem;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  onPin?: () => void;
  onRestore?: () => void;
  onArchive?: () => void;
  onSelectItem?: (id: string) => void;
  typeIcon: React.ReactNode;
  typeColor: string;
}

const priorityOptions = [
  { value: 'none', label: 'No Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const statusOptions = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'archived', label: 'Archived' },
  { value: 'trash', label: 'Trash' },
];

const assignOptions = [
  { value: 'none', label: 'Unassigned' },
  { value: 'Projects', label: 'Projects' },
  { value: 'Tasks', label: 'Tasks' },
  { value: 'Review', label: 'Review' },
];

interface Project {
  id: string;
  name: string;
  color: string;
}

export function ItemPreview({
  item,
  onClose,
  onDelete,
  onUpdate,
  onPin,
  onRestore,
  onArchive,
  onSelectItem,
  typeIcon,
  typeColor,
}: ItemPreviewProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content || '');
  const [tags, setTags] = useState<string[]>(item.tags);
  const [tagInput, setTagInput] = useState('');
  const [priority, setPriority] = useState(item.priority);
  const [status, setStatus] = useState(item.status);
  const [assignedTo, setAssignedTo] = useState(item.assignedTo || '');
  const [projectId, setProjectId] = useState<string | null>(item.projectId || null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(item.dueDate || null);
  const [reminder, setReminder] = useState<string | null>(item.reminder || null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<LinkedItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [copiedExtracted, setCopiedExtracted] = useState(false);

  const { on } = useWebSocket();

  // Reset image error when item changes
  useEffect(() => {
    setImageError(false);
    setExpandedImage(null);
  }, [item.id]);

  // Fetch linked items for this item
  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const response = await fetch(`/api/links?itemId=${item.id}`);
      const data = await response.json();
      setLinks(data.links || []);
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      setLoadingLinks(false);
    }
  }, [item.id]);

  // Handle deleting a link
  const handleDeleteLink = async (linkId: string, sourceId: string, targetId: string) => {
    setDeletingLinkId(linkId);
    try {
      const response = await fetch(`/api/links?sourceId=${sourceId}&targetId=${targetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete link');

      toast.success('Link deleted');
      fetchLinks(); // Refresh links after deletion
    } catch (error) {
      toast.error('Failed to delete link');
    } finally {
      setDeletingLinkId(null);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Listen for link:created WebSocket events
  useEffect(() => {
    const cleanupLinkCreated = on(WSEventType.LINK_CREATED, (data: { id: string; sourceId: string; targetId: string; relationType: string; createdAt: string }) => {
      // If the link involves the current item, refresh the links
      if (data.sourceId === item.id || data.targetId === item.id) {
        console.log('[ItemPreview] Link created event received, refreshing links:', data);
        fetchLinks();
      }
    });

    return () => cleanupLinkCreated();
  }, [on, item.id, fetchLinks]);

  // Listen for link:deleted WebSocket events
  useEffect(() => {
    const cleanupLinkDeleted = on(WSEventType.LINK_DELETED, (data: { sourceId: string; targetId: string; deletedAt: string }) => {
      // If the deleted link involves the current item, refresh the links
      if (data.sourceId === item.id || data.targetId === item.id) {
        console.log('[ItemPreview] Link deleted event received, refreshing links:', data);
        // Optimistically remove the link from state
        setLinks((prev) => prev.filter(
          (link) => !(link.sourceId === data.sourceId && link.targetId === data.targetId)
        ));
        // Then fetch fresh data from server
        fetchLinks();
      }
    });

    return () => cleanupLinkDeleted();
  }, [on, item.id, fetchLinks]);

  // Fetch projects for assignment
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/capture/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: content || null,
          tags,
          priority,
          status,
          assignedTo: (assignedTo && assignedTo !== 'none') ? assignedTo : null,
          projectId: projectId || null,
          dueDate: dueDate || null,
          reminder: reminder || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success('Changes saved');
      setEditing(false);
      onUpdate();
      fetchLinks(); // Refresh links after update
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAsMarkdown = () => {
    const markdown = `# ${item.title}

${item.content || ''}

Tags: ${item.tags.map((t) => `#${t}`).join(' ')}
${item.sourceUrl ? `Source: ${item.sourceUrl}\n` : ''}Captured: ${safeFormatAbsolute(item.createdAt, 'PPP', 'Unknown date')}
`.trim();

    navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast.success('Copied as Markdown');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearDueDate = async () => {
    try {
      const response = await fetch(`/api/capture/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: null,
          reminder: null,
        }),
      });

      if (!response.ok) throw new Error('Failed to clear due date');

      setDueDate(null);
      setReminder(null);
      toast.success('Due date cleared');
      onUpdate();
    } catch {
      toast.error('Failed to clear due date');
    }
  };

  const handleCopyExtractedText = () => {
    if (item.extractedText) {
      navigator.clipboard.writeText(item.extractedText);
      setCopiedExtracted(true);
      toast.success('Extracted text copied to clipboard');
      setTimeout(() => setCopiedExtracted(false), 2000);
    }
  };

  const renderContent = () => {
    if (item.type === 'screenshot' && item.imageUrl && !imageError) {
      return (
        <div className="space-y-4">
          <div className="relative group">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity"
              onClick={() => setExpandedImage(item.imageUrl)}
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          </div>
          {item.content && <div className="text-sm text-muted-foreground">{item.content}</div>}
        </div>
      );
    }

    if (item.type === 'screenshot' && imageError) {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg border flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Image failed to load</p>
            </div>
          </div>
          {item.content && <div className="text-sm text-muted-foreground">{item.content}</div>}
        </div>
      );
    }

    if (item.type === 'ocr') {
      return (
        <div className="space-y-4">
          {item.imageUrl && !imageError && (
            <div className="relative group">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="max-h-48 rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity w-full object-contain"
                onClick={() => setExpandedImage(item.imageUrl)}
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
          )}
          {imageError && item.imageUrl && (
            <div className="p-4 bg-muted rounded-lg border flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Image failed to load</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Extracted Text</h4>
              {item.extractedText && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCopyExtractedText}
                >
                  {copiedExtracted ? (
                    <>
                      <Check className="w-3 h-3 mr-1 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
              {item.extractedText || 'No text extracted'}
            </div>
          </div>
        </div>
      );
    }

    if (item.type === 'webpage') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt=""
                className="w-5 h-5 rounded-sm object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline text-sm"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.sourceUrl}</span>
              </a>
            )}
          </div>
          <SecureMarkdown className="max-w-none break-words">
            {(item.content || '').substring(0, 2000)}
          </SecureMarkdown>
        </div>
      );
    }

    if (item.type === 'scratchpad') {
      return (
        <SecureMarkdown className="max-w-none break-words overflow-auto">
          {item.content || ''}
        </SecureMarkdown>
      );
    }

    return (
      <SecureMarkdown className="max-w-none break-words">
        {item.content || 'No content'}
      </SecureMarkdown>
    );
  };

  return (
    <div className="w-full bg-background flex flex-col h-full max-md:h-screen max-md:w-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {item.type === 'webpage' && item.imageUrl ? (
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={item.imageUrl}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-6 h-6 rounded ${typeColor} flex items-center justify-center text-white text-xs">${typeIcon}</div>`;
                  }
                }}
              />
            </div>
          ) : (
            <div className={`w-6 h-6 rounded ${typeColor} flex items-center justify-center text-white`}>
              {typeIcon}
            </div>
          )}
          <span className="text-sm font-medium capitalize">{item.type}</span>
          {item.pinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
        </div>
        <div className="flex items-center gap-1">
          {/* Overflow Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyAsMarkdown}>
                {copied ? (
                  <Check className="w-4 h-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                Copy as Markdown
              </DropdownMenuItem>
              {onPin && (
                <DropdownMenuItem onClick={onPin}>
                  <Pin className="w-4 h-4 mr-2" />
                  {item.pinned ? 'Unpin Item' : 'Pin Item'}
                </DropdownMenuItem>
              )}
              {onRestore && item.status === 'trash' && (
                <DropdownMenuItem onClick={onRestore}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore to Inbox
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close preview">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {editing ? (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-medium" />
        ) : (
          <h2 className="text-lg font-medium">{item.title}</h2>
        )}

        {/* Meta Info - Creation and Update timestamps */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <>Created {safeFormatRelative(item.createdAt, { fallback: 'Unknown date' })}</>
          </div>
          {item.updatedAt && item.updatedAt !== item.createdAt && safeParseDate(item.updatedAt) && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {safeFormatRelative(item.updatedAt)}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                {editing && (
                  <button onClick={() => handleRemoveTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {editing && (
            <div className="flex gap-2">
              <Input
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 h-8"
              />
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleAddTag}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Priority & Status */}
        {editing ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <Badge
              className={
                priority === 'high'
                  ? 'bg-purple-500/20 text-purple-700 dark:bg-purple-600/30 dark:text-purple-300 border border-purple-500/50'
                  : priority === 'medium'
                  ? 'bg-amber-500/20 text-amber-700 dark:bg-amber-600/30 dark:text-amber-300 border border-amber-500/50'
                  : priority === 'low'
                  ? 'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-600/30 dark:text-indigo-300 border border-indigo-500/50'
                  : 'bg-gray-500/20 text-gray-700 dark:bg-gray-600/30 dark:text-gray-300 border border-gray-500/50'
              }
            >
              {priority} priority
            </Badge>
            <Badge variant="outline">{status}</Badge>
            {assignedTo && <Badge variant="secondary">{assignedTo}</Badge>}
            {item.projectId && (() => {
              const project = projects.find(p => p.id === item.projectId);
              return project ? (
                <Badge variant="secondary" className="gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                  {project.name}
                </Badge>
              ) : null;
            })()}
          </div>
        )}

        {/* Assignment, Due Date & Reminder */}
        {editing && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Assign To</label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Project</label>
                <Select
                  value={projectId || 'none'}
                  onValueChange={(value) => setProjectId(value === 'none' ? null : value)}
                  disabled={loadingProjects}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    Due Date
                  </span>
                  {dueDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setDueDate(null);
                        setReminder(null);
                      }}
                    >
                      <X className="w-3 h-3 mr-0.5" />
                      Clear
                    </Button>
                  )}
                </label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-8"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? safeFormatAbsolute(dueDate, 'MMM d, yyyy', 'Pick a date') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dueDate ? new Date(dueDate) : undefined}
                      onSelect={(date) => {
                        setDueDate(date ? date.toISOString() : null);
                        setCalendarOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Bell className="w-3 h-3" />
                Reminder
              </label>
              <Input
                type="datetime-local"
                value={reminder ? reminder.slice(0, 16) : ''}
                onChange={(e) => setReminder(e.target.value ? new Date(e.target.value).toISOString() : null)}
                  className="h-8"
              />
            </div>
            </div>
          </div>
        )}

        {/* Show due date and reminder when not editing */}
        {!editing && (dueDate || reminder) && (
          <div className="flex gap-2 flex-wrap items-center">
            {dueDate && (() => {
              const overdue = safeIsPast(dueDate) && !safeIsToday(dueDate);
              const isDueToday = safeIsToday(dueDate);
              const isDueTomorrow = safeIsTomorrow(dueDate);

              let colorClass = 'text-muted-foreground border-muted-foreground';
              const DueDateIcon = CalendarIcon;
              let label = safeFormatAbsolute(dueDate, 'MMM d, yyyy', 'No date');

              if (overdue) {
                colorClass = 'text-purple-500 border-purple-500 bg-purple-500/10';
                label = `Overdue: ${safeFormatAbsolute(dueDate, 'MMM d', 'overdue')}`;
              } else if (isDueToday) {
                colorClass = 'text-amber-500 border-amber-500 bg-amber-500/10';
                label = 'Due today';
              } else if (isDueTomorrow) {
                colorClass = 'text-indigo-500 border-indigo-500 bg-indigo-500/10';
                label = 'Due tomorrow';
              }

              return (
                <div className="flex items-center gap-1 group/due">
                  <Badge variant="outline" className={`gap-1 ${colorClass}`}>
                    <DueDateIcon className="w-3 h-3" />
                    {label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover/due:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={handleClearDueDate}
                    title="Clear due date"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              );
            })()}
            {reminder && (() => {
              const isReminderPast = safeIsPast(reminder) && !item.reminderSent;

              return (
                <Badge variant="outline" className={`gap-1 ${isReminderPast ? 'text-purple-500 border-purple-500 bg-purple-500/10' : 'text-indigo-500 border-indigo-500 bg-indigo-500/10'}`}>
                  <Bell className="w-3 h-3" />
                  {isReminderPast ? 'Missed: ' : ''}{safeFormatAbsolute(reminder, 'MMM d, h:mm a', 'Reminder')}
                </Badge>
              );
            })()}
          </div>
        )}

        {/* Linked Items (Knowledge Graph) */}
        {!editing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Linked Items ({links.length})
              </div>
              <LinkCreator sourceItemId={item.id} onLinkCreated={fetchLinks} />
            </div>

            {links.length > 0 ? (
              <div className="space-y-2">
                {links.map((link) => {
                  const isSource = link.sourceItem?.id === item.id;
                  const relatedItem = isSource ? link.targetItem : link.sourceItem;
                  if (!relatedItem) return null;

                  const relationLabels: Record<string, string> = {
                    related: 'Related to',
                    'depends-on': isSource ? 'Depends on' : 'Dependency of',
                    blocks: isSource ? 'Blocks' : 'Blocked by',
                    references: isSource ? 'References' : 'Referenced by',
                  };

                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border group"
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded transition-colors p-1"
                          onClick={() => onSelectItem?.(relatedItem.id)}
                        >
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {relationLabels[link.relationType] || link.relationType}
                          </Badge>
                          <span className="text-sm truncate">{relatedItem.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {relatedItem.type}
                          </Badge>
                        </div>
                        {link.note && (
                          <div className="text-xs text-muted-foreground mt-1 ml-1 truncate">
                            {link.note}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                        onClick={() => handleDeleteLink(link.id, link.sourceId!, link.targetId!)}
                        disabled={deletingLinkId === link.id}
                      >
                        {deletingLinkId === link.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2Off className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-2">
                No links yet. Add a link to connect this item to others.
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {!editing && (item.type === 'note' || item.type === 'scratchpad' || item.type === 'webpage') && item.content && item.content.length > 500 && (
          <SummaryCard content={item.content} maxLength={3} />
        )}
        {editing && item.type !== 'screenshot' && item.type !== 'ocr' ? (
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="resize-none" />
        ) : (
          renderContent()
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t flex gap-2">
        {editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </>
        ) : (
          <>
            {item.status === 'trash' && onRestore ? (
              <Button variant="outline" onClick={onRestore} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore
              </Button>
            ) : item.status === 'archived' ? (
              <Button variant="outline" onClick={() => setEditing(true)} className="flex-1">
                Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                {onArchive && (
                  <Button variant="outline" onClick={onArchive}>
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </Button>
                )}
              </>
            )}
            <Button variant="destructive" onClick={onDelete} className={item.status !== 'trash' && onArchive ? 'flex-1' : 'flex-1'}>
              <Trash2 className="w-4 h-4 mr-2" />
              {item.status === 'trash' ? 'Delete Forever' : 'Delete'}
            </Button>
          </>
        )}
      </div>

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-5xl max-h-full">
            <img
              src={expandedImage}
              alt="Expanded view"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close expanded image"
            >
              <XIcon className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
