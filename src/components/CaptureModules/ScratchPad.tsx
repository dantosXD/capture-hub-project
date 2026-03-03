'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Loader2, Clock, FileText, Eye, Edit, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SecureMarkdown } from '@/components/ui/secure-markdown';

interface ScratchPadProps {
  onComplete?: () => void;
}

export function ScratchPad({ onComplete }: ScratchPadProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [scratchPadId, setScratchPadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState({ title: '', content: '', tags: [] as string[] });

  // Word count and reading time
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.ceil(wordCount / 200);

  const handleAutoSave = useCallback(async () => {
    if (!title && !content) return;

    setSaving(true);
    try {
      if (scratchPadId) {
        await fetch(`/api/capture/${scratchPadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title || 'Untitled Scratch Pad',
            content,
            tags,
          }),
        });
      } else {
        const response = await fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'scratchpad',
            title: title || 'Untitled Scratch Pad',
            content,
            tags,
            status: 'inbox',
          }),
        });
        const data = await response.json();
        setScratchPadId(data.id);
      }
      setLastSaved(new Date());
      setLastSavedContent({ title, content, tags });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [title, content, tags, scratchPadId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!content && !title) return;

    const interval = setInterval(() => {
      handleAutoSave();
    }, 30000);

    return () => clearInterval(interval);
  }, [content, title, handleAutoSave]);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges =
      title !== lastSavedContent.title ||
      content !== lastSavedContent.content ||
      JSON.stringify(tags) !== JSON.stringify(lastSavedContent.tags);

    setHasUnsavedChanges(hasChanges);
  }, [title, content, tags, lastSavedContent]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
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
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() && !content.trim()) {
      toast.error('Please enter a title or content');
      return;
    }

    setLoading(true);
    try {
      if (scratchPadId) {
        // Update existing and move to inbox
        await fetch(`/api/capture/${scratchPadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title || 'Untitled Scratch Pad',
            content,
            tags,
            status: 'inbox',
          }),
        });
      } else {
        const response = await fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'scratchpad',
            title: title || 'Untitled Scratch Pad',
            content,
            tags,
          }),
        });
        if (!response.ok) throw new Error('Failed to save');
      }

      toast.success('Saved to inbox!');
      setTitle('');
      setContent('');
      setTags([]);
      setScratchPadId(null);
      setLastSaved(null);
      setLastSavedContent({ title: '', content: '', tags: [] });
      setHasUnsavedChanges(false);

      onComplete?.();
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Title Input */}
      <div className="space-y-2">
        <Input
          placeholder="Title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-medium"
        />
      </div>

      {/* Editor with Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit" className="gap-2">
            <Edit className="w-4 h-4" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4">
          {/* Markdown Editor */}
          <div className="border rounded-md min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your notes here... Full markdown supported!

# Headers
**Bold**, *italic*, `code`
- Lists
- [Links](url)

```javascript
// Code blocks
const test = 'hello';
```"
              className="w-full min-h-[300px] max-h-[500px] p-4 bg-background text-foreground font-mono text-sm resize-none focus:outline-none"
              style={{
                lineHeight: '1.6',
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {/* Live Preview */}
          <div className="border rounded-md min-h-[300px] max-h-[500px] overflow-auto custom-scrollbar p-4 bg-background">
            {content ? (
              <SecureMarkdown className="max-w-none break-words">
                {content}
              </SecureMarkdown>
            ) : (
              <div className="text-muted-foreground text-center py-12">
                Preview will appear here...
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <FileText className="w-4 h-4" />
          <span>{wordCount} words</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{readingTime} min read</span>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-2 ml-auto">
          {saving && (
            <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs font-medium">Saving...</span>
            </div>
          )}
          {!saving && lastSaved && !hasUnsavedChanges && (
            <div className="flex items-center gap-1.5 text-green-500 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">
                Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
          {!saving && hasUnsavedChanges && (title || content) && (
            <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Unsaved changes</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button onClick={() => handleRemoveTag(tag)}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button size="icon" variant="outline" onClick={handleAddTag}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onComplete?.()}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save to Inbox
        </Button>
      </div>

      {/* Markdown hint */}
      <div className="text-xs text-muted-foreground">
        <p><strong>Markdown supported:</strong> Headers (#), Lists (-, 1.), Code blocks (```), Bold (**text**), Italic (*text*), Links ([text](url)), Images (
![alt](url)
), Strikethrough (~~text~~)</p>
      </div>
    </div>
  );
}
