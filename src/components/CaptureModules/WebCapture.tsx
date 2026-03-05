'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2, Globe, Link, CircleX } from 'lucide-react';
import { toast } from 'sonner';

interface WebCaptureProps {
  onComplete?: () => void;
}

export function WebCapture({ onComplete }: WebCaptureProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [capturedData, setCapturedData] = useState<{
    title: string;
    content: string;
    favicon?: string;
    tags: string[];
  } | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight request on unmount
  useEffect(() => () => { abortControllerRef.current?.abort(); }, []);

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

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleCapture = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    let validUrl = url.trim();
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }

    if (!validateUrl(validUrl)) {
      toast.error('Please enter a valid URL');
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setLoadingStatus('Connecting to webpage...');

    try {
      setLoadingStatus('Extracting content...');
      const response = await fetch('/api/capture/webpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validUrl }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to capture');
      }

      setLoadingStatus('Processing extracted data...');
      const data = await response.json();
      setCapturedData({
        title: data.title,
        content: data.content,
        favicon: data.favicon,
        tags: data.tags || [],
      });
      setEditedTitle(data.title);
      setEditedContent(data.content);
      setTags(data.tags || []);
      toast.success('Web page captured!');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Capture cancelled');
      } else {
        // Display specific error message from API or generic message
        const errorMessage = error instanceof Error ? error.message : 'Failed to capture web page';
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
      setLoadingStatus('');
      abortControllerRef.current = null;
    }
  };

  const handleCancelCapture = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setLoadingStatus('');
      abortControllerRef.current = null;
    }
  };

  const handleSaveToInbox = async () => {
    if (!capturedData) return;

    setLoading(true);
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'webpage',
          title: editedTitle || capturedData.title,
          content: editedContent || capturedData.content,
          sourceUrl: url,
          imageUrl: capturedData.favicon,
          tags,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success('Saved to inbox!');
      setUrl('');
      setCapturedData(null);
      setEditedTitle('');
      setEditedContent('');
      setTags([]);
      
      onComplete?.();
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Enter URL to capture..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="pl-10"
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleCapture()}
          />
        </div>
        {loading && !capturedData ? (
          <>
            <Button
              variant="outline"
              onClick={handleCancelCapture}
              className="gap-2"
            >
              <CircleX className="w-4 h-4" />
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={handleCapture} disabled={loading || !url}>
            {loading && capturedData ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Capture
          </Button>
        )}
      </div>

      {/* Loading State */}
      {loading && !capturedData && (
        <div className="flex items-center gap-3 p-4 border rounded-xl bg-muted/30">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div className="flex-1">
            <p className="font-medium">Extracting webpage content</p>
            <p className="text-sm text-muted-foreground">{loadingStatus}</p>
          </div>
        </div>
      )}

      {/* Captured Preview */}
      {capturedData && (
        <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            {capturedData.favicon && (
              <img
                src={capturedData.favicon}
                alt=""
                className="w-6 h-6 rounded"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
            )}
            <div className="flex-1 min-w-0">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="font-medium"
                placeholder="Page title..."
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-1">
                <Link className="w-3 h-3" />
                <span className="truncate">{url}</span>
              </div>
            </div>
          </div>

          {/* Editable Content */}
          <div>
            <label className="text-sm font-medium mb-2 block">Content</label>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[120px] p-3 text-sm rounded-md border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Page content..."
            />
          </div>
        </div>
      )}

      {/* Tags */}
      {capturedData && (
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
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onComplete?.()}>
          Cancel
        </Button>
        <Button 
          onClick={handleSaveToInbox} 
          disabled={loading || !capturedData}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save to Inbox
        </Button>
      </div>
    </div>
  );
}
