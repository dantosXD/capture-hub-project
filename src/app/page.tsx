'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingHub } from '@/components/FloatingHub';
import { InboxList } from '@/components/Inbox/InboxList';
import { Header } from '@/components/Header/Header';
import { AIDashboard } from '@/components/Dashboard/AIDashboard';
import { CommandPalette } from '@/components/CommandPalette';
import { ProjectsManager } from '@/components/Projects/ProjectsManager';
import { TemplatesManager } from '@/components/Templates/TemplatesManager';
import { TagManager } from '@/components/Tags/TagManager';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { ExportDialog } from '@/components/Export/ExportDialog';
import { SectionErrorWrapper } from '@/components/SectionErrorBoundary';
import { SettingsPage } from '@/components/Settings/SettingsPage';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { safeFormatAbsolute } from '@/lib/safe-date';
import {
  Inbox,
  Archive,
  Trash2,
  Folder,
  CheckSquare,
  LayoutDashboard,
  Tag,
  FolderPlus,
  HelpCircle,
  FileText,
  Settings,
} from 'lucide-react';
import { MobileBottomNav } from '@/components/MobileBottomNav/MobileBottomNav';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { AnimatedCountBadge } from '@/components/AnimatedCountBadge';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { useServiceWorker } from '@/lib/service-worker';

interface CaptureItem {
  id: string;
  title: string;
  content: string | null;
  type: string;
  tags: string[];
  pinned?: boolean;
  sourceUrl: string | null;
  createdAt: string;
}

