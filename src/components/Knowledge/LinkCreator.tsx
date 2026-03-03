'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { typeBadgeColors } from '@/lib/type-colors';

interface CaptureItem {
  id: string;
  title: string;
  type: string;
  status: string;
}

interface LinkCreatorProps {
  sourceItemId: string;
  onLinkCreated?: () => void;
}

const relationTypes = [
  { value: 'related', label: 'Related', description: 'General relationship' },
  { value: 'depends-on', label: 'Depends On', description: 'This item depends on the target' },
  { value: 'blocks', label: 'Blocks', description: 'This item blocks the target' },
  { value: 'references', label: 'References', description: 'This item references the target' },
];

export function LinkCreator({ sourceItemId, onLinkCreated }: LinkCreatorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CaptureItem[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [relationType, setRelationType] = useState('related');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Search for items to link
  useEffect(() => {
    const searchItems = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const response = await fetch(`/api/capture?search=${encodeURIComponent(searchQuery)}&limit=20`);
        const data = await response.json();

        // Filter out the current item
        const filtered = data.items.filter((item: CaptureItem) => item.id !== sourceItemId);
        setSearchResults(filtered);
      } catch (error) {
        console.error('Failed to search items:', error);
        toast.error('Failed to search items');
      } finally {
        setSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchItems, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, sourceItemId]);

  const handleCreateLink = async () => {
    if (!selectedTargetId) {
      toast.error('Please select an item to link');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: sourceItemId,
          targetId: selectedTargetId,
          relationType,
          note: note || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create link');
      }

      toast.success('Link created successfully');
      setOpen(false);
      setSelectedTargetId('');
      setRelationType('related');
      setNote('');
      setSearchQuery('');
      onLinkCreated?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create link');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    return typeBadgeColors[type] || 'bg-gray-500/20 text-gray-700 dark:bg-gray-600/30 dark:text-gray-300';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Link2 className="w-4 h-4" />
          Add Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Create Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search for target item */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search for Item to Link</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Type to search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              <label className="text-sm font-medium">Select Item</label>
              <div className="space-y-1">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedTargetId(item.id);
                      setSearchQuery(item.title);
                      setSearchResults([]);
                    }}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedTargetId === item.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(item.type)}`}>
                        {item.type}
                      </span>
                      <span className="text-sm truncate">{item.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Relationship type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Relationship Type</label>
            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {relationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional note */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Note (Optional)</label>
            <Textarea
              placeholder="Add a note about this relationship..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateLink}
              disabled={!selectedTargetId || loading}
              className="flex-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
              Create Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
