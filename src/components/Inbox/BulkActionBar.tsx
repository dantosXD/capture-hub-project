'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FolderInput,
  Archive,
  Trash2,
  ChevronDown,
  Flag,
  Loader2,
  FolderOpen,
  Tag,
  Plus,
  X,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Project {
  id: string;
  name: string;
  color: string;
}

interface BulkActionBarProps {
  selectedCount: number;
  onAction: (action: string, value?: string) => Promise<void>;
  disabled?: boolean;
  selectedItems?: any[];
}

export function BulkActionBar({
  selectedCount,
  onAction,
  disabled = false,
  selectedItems = [],
}: BulkActionBarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [summaryPopoverOpen, setSummaryPopoverOpen] = useState(false);

  // Fetch projects for the project assignment dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        toast.error('Failed to load projects');
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  const handleAction = async (action: string, value?: string) => {
    setLoading(action);
    try {
      await onAction(action, value);
    } finally {
      setLoading(null);
    }
  };

  const handleBulkTag = async () => {
    if (!tagInput.trim()) {
      toast.error('Please enter a tag');
      return;
    }

    setLoading('addTag');
    try {
      await onAction('addTag', tagInput.trim());
      setTagInput('');
      setTagPopoverOpen(false);
      toast.success(`Tag "${tagInput.trim()}" added to ${selectedCount} items`);
    } finally {
      setLoading(null);
    }
  };

  const handleBulkSummarize = async (selectedItems: any[]) => {
    setLoading('summarize');
    setSummaryResult(null);

    try {
      const response = await fetch('/api/ai/bulk-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems, maxLength: 5 }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      setSummaryResult(data.summary);
      toast.success('Summary generated successfully');
    } catch (error) {
      console.error('Failed to generate summary:', error);
      toast.error('Failed to generate summary');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2 ml-auto">
      <Badge variant="secondary">{selectedCount} selected</Badge>

      {/* Quick Actions */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction('archive')}
        disabled={disabled || loading === 'archive'}
      >
        {loading === 'archive' ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Archive className="w-4 h-4 mr-2" />
        )}
        Archive
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleAction('trash')}
        disabled={disabled || loading === 'trash'}
      >
        {loading === 'trash' ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4 mr-2" />
        )}
        Trash
      </Button>

      {/* Assign Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <FolderInput className="w-4 h-4 mr-2" />
            Assign <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleAction('assign', 'Projects')}>
            Assign to Projects
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('assign', 'Tasks')}>
            Assign to Tasks
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('assign', 'Review')}>
            Assign to Review
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {projects.length > 0 && (
            <>
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => handleAction('assignProject', project.id)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.name}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => handleAction('unassign')}>
            Unassign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <Flag className="w-4 h-4 mr-2" />
            Priority <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleAction('priority', 'none')}>
            No Priority
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAction('priority', 'low')}>
            Low Priority
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('priority', 'medium')}>
            Medium Priority
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction('priority', 'high')}>
            High Priority
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* AI Summarize Popover */}
      <Popover open={summaryPopoverOpen} onOpenChange={setSummaryPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled || selectedItems.length === 0}>
            {loading === 'summarize' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Summarize
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Summary
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleBulkSummarize(selectedItems)}
                disabled={loading === 'summarize'}
              >
                {loading === 'summarize' ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate a summary of {selectedCount} selected items
            </p>
            {summaryResult && (
              <div className="p-3 bg-muted rounded-lg text-sm max-h-64 overflow-y-auto custom-scrollbar">
                <div className="whitespace-pre-wrap">{summaryResult}</div>
              </div>
            )}
            {!summaryResult && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
                Click "Generate" to create a summary of the selected items
              </div>
            )}
            {summaryResult && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(summaryResult);
                  toast.success('Summary copied to clipboard');
                }}
              >
                Copy Summary
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Add Tag Popover */}
      <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            {loading === 'addTag' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Tag className="w-4 h-4 mr-2" />
            )}
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Add Tag to Selected Items</h4>
            <p className="text-xs text-muted-foreground">
              Enter a tag name to add to all {selectedCount} selected items
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Enter tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBulkTag();
                  } else if (e.key === 'Escape') {
                    setTagPopoverOpen(false);
                    setTagInput('');
                  }
                }}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleBulkTag}
                disabled={!tagInput.trim() || loading === 'addTag'}
              >
                {loading === 'addTag' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
