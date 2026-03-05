'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, X, Loader2, Clock, FileText, Eye, Edit,
  CheckCircle2, AlertCircle, Maximize2, Minimize2,
  Columns, Bold, Italic, List, Link as LinkIcon,
  Code, ChevronDown, Copy, Download, Trash2, Heading,
  Users, Search, Inbox, ArrowDownToLine, Wifi, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { SecureMarkdown } from '@/components/ui/secure-markdown';
import { AITextarea } from '@/components/ui/ai-writing-toolbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';

interface ScratchPadProps {
  onComplete?: () => void;
  fullPage?: boolean;
}

interface Collaborator {
  senderId: string;
  senderName: string;
  senderColor: string;
  lastSeen: number;
}

// Generate a random pastel color for presence
const randomColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 60%)`;
};

const DEVICE_COLOR = randomColor();
const DEVICE_ID = typeof window !== 'undefined'
  ? (sessionStorage.getItem('scratchpad_device_id') || (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('scratchpad_device_id', id);
    return id;
  })())
  : 'server';
const DEVICE_NAME = typeof navigator !== 'undefined'
  ? (navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop')
  : 'Unknown';

export function ScratchPad({ onComplete, fullPage = false }: ScratchPadProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [scratchPadId, setScratchPadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>('edit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collaborators, setCollaborators] = useState<Map<string, Collaborator>>(new Map());
  const [showInsertCapture, setShowInsertCapture] = useState(false);
  const [captureSearchQuery, setCaptureSearchQuery] = useState('');
  const [captureResults, setCaptureResults] = useState<any[]>([]);
  const [searchingCaptures, setSearchingCaptures] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastRemoteUpdateRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRemoteUpdateRef = useRef(false);

  const { send, on, isConnected, socketId } = useWebSocket();

  // Quick Templates
  const templates = [
    { name: 'Meeting Notes', content: '# Meeting Notes\n**Date:** \n**Attendees:** \n\n## Agenda\n- \n\n## Discussion\n- \n\n## Action Items\n- [ ] ' },
    { name: 'Daily Standup', content: '# Daily Standup\n**Yesterday:**\n- \n\n**Today:**\n- \n\n**Blockers:**\n- ' },
    { name: 'Bug Report', content: '# Bug Report\n**Title:** \n**Environment:** \n\n## Steps to Reproduce\n1. \n2. \n\n## Expected Behavior\n\n## Actual Behavior\n' },
    { name: 'Brainstorm', content: '# Brainstorm\n**Topic:** \n\n## Ideas\n- \n- \n- \n\n## Pros/Cons\n| Idea | Pros | Cons |\n|------|------|------|\n| | | |\n\n## Next Steps\n- ' },
  ];

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  // ── Load scratchpad on mount ──
  useEffect(() => {
    const loadScratchpad = async () => {
      try {
        const response = await fetch('/api/scratchpad');
        if (response.ok) {
          const data = await response.json();
          setScratchPadId(data.id);
          setTitle(data.title || '');
          setContent(data.content || '');
          setTags(data.tags || []);
        }
      } catch (error) {
        console.error('[ScratchPad] Failed to load:', error);
      } finally {
        setLoading(false);
      }
    };
    loadScratchpad();
  }, []);

  // ── Auto-save with debounce (3s) ──
  const debouncedSave = useCallback((newContent?: string, newTitle?: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const saveContent = newContent ?? content;
      const saveTitle = newTitle ?? title;
      if (!scratchPadId) return;

      setSaving(true);
      try {
        await fetch('/api/scratchpad', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: scratchPadId,
            title: saveTitle || 'Scratchpad',
            content: saveContent,
            tags,
          }),
        });
        setLastSaved(new Date());
      } catch (error) {
        console.error('[ScratchPad] Save failed:', error);
      } finally {
        setSaving(false);
      }
    }, 3000);
  }, [scratchPadId, content, title, tags]);

  // ── WebSocket: broadcast content changes ──
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);

    // Broadcast to other tabs/devices
    if (!isRemoteUpdateRef.current) {
      send(WSEventType.SCRATCHPAD_CONTENT_UPDATE, {
        content: newContent,
        senderName: DEVICE_NAME,
        timestamp: new Date().toISOString(),
      });
    }
    isRemoteUpdateRef.current = false;

    debouncedSave(newContent);
  }, [send, debouncedSave]);

  // ── WebSocket: receive remote content updates ──
  useEffect(() => {
    const cleanup = on(WSEventType.SCRATCHPAD_CONTENT_UPDATE, (data: any) => {
      if (data.senderId === socketId) return; // Skip our own messages

      // Apply remote content
      isRemoteUpdateRef.current = true;
      lastRemoteUpdateRef.current = data.content;
      setContent(data.content);
    });
    return cleanup;
  }, [on, socketId]);

  // ── WebSocket: presence (join/leave) ──
  useEffect(() => {
    // Announce join
    send(WSEventType.SCRATCHPAD_JOIN, {
      senderName: DEVICE_NAME,
      senderColor: DEVICE_COLOR,
    });

    const cleanupJoin = on(WSEventType.SCRATCHPAD_JOIN, (data: any) => {
      if (data.senderId === socketId) return;
      setCollaborators(prev => {
        const next = new Map(prev);
        next.set(data.senderId, {
          senderId: data.senderId,
          senderName: data.senderName || 'Unknown',
          senderColor: data.senderColor || '#888',
          lastSeen: Date.now(),
        });
        return next;
      });
    });

    const cleanupLeave = on(WSEventType.SCRATCHPAD_LEAVE, (data: any) => {
      setCollaborators(prev => {
        const next = new Map(prev);
        next.delete(data.senderId);
        return next;
      });
    });

    const cleanupCursor = on(WSEventType.SCRATCHPAD_CURSOR_UPDATE, (data: any) => {
      if (data.senderId === socketId) return;
      setCollaborators(prev => {
        const next = new Map(prev);
        const existing = next.get(data.senderId);
        if (existing) {
          next.set(data.senderId, { ...existing, lastSeen: Date.now() });
        }
        return next;
      });
    });

    // Send leave on unmount
    return () => {
      send(WSEventType.SCRATCHPAD_LEAVE, {});
      cleanupJoin();
      cleanupLeave();
      cleanupCursor();
    };
  }, [send, on, socketId]);

  // ── Cleanup stale collaborators ──
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCollaborators(prev => {
        const next = new Map(prev);
        for (const [id, collab] of next) {
          if (now - collab.lastSeen > 60000) {
            next.delete(id);
          }
        }
        return next;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Search captures for insert ──
  const searchCaptures = useCallback(async (query: string) => {
    setCaptureSearchQuery(query);
    if (!query.trim()) {
      setCaptureResults([]);
      return;
    }
    setSearchingCaptures(true);
    try {
      const response = await fetch(`/api/inbox?status=inbox&limit=10&offset=0&sortBy=newest`);
      if (response.ok) {
        const data = await response.json();
        const filtered = (data.items || []).filter((item: any) =>
          item.title?.toLowerCase().includes(query.toLowerCase()) ||
          item.content?.toLowerCase().includes(query.toLowerCase())
        );
        setCaptureResults(filtered.slice(0, 8));
      }
    } catch {
      /* ignore */
    } finally {
      setSearchingCaptures(false);
    }
  }, []);

  // Load recent captures when opening insert panel
  useEffect(() => {
    if (showInsertCapture) {
      searchCaptures('');
      // Load all recent for browsing
      (async () => {
        try {
          const response = await fetch('/api/inbox?status=inbox&limit=10&offset=0&sortBy=newest');
          if (response.ok) {
            const data = await response.json();
            setCaptureResults(data.items || []);
          }
        } catch { /* ignore */ }
      })();
    }
  }, [showInsertCapture]);

  const insertCaptureItem = (item: any) => {
    const insertText = `\n\n> **${item.title}**\n> ${(item.content || '').split('\n').join('\n> ')}\n\n`;
    const newContent = content + insertText;
    handleContentChange(newContent);
    setShowInsertCapture(false);
    toast.success(`Inserted "${item.title}"`);
  };

  // ── Text formatting ──
  const insertFormat = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    if (prefix === '- ' || prefix === '1. ' || prefix === '### ') {
      const beforeText = text.substring(0, start);
      const lastNewline = beforeText.lastIndexOf('\n');
      const insertPos = lastNewline === -1 ? 0 : lastNewline + 1;
      const replacement = text.substring(0, insertPos) + prefix + text.substring(insertPos);
      handleContentChange(replacement);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
      return;
    }

    const replacement = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
    handleContentChange(replacement);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const handleTemplate = (tmplContent: string) => {
    handleContentChange(content ? content + '\n\n' + tmplContent : tmplContent);
  };

  const copyToClipboard = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const downloadMarkdown = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'scratchpad'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded as Markdown');
  };

  const clearContent = () => {
    if (content.trim().length > 0) {
      if (confirm('Clear the scratchpad? This cannot be undone.')) {
        handleContentChange('');
        toast.info('Scratchpad cleared');
      }
    }
  };

  const handleSaveToInbox = async () => {
    if (!title.trim() && !content.trim()) {
      toast.error('Please enter a title or content');
      return;
    }
    try {
      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'note',
          title: title || 'Scratchpad Note',
          content,
          tags,
        }),
      });
      toast.success('Saved as new inbox item!');
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleKeyDownWrapper = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
          setTags([...tags, tagInput.trim()]);
          setTagInput('');
        }
      }
      return;
    }
    if (e.target instanceof HTMLTextAreaElement) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveToInbox();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        insertFormat('**', '**');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        insertFormat('*', '*');
      }
    }
  };

  const collaboratorList = useMemo(() => Array.from(collaborators.values()), [collaborators]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading scratchpad...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col space-y-3",
      isFullscreen && "fixed inset-4 z-50 bg-background/95 backdrop-blur-sm p-6 rounded-xl shadow-2xl border",
      fullPage && "h-full"
    )}
      onKeyDown={handleKeyDownWrapper}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Scratchpad Title..."
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            debouncedSave(undefined, e.target.value);
          }}
          className="text-lg font-medium shadow-none bg-background/50 flex-1"
        />

        <div className="flex items-center gap-1.5">
          {/* Collaborator avatars */}
          {collaboratorList.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 border">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex -space-x-1.5">
                {collaboratorList.map(c => (
                  <div
                    key={c.senderId}
                    className="w-5 h-5 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: c.senderColor }}
                    title={c.senderName}
                  >
                    {c.senderName[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{collaboratorList.length}</span>
            </div>
          )}

          {/* Connection indicator */}
          <div className={cn(
            "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md",
            isConnected ? "text-green-600 dark:text-green-400" : "text-red-500"
          )}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>

          {/* Insert Capture */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={() => setShowInsertCapture(!showInsertCapture)}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Insert
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs">
                Templates <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {templates.map(tmpl => (
                <DropdownMenuItem key={tmpl.name} onClick={() => handleTemplate(tmpl.content)}>
                  {tmpl.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsFullscreen(!isFullscreen)} title="Toggle Fullscreen">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Insert Capture Panel */}
      {showInsertCapture && (
        <div className="border rounded-xl p-3 bg-muted/30 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your captures..."
              value={captureSearchQuery}
              onChange={(e) => searchCaptures(e.target.value)}
              className="h-8 text-sm flex-1"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowInsertCapture(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="max-h-48 overflow-auto space-y-1">
            {searchingCaptures && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {captureResults.length === 0 && !searchingCaptures && (
              <div className="text-xs text-muted-foreground text-center py-3">
                {captureSearchQuery ? 'No matches found' : 'No captures yet'}
              </div>
            )}
            {captureResults.map(item => (
              <button
                key={item.id}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-background/80 text-left transition-colors"
                onClick={() => insertCaptureItem(item)}
              >
                <Inbox className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{item.title || 'Untitled'}</div>
                  {item.content && (
                    <div className="text-xs text-muted-foreground truncate">{item.content.substring(0, 60)}</div>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{item.type}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className={cn("flex flex-col flex-1 min-h-0", (isFullscreen || fullPage) && "h-full")}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full flex flex-col h-full">
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-3 w-64">
              <TabsTrigger value="edit" className="gap-2 text-xs">
                <Edit className="w-3 h-3" /> Edit
              </TabsTrigger>
              <TabsTrigger value="split" className="gap-2 text-xs">
                <Columns className="w-3 h-3" /> Split
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2 text-xs">
                <Eye className="w-3 h-3" /> Preview
              </TabsTrigger>
            </TabsList>

            {/* Formatting Toolbar */}
            {activeTab !== 'preview' && (
              <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/20">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertFormat('**', '**')} title="Bold"><Bold className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertFormat('*', '*')} title="Italic"><Italic className="w-3.5 h-3.5" /></Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertFormat('### ')} title="Heading"><Heading className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertFormat('- ')} title="List"><List className="w-3.5 h-3.5" /></Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertFormat('[', '](url)')} title="Link"><LinkIcon className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertFormat('```\n', '\n```')} title="Code Block"><Code className="w-3.5 h-3.5" /></Button>
              </div>
            )}
          </div>

          {/* Tab Contents */}
          <div className="mt-3 flex-1 flex min-h-0">
            {activeTab === 'edit' && (
              <div className="flex-1 border rounded-md flex">
                <AITextarea
                  ref={textareaRef}
                  value={content}
                  onValueChange={handleContentChange}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Write your notes here... Full markdown supported! Press Ctrl+Space for AI writing tools."
                  className={cn(
                    "w-full p-4 bg-background text-foreground font-mono text-sm focus:outline-none custom-scrollbar border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                    (isFullscreen || fullPage) ? "min-h-[500px]" : "min-h-[300px] max-h-[500px]"
                  )}
                  style={{ lineHeight: '1.6' }}
                />
              </div>
            )}

            {activeTab === 'split' && (
              <div className="flex-1 flex gap-4 h-full">
                <div className="flex-1 border rounded-md flex">
                  <AITextarea
                    ref={textareaRef}
                    value={content}
                    onValueChange={handleContentChange}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Write your notes here..."
                    className={cn(
                      "w-full p-4 bg-background text-foreground font-mono text-sm focus:outline-none custom-scrollbar border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                      (isFullscreen || fullPage) ? "min-h-[500px]" : "min-h-[300px] max-h-[500px]"
                    )}
                    style={{ lineHeight: '1.6' }}
                  />
                </div>
                <div className={cn(
                  "flex-1 border rounded-md overflow-auto custom-scrollbar p-5 bg-background prose prose-sm dark:prose-invert max-w-none",
                  (isFullscreen || fullPage) ? "min-h-[500px]" : "min-h-[300px] max-h-[500px]"
                )}>
                  {content ? <SecureMarkdown>{content}</SecureMarkdown> : (
                    <div className="text-muted-foreground text-center py-12 flex items-center justify-center h-full">
                      Preview will appear here...
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className={cn(
                "flex-1 border rounded-md overflow-auto custom-scrollbar p-6 bg-background prose dark:prose-invert max-w-none w-full",
                (isFullscreen || fullPage) ? "min-h-[500px]" : "min-h-[300px] max-h-[500px]"
              )}>
                {content ? <SecureMarkdown>{content}</SecureMarkdown> : (
                  <div className="text-muted-foreground text-center py-20 flex items-center justify-center h-full">
                    No content to preview...
                  </div>
                )}
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Bottom Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title="Word count">
            <FileText className="w-3.5 h-3.5" />
            <span>{wordCount} w</span>
          </div>
          <div className="flex items-center gap-1.5" title="Reading time">
            <Clock className="w-3.5 h-3.5" />
            <span>{readingTime}m</span>
          </div>
          {collaboratorList.length > 0 && (
            <div className="flex items-center gap-1.5 text-purple-500">
              <Users className="w-3.5 h-3.5" />
              <span>{collaboratorList.length + 1} editing</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 px-2 border-x opacity-70 hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyToClipboard} title="Copy to clipboard"><Copy className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={downloadMarkdown} title="Download .md"><Download className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={clearContent} title="Clear"><Trash2 className="w-3 h-3" /></Button>
        </div>

        <div className="flex items-center gap-2">
          {saving && (
            <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="font-medium">Saving...</span>
            </div>
          )}
          {!saving && lastSaved && (
            <div className="flex items-center gap-1.5 text-green-500 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags and Actions */}
      <div className="flex items-end justify-between gap-4 mt-auto pt-3 border-t">
        <div className="space-y-2 flex-1 max-w-sm">
          <div className="flex gap-2 flex-wrap">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary" className="gap-1 px-2 py-0.5">
                {tag}
                <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add tag... (Enter)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="h-8 text-sm bg-background/50 shadow-none border-dashed focus-visible:border-solid"
            />
          </div>
        </div>

        <div className="flex gap-2">
          {onComplete && (
            <Button variant="outline" onClick={onComplete} className="shadow-none" size="sm">
              Close
            </Button>
          )}
          <Button onClick={handleSaveToInbox} disabled={saving} className="shadow-sm" size="sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save as Note
          </Button>
        </div>
      </div>
    </div>
  );
}
