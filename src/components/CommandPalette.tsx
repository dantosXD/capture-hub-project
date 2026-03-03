'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/use-theme';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { toast } from 'sonner';
import {
  FileText,
  Edit3,
  ScanLine,
  Camera,
  Globe,
  Search,
  Inbox,
  Archive,
  Trash2,
  Folder,
  CheckSquare,
  Tag,
  Pin,
  Copy,
  Command,
  Download,
  LayoutDashboard,
  Settings,
  HelpCircle,
  Plus,
  FolderPlus,
  BarChart3,
  Brain,
  Sparkles,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';

interface Command {
  id: string;
  name: string;
  shortcut?: string;
  icon: React.ReactNode;
  category: 'capture' | 'navigation' | 'action' | 'item' | 'system';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCapture: (moduleId: string) => void;
  onNavigate: (view: string) => void;
  recentItems?: Array<{ id: string; title: string; type: string }>;
  onSelectItem?: (id: string) => void;
  onTogglePin?: () => void;
  onCopyMarkdown?: () => void;
  onCreateTag?: () => void;
  onCreateProject?: () => void;
  onShowShortcuts?: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  note: <FileText className="w-4 h-4" />,
  scratchpad: <Edit3 className="w-4 h-4" />,
  ocr: <ScanLine className="w-4 h-4" />,
  screenshot: <Camera className="w-4 h-4" />,
  webpage: <Globe className="w-4 h-4" />,
};

function CommandPaletteInner({
  onOpenCapture,
  onNavigate,
  recentItems = [],
  onSelectItem,
  onClose,
  onTogglePin,
  onCopyMarkdown,
  onCreateTag,
  onCreateProject,
  onShowShortcuts,
}: Omit<CommandPaletteProps, 'isOpen'>) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();

  // Build commands list
  const commands: Command[] = useMemo(() => [
    // Capture commands
    { id: 'capture-quick', name: 'Quick Capture', shortcut: '⌘K', icon: <FileText className="w-4 h-4" />, category: 'capture', action: () => onOpenCapture('quick') },
    { id: 'capture-scratch', name: 'Scratch Pad', icon: <Edit3 className="w-4 h-4" />, category: 'capture', action: () => onOpenCapture('scratchpad') },
    { id: 'capture-ocr', name: 'OCR Tool', icon: <ScanLine className="w-4 h-4" />, category: 'capture', action: () => onOpenCapture('ocr') },
    { id: 'capture-screenshot', name: 'Screenshot', icon: <Camera className="w-4 h-4" />, category: 'capture', action: () => onOpenCapture('screenshot') },
    { id: 'capture-web', name: 'Web Capture', icon: <Globe className="w-4 h-4" />, category: 'capture', action: () => onOpenCapture('webpage') },
    // Navigation commands
    { id: 'nav-dashboard', name: 'Go to Dashboard', shortcut: 'G D', icon: <LayoutDashboard className="w-4 h-4" />, category: 'navigation', action: () => onNavigate('dashboard') },
    { id: 'nav-inbox', name: 'Go to Inbox', shortcut: 'G I', icon: <Inbox className="w-4 h-4" />, category: 'navigation', action: () => onNavigate('inbox') },
    { id: 'nav-assigned', name: 'Go to Assigned', icon: <Folder className="w-4 h-4" />, category: 'navigation', action: () => onNavigate('assigned') },
    { id: 'nav-projects', name: 'Go to Projects', icon: <CheckSquare className="w-4 h-4" />, category: 'navigation', action: () => onNavigate('projects') },
    { id: 'nav-archived', name: 'Go to Archive', shortcut: 'G A', icon: <Archive className="w-4 h-4" />, category: 'navigation', action: () => onNavigate('archived') },
    { id: 'nav-trash', name: 'Go to Trash', icon: <Trash2 className="w-4 h-4" />, category: 'navigation', action: () => onNavigate('trash') },
    // Action commands
    { id: 'action-search', name: 'Search Everything', shortcut: '/', icon: <Search className="w-4 h-4" />, category: 'action', action: () => { /* Focus search - handled by global shortcut */ } },
    { id: 'action-tag', name: 'Create Tag', icon: <Tag className="w-4 h-4" />, category: 'action', action: () => onCreateTag?.() },
    { id: 'action-pin', name: 'Toggle Pin', icon: <Pin className="w-4 h-4" />, category: 'action', action: () => onTogglePin?.() },
    { id: 'action-copy', name: 'Copy as Markdown', icon: <Copy className="w-4 h-4" />, category: 'action', action: () => onCopyMarkdown?.() },
    { id: 'action-export', name: 'Export All Data', icon: <Download className="w-4 h-4" />, category: 'action', action: () => { window.open('/api/export', '_blank'); } },
    { id: 'action-export-json', name: 'Export as JSON', icon: <Download className="w-4 h-4" />, category: 'action', action: () => { window.open('/api/export?format=json', '_blank'); } },
    { id: 'action-export-md', name: 'Export as Markdown', icon: <Download className="w-4 h-4" />, category: 'action', action: () => { window.open('/api/export?format=markdown', '_blank'); } },
    { id: 'action-export-csv', name: 'Export as CSV', icon: <Download className="w-4 h-4" />, category: 'action', action: () => { window.open('/api/export?format=csv', '_blank'); } },
    // Project commands
    { id: 'project-new', name: 'New Project', icon: <FolderPlus className="w-4 h-4" />, category: 'action', action: () => onCreateProject?.() },
    { id: 'project-analytics', name: 'View Analytics', icon: <BarChart3 className="w-4 h-4" />, category: 'navigation', action: () => onNavigate('dashboard') },
    // System commands
    { id: 'system-refresh', name: 'Refresh Data', icon: <RefreshCw className="w-4 h-4" />, category: 'system', action: () => window.location.reload() },
    { id: 'system-theme', name: 'Toggle Theme', icon: theme === 'dark' ? <Sun className="w-4 h-4" /> : theme === 'light' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />, category: 'system', action: () => { toggleTheme(); toast.success(`Theme changed to ${theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'}`); } },
    { id: 'system-help', name: 'Keyboard Shortcuts', icon: <HelpCircle className="w-4 h-4" />, category: 'system', action: () => onShowShortcuts?.() },
  ], [onOpenCapture, onNavigate, theme, toggleTheme, onTogglePin, onCopyMarkdown, onCreateTag, onCreateProject, onShowShortcuts]);

  // Add recent items as commands
  const itemCommands: Command[] = useMemo(() => 
    recentItems.map(item => ({
      id: `item-${item.id}`,
      name: item.title,
      icon: typeIcons[item.type] || <FileText className="w-4 h-4" />,
      category: 'item' as const,
      action: () => onSelectItem?.(item.id),
    })), [recentItems, onSelectItem]
  );

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query) return [...commands, ...itemCommands.slice(0, 5)];
    
    const lowerQuery = query.toLowerCase();
    return [...commands, ...itemCommands].filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.category.includes(lowerQuery)
    );
  }, [query, commands, itemCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    capture: 'Capture',
    navigation: 'Navigation',
    action: 'Actions',
    item: 'Recent Items',
    system: 'System',
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          cmd.action();
          onClose();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSelectedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedIndex(filteredCommands.length - 1);
      } else if (e.key === 'Escape') {
        // Dialog component handles Escape, but we ensure it closes
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, selectedIndex, onClose]);

  const handleSelect = (cmd: Command) => {
    cmd.action();
    onClose();
  };

  return (
    <DialogContent className="p-0 max-w-lg gap-0 overflow-hidden bg-card/95 backdrop-blur-md border border-border/50 shadow-2xl">
      <DialogTitle className="sr-only">Command Palette</DialogTitle>
      <DialogDescription className="sr-only">Search and execute commands</DialogDescription>
      {/* Search Input */}
      <div className="flex items-center border-b px-3">
        <Search className="w-4 h-4 text-muted-foreground mr-2" />
        <Input
          ref={inputRef}
          placeholder="Type a command or search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border-0 focus-visible:ring-0 px-0"
        />
        <Badge variant="outline" className="text-xs">
          <Command className="w-3 h-3 mr-1" />P
        </Badge>
      </div>

      {/* Commands List */}
      <div className="max-h-80 overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="px-3 py-2 text-xs text-muted-foreground font-medium bg-muted/30">
                {categoryLabels[category] || category}
              </div>
              {cmds.map((cmd) => {
                const globalIndex = filteredCommands.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      globalIndex === selectedIndex
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    <div className={`${globalIndex === selectedIndex ? 'text-primary' : 'text-muted-foreground'}`}>
                      {cmd.icon}
                    </div>
                    <span className="flex-1 truncate">{cmd.name}</span>
                    {cmd.shortcut && (
                      <kbd className="text-xs px-1.5 py-0.5 bg-muted rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredCommands.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No commands found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground bg-muted/20 flex-wrap">
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded">↑</kbd>
          <kbd className="px-1 py-0.5 bg-muted rounded">↓</kbd>
          <span>navigate</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded">Home</kbd>
          <kbd className="px-1 py-0.5 bg-muted rounded">End</kbd>
          <span>jump</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd>
          <span>select</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-muted rounded">esc</kbd>
          <span>close</span>
        </div>
      </div>
    </DialogContent>
  );
}

export function CommandPalette(props: CommandPaletteProps) {
  const { isOpen, onClose } = props;

  // Lock body scroll when command palette is open
  useBodyScrollLock(isOpen);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Key prop forces remount when dialog opens, resetting all state */}
      {isOpen && <CommandPaletteInner key="command-palette-inner" {...props} />}
    </Dialog>
  );
}