interface Stats {
  inbox: number;
  assigned: number;
  projects: number;
  archived: number;
  trash: number;
  today: number;
  thisWeek: number;
  stale: number;
  total: number;
  recentItems?: Array<{ id: string; title: string; type: string; createdAt: string }>;
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeView, setActiveView] = useState('dashboard');
  const [searchResultItem, setSearchResultItem] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeCaptureModule, setActiveCaptureModule] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('');

  // WebSocket for real-time updates
  const { on } = useWebSocket();

  // Service worker for PWA support
  useServiceWorker();

  // Command palette action state
  const [previewItem, setPreviewItem] = useState<CaptureItem | null>(null);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  // Listen for stats updates via WebSocket (real-time sync for count badges)
  useEffect(() => {
    const cleanupStatsUpdated = on(WSEventType.STATS_UPDATED, (data: { type: string; timestamp: string }) => {
      console.log('[Home] Stats updated via WebSocket:', data);
      // Refresh stats when any item changes
      fetchStats();
    });

    return () => {
      cleanupStatsUpdated();
    };
  }, [on, fetchStats]);

  // Listen for sync response (reconciliation after reconnect)
  useEffect(() => {
    const cleanupSyncResponse = on(WSEventType.SYNC_RESPONSE, (data: any) => {
      console.log('[Home] Sync response received, refreshing data:', {
        itemCount: data.items?.length || 0,
        projectCount: data.projects?.length || 0,
        hasMore: data.hasMore,
      });
      // Refresh all data after sync reconciliation
      fetchStats();
      setRefreshKey(prev => prev + 1); // Force refresh of all components
    });

    return () => {
      cleanupSyncResponse();
    };
  }, [on, fetchStats]);

  // Listen for item updates/deletes/creates/bulk to refresh stats (real-time count badges)
  useEffect(() => {
    const cleanupItemUpdated = on(WSEventType.ITEM_UPDATED, (data: any) => {
      console.log('[Home] Item updated via WebSocket:', data);
      // Refresh stats when item status changes (affects count badges)
      if (data.changes?.status) {
        fetchStats();
      }
    });

    const cleanupItemDeleted = on(WSEventType.ITEM_DELETED, (data: any) => {
      console.log('[Home] Item deleted via WebSocket:', data);
      fetchStats();
    });

    const cleanupItemCreated = on(WSEventType.ITEM_CREATED, (data: any) => {
      console.log('[Home] Item created via WebSocket:', data);
      fetchStats();
    });

    const cleanupBulkUpdate = on(WSEventType.ITEM_BULK_UPDATE, (data: any) => {
      console.log('[Home] Bulk update via WebSocket:', data);
      // Bulk actions often change statuses, always refresh counts
      fetchStats();
    });

    return () => {
      cleanupItemUpdated();
      cleanupItemDeleted();
      cleanupItemCreated();
      cleanupBulkUpdate();
    };
  }, [on, fetchStats]);

  const handleCaptureComplete = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleSearchResultClick = useCallback((item: { id: string }) => {
    setSearchResultItem(item.id);
    setActiveView('inbox');
    setTimeout(() => setSearchResultItem(null), 100);
  }, []);

  const handleNavigate = useCallback((view: string, options?: { tag?: string }) => {
    setActiveView(view);
    if (options?.tag) {
      setTagFilter(options.tag);
    } else {
      setTagFilter('');
    }
  }, []);

  const handleSelectItem = useCallback((id: string) => {
    setSearchResultItem(id);
    setActiveView('inbox');
    setTimeout(() => setSearchResultItem(null), 100);
  }, []);

  const handleOpenCapture = useCallback((module: string) => {
    setActiveCaptureModule(module);
    // Don't clear - let the component handle closing itself
  }, []);

  // Command palette action handlers
  const handleTogglePin = useCallback(async () => {
    if (!previewItem) {
      toast.error('No item selected. Please select an item first.');
      return;
    }

    try {
      const response = await fetch(`/api/capture/${previewItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !previewItem.pinned }),
      });

      if (!response.ok) throw new Error('Failed to toggle pin');

      const updated = await response.json();
      setPreviewItem({ ...previewItem, pinned: updated.pinned });
      setRefreshKey(prev => prev + 1);
      toast.success(`Item ${updated.pinned ? 'pinned' : 'unpinned'}`);
    } catch (error) {
      console.error('Toggle pin error:', error);
      toast.error('Failed to toggle pin');
    }
  }, [previewItem]);

  const handleCopyAsMarkdown = useCallback(async () => {
    if (!previewItem) {
      toast.error('No item selected. Please select an item first.');
      return;
    }

    try {
      const markdown = `# ${previewItem.title}

${previewItem.content || ''}

Tags: ${previewItem.tags.map((t) => `#${t}`).join(' ')}
${previewItem.sourceUrl ? `Source: ${previewItem.sourceUrl}\n` : ''}Captured: ${safeFormatAbsolute(previewItem.createdAt, 'PPP', 'Unknown date')}
`.trim();

      await navigator.clipboard.writeText(markdown);
      toast.success('Copied as Markdown');
    } catch (error) {
      console.error('Copy as markdown error:', error);
      toast.error('Failed to copy as markdown');
    }
  }, [previewItem]);

  const handleCreateTag = useCallback(async () => {
    if (!newTag.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTag.trim() }),
      });

      if (!response.ok) throw new Error('Failed to create tag');

      toast.success(`Tag "${newTag.trim()}" created`);
      setNewTag('');
      setCreateTagDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Create tag error:', error);
      toast.error('Failed to create tag');
    }
  }, [newTag]);

  const handleCreateProject = useCallback(async () => {
    // For now, just navigate to projects view where user can create
    // ProjectsManager has its own create dialog
    setNewProjectDialogOpen(false);
    setActiveView('projects');
    toast.info('Use the "New Project" button in Projects to create a project');
  }, []);

  // Global keyboard shortcuts using the hook
  useKeyboardShortcuts([
    {
      key: 'p',
      metaKey: true,
      ctrlKey: true,
      handler: () => setCommandPaletteOpen(true),
      description: 'Open command palette',
    },
    {
      key: 'k',
      metaKey: true,
      ctrlKey: true,
      handler: () => {
        // Open quick capture via FloatingHub
        handleOpenCapture('quick');
      },
      description: 'Open quick capture',
    },
    {
      key: 'n',
      metaKey: true,
      ctrlKey: true,
      handler: () => {
        // Open quick capture via FloatingHub (new capture)
        handleOpenCapture('quick');
      },
      description: 'New capture',
    },
    {
      key: 'f',
      metaKey: true,
      ctrlKey: true,
      handler: () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      },
      description: 'Focus search bar',
    },
    {
      key: '/',
      handler: () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      },
      description: 'Focus search bar',
    },
    {
      key: '?',
      shiftKey: true,
      handler: () => setKeyboardShortcutsOpen(true),
      description: 'Show keyboard shortcuts',
    },
    {
      key: 'Escape',
      handler: () => {
        // Close all open dialogs/modals in priority order
        if (activeCaptureModule) {
          setActiveCaptureModule(null);
        } else if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (keyboardShortcutsOpen) {
          setKeyboardShortcutsOpen(false);
        } else if (createTagDialogOpen) {
          setCreateTagDialogOpen(false);
        } else if (newProjectDialogOpen) {
          setNewProjectDialogOpen(false);
        } else if (exportDialogOpen) {
          setExportDialogOpen(false);
        } else if (previewItem) {
          setPreviewItem(null);
        }
      },
      description: 'Close dialogs/modals',
    },
  ], { disableInInputs: true });

  // Handle app shortcuts from URL parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const view = urlParams.get('view');

    if (action) {
      // Handle PWA shortcuts that open capture modules
      switch (action) {
        case 'capture':
          handleOpenCapture('quick');
          break;
        case 'ocr':
          handleOpenCapture('ocr');
          break;
        case 'screenshot':
          handleOpenCapture('screenshot');
          break;
        case 'web':
          handleOpenCapture('web');
          break;
        case 'scratchpad':
          handleOpenCapture('scratchpad');
          break;
      }
      // Clear the action parameter from URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (view) {
      // Handle view shortcuts
      setActiveView(view);
      // Clear the view parameter from URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [handleOpenCapture]);

  const recentItems = stats?.recentItems || [];

  return (
    <main className="min-h-screen bg-background pb-16 md:pb-0 overflow-x-hidden">
      {/* Header */}
      <SectionErrorWrapper sectionName="Header">
        <Header
          recentItems={recentItems}
          onSearchResultClick={handleSearchResultClick}
          onCommandPaletteOpen={() => setCommandPaletteOpen(true)}
          onExportOpen={() => setExportDialogOpen(true)}
        />
      </SectionErrorWrapper>

      {/* Main Content */}
      <div className="container max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-3 sm:px-6 py-4 md:py-6">
        {/* View Tabs with Counts - Hidden on mobile, shown on md+ */}
        <nav
          role="tablist"
          aria-label="View navigation"
          className="hidden md:flex gap-2 sm:gap-4 mb-6 overflow-x-auto pb-2 flex-wrap sm:flex-nowrap"
        >
          <Button
            role="tab"
            aria-selected={activeView === 'dashboard'}
            aria-controls="tabpanel"
            variant={activeView === 'dashboard' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('dashboard')}
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            Dashboard
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'inbox'}
            aria-controls="tabpanel"
            variant={activeView === 'inbox' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('inbox')}
          >
            <Inbox className="w-4 h-4" aria-hidden="true" />
            Inbox
            {stats && stats.inbox > 0 && (
              <AnimatedCountBadge count={stats.inbox} className="ml-1" ariaLabel={`${stats.inbox} items`} />
            )}
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'assigned'}
            aria-controls="tabpanel"
            variant={activeView === 'assigned' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('assigned')}
          >
            <Folder className="w-4 h-4" aria-hidden="true" />
            Assigned
            {stats && stats.assigned > 0 && (
              <AnimatedCountBadge count={stats.assigned} className="ml-1" ariaLabel={`${stats.assigned} items`} />
            )}
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'projects'}
            aria-controls="tabpanel"
            variant={activeView === 'projects' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('projects')}
          >
            <CheckSquare className="w-4 h-4" aria-hidden="true" />
            Projects
            {stats && stats.projects > 0 && (
              <AnimatedCountBadge count={stats.projects} className="ml-1" ariaLabel={`${stats.projects} items`} />
            )}
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'templates'}
            aria-controls="tabpanel"
            variant={activeView === 'templates' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('templates')}
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            Templates
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'tags'}
            aria-controls="tabpanel"
            variant={activeView === 'tags' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('tags')}
          >
            <Tag className="w-4 h-4" aria-hidden="true" />
            Tags
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'archived'}
            aria-controls="tabpanel"
            variant={activeView === 'archived' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('archived')}
          >
            <Archive className="w-4 h-4" aria-hidden="true" />
            Archived
            {stats && stats.archived > 0 && (
              <AnimatedCountBadge count={stats.archived} className="ml-1" ariaLabel={`${stats.archived} items`} />
            )}
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'trash'}
            aria-controls="tabpanel"
            variant={activeView === 'trash' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('trash')}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Trash
            {stats && stats.trash > 0 && (
              <AnimatedCountBadge count={stats.trash} className="ml-1" ariaLabel={`${stats.trash} items`} />
            )}
          </Button>
          <Button
            role="tab"
            aria-selected={activeView === 'settings'}
            aria-controls="tabpanel"
            variant={activeView === 'settings' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setActiveView('settings')}
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            Settings
          </Button>
        </nav>

        {/* Content Area */}
        <div
          id="tabpanel"
          role="tabpanel"
          aria-label={`${activeView} view`}
          className="bg-card rounded-2xl border shadow-sm overflow-hidden min-h-[calc(100vh-220px)] relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0"
            >
              {activeView === 'dashboard' ? (
                <SectionErrorWrapper sectionName="Dashboard">
                  <AIDashboard
                    onNavigate={handleNavigate}
                    onSelectItem={handleSelectItem}
                    onOpenCapture={handleOpenCapture}
                  />
                </SectionErrorWrapper>
              ) : activeView === 'projects' ? (
                <SectionErrorWrapper sectionName="Projects">
                  <ProjectsManager onSelectProject={(id) => {
                    setSearchResultItem(id);
                    setActiveView('inbox');
                  }} />
                </SectionErrorWrapper>
              ) : activeView === 'templates' ? (
                <SectionErrorWrapper sectionName="Templates">
                  <div className="p-6">
                    <TemplatesManager />
                  </div>
                </SectionErrorWrapper>
              ) : activeView === 'tags' ? (
                <SectionErrorWrapper sectionName="Tags">
                  <TagManager />
                </SectionErrorWrapper>
              ) : activeView === 'settings' ? (
                <SectionErrorWrapper sectionName="Settings">
                  <SettingsPage />
                </SectionErrorWrapper>
              ) : (
                <SectionErrorWrapper sectionName={`Inbox (${activeView})`}>
                  <InboxList
                    key={refreshKey}
                    refreshKey={refreshKey}
                    statusFilter={activeView}
                    selectedItemId={searchResultItem}
                    onPreviewItem={setPreviewItem}
                    initialTagFilter={tagFilter}
                  />
                </SectionErrorWrapper>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Action Hub */}
      <SectionErrorWrapper sectionName="Floating Hub">
        <FloatingHub
          onCaptureComplete={handleCaptureComplete}
          activeModule={activeCaptureModule}
          onModuleChange={setActiveCaptureModule}
          onNavigateToItem={(itemId) => {
            setActiveCaptureModule(null);
            handleSelectItem(itemId);
          }}
        />
      </SectionErrorWrapper>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Command Palette */}
      <SectionErrorWrapper sectionName="Command Palette">
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onOpenCapture={handleOpenCapture}
          onNavigate={handleNavigate}
          recentItems={recentItems}
          onSelectItem={handleSelectItem}
          onTogglePin={handleTogglePin}
          onCopyMarkdown={handleCopyAsMarkdown}
          onCreateTag={() => setCreateTagDialogOpen(true)}
          onCreateProject={() => setNewProjectDialogOpen(true)}
          onShowShortcuts={() => setKeyboardShortcutsOpen(true)}
        />
      </SectionErrorWrapper>

      {/* Create Tag Dialog */}
      <Dialog open={createTagDialogOpen} onOpenChange={setCreateTagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Create New Tag
            </DialogTitle>
            <DialogDescription className="sr-only">Create a new tag for organizing captures</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input
                id="tag-name"
                placeholder="e.g., important, todo, reference"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateTagDialogOpen(false);
              setNewTag('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTag}>Create Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5" />
              Create New Project
            </DialogTitle>
            <DialogDescription className="sr-only">Create a new project to organize captures</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You will be redirected to the Projects view where you can create a new project with full details.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>Go to Projects</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={keyboardShortcutsOpen} onOpenChange={setKeyboardShortcutsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="sr-only">Available keyboard shortcuts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Capture & Navigation</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="font-medium">⌘K / Ctrl+K</div>
                  <div className="text-muted-foreground">Quick capture</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">⌘N / Ctrl+N</div>
                  <div className="text-muted-foreground">New capture</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">⌘P / Ctrl+P</div>
                  <div className="text-muted-foreground">Command palette</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">/ or ⌘F</div>
                  <div className="text-muted-foreground">Focus search</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">System</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="font-medium">?</div>
                  <div className="text-muted-foreground">Show shortcuts</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Esc</div>
                  <div className="text-muted-foreground">Close dialogs</div>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Note: The FAB (Floating Action Button) also supports arrow key navigation when opened with ⌘K.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setKeyboardShortcutsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={[
          { keys: '⌘K', description: 'Quick capture' },
          { keys: '⌘N', description: 'New capture' },
          { keys: '⌘P', description: 'Command palette' },
          { keys: '/', description: 'Focus search bar' },
          { keys: '?', description: 'Show shortcuts help' },
          { keys: 'Esc', description: 'Close dialogs/modals' },
        ]}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
      />

      {/* Mobile Bottom Navigation - Only visible on mobile */}
      <MobileBottomNav
        activeView={activeView}
        onViewChange={setActiveView}
        stats={stats}
      />
    </main>
  );
}
