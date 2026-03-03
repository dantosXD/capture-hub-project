'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2, Check, Sparkles } from 'lucide-react';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { captureItemMutations } from '@/lib/api-client';
import { toast } from 'sonner';
import { ContentSuggestions } from './ContentSuggestions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface QuickCaptureProps {
  onComplete?: () => void;
  onNavigateToItem?: (itemId: string) => void;
}

export function QuickCapture({ onComplete, onNavigateToItem }: QuickCaptureProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Optimistic mutation hook
  const mutation = useOptimisticMutation(
    {
      mutateFn: async (data: any) => {
        return await captureItemMutations.create(data);
      },
      // Success message will be shown dynamically with title
      errorMessage: 'Failed to save note. Please try again.',
    },
  );

  // Auto-focus title input when component mounts
  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // Re-focus title after successful save (for rapid multi-capture)
  useEffect(() => {
    if (!mutation.isPending && !mutation.error && mutation.data && title === '') {
      // Form was cleared after save, re-focus title input
      titleInputRef.current?.focus();
    }
  }, [mutation.isPending, mutation.data, title]);

  const handleAddTag = (tagToAdd?: string) => {
    const tag = tagToAdd || tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    if (!tagToAdd) {
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === ',') {
      // Allow comma to trigger tag addition (comma will be added then removed)
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Check if user typed a comma
    if (value.includes(',')) {
      // Split by comma and add all tags
      const newTags = value
        .split(',')
        .map(t => t.trim())
        .filter(t => t && !tags.includes(t));

      // Get the text after the last comma (might be a partial tag)
      const parts = value.split(',');
      const lastPart = parts[parts.length - 1];

      // Add all complete tags
      setTags([...tags, ...newTags]);

      // Keep the partial tag in input (if any)
      setTagInput(lastPart);
    } else {
      setTagInput(value);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      const data = {
        type: 'note',
        title: title.trim(),
        content: content.trim() || null,
        tags,
        ...(selectedProjectId ? { projectId: selectedProjectId, status: 'assigned' } : {}),
      };

      const result = await mutation.mutate(data);

      // Show success toast with item title
      toast.success(`"${data.title}" captured successfully!`, {
        icon: <Check className="w-4 h-4" />,
      });

      // Clear form on success
      setTitle('');
      setContent('');
      setTags([]);
      setSelectedProjectId(null);

      // Don't call onComplete - keep modal open for rapid multi-capture
      // onComplete?.();
    } catch (error) {
      // Error is handled by the mutation hook
      console.error('[QuickCapture] Submit error:', error);
    }
  };

  const handleSelectRelatedItem = (itemId: string) => {
    onNavigateToItem?.(itemId);
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(prev => prev === projectId ? null : projectId);
  };

  return (
    <div className="flex gap-4">
      {/* Main form area */}
      <div className="flex-1 space-y-3">
        {/* Title with auto-focus */}
        <Input
          ref={titleInputRef}
          placeholder="Title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-medium"
        />

        {/* Content - minimal height for quick entry */}
        <Textarea
          placeholder="Write your thoughts here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="resize-none"
        />

        {/* Tags - optional, minimal UI */}
        {tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="hover:bg-destructive/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Tags (optional)... press Enter or comma to add"
            value={tagInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm"
          />
          <Button size="icon" variant="ghost" onClick={() => handleAddTag()} className="shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Selected project indicator */}
        {selectedProjectId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Assigning to project</span>
            <button onClick={() => setSelectedProjectId(null)} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Large, prominent Save button - Cancel is secondary */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={mutation.isPending || !title.trim()}
            className="flex-1 h-12 text-base font-medium"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save to Inbox'
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onComplete?.()}
            disabled={mutation.isPending}
            className="px-4"
          >
            Cancel
          </Button>
        </div>

        {/* AI Suggestions Toggle */}
        {(title || content) && (
          <>
            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowSuggestions(!showSuggestions)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {showSuggestions ? 'Hide' : 'Show'} AI Suggestions
            </Button>
          </>
        )}
      </div>

      {/* Suggestions Sidebar */}
      {showSuggestions && (title || content) && (
        <div className="w-80 flex-shrink-0">
          <ScrollArea className="h-full max-h-[600px]">
            <ContentSuggestions
              title={title}
              content={content}
              tags={tags}
              type="note"
              onAddTag={handleAddTag}
              onSelectRelatedItem={handleSelectRelatedItem}
              onSelectProject={handleSelectProject}
            />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
