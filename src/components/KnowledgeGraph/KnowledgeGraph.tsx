'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  Link2,
  X,
  Plus,
  Search,
  Loader2,
  ChevronRight,
  GitBranch,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';
import { typeHexColors } from '@/lib/type-colors';
import { KnowledgeGraphSkeleton } from '@/components/LoadingStates/KnowledgeGraphSkeleton';

interface Link {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  note: string | null;
  createdAt: string;
}

interface LinkedItem {
  id: string;
  title: string;
  type: string;
}

interface GraphNode {
  id: string;
  title: string;
  type: string;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface KnowledgeGraphProps {
  itemId?: string;
  onSelectItem?: (id: string) => void;
}

const typeColors = typeHexColors;

const relationTypeColors: Record<string, string> = {
  related: '#64748b',
  'depends-on': '#f97316',
  blocks: '#ef4444',
  references: '#6366f1',
};

export function KnowledgeGraph({ itemId, onSelectItem }: KnowledgeGraphProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LinkedItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [relationType, setRelationType] = useState('related');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Lock body scroll when dialogs are open
  useBodyScrollLock(addDialogOpen || deleteDialogOpen);

  const { on } = useWebSocket();

  const fetchLinks = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/links?itemId=${itemId}`);
      const data = await response.json();
      setLinks(data.links || []);
      setLinkedItems(data.linkedItems || []);
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Listen for link:created WebSocket events
  useEffect(() => {
    if (!itemId) return;

    const cleanupLinkCreated = on(WSEventType.LINK_CREATED, (data: { id: string; sourceId: string; targetId: string; relationType: string; createdAt: string }) => {
      // If the link involves the current item, refresh the links
      if (data.sourceId === itemId || data.targetId === itemId) {
        console.log('[KnowledgeGraph] Link created event received, refreshing links:', data);
        fetchLinks();
      }
    });

    return () => cleanupLinkCreated();
  }, [on, itemId, fetchLinks]);

  // Listen for link:deleted WebSocket events
  useEffect(() => {
    if (!itemId) return;

    const cleanupLinkDeleted = on(WSEventType.LINK_DELETED, (data: { sourceId: string; targetId: string; deletedAt: string }) => {
      // If the deleted link involves the current item, refresh the links
      if (data.sourceId === itemId || data.targetId === itemId) {
        console.log('[KnowledgeGraph] Link deleted event received, refreshing links:', data);
        // Optimistically remove the link from state
        setLinks((prev) => prev.filter(
          (link) => !(link.sourceId === data.sourceId && link.targetId === data.targetId)
        ));
        // Then fetch fresh data from server
        fetchLinks();
      }
    });

    return () => cleanupLinkDeleted();
  }, [on, itemId, fetchLinks]);

  const searchItems = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults((data.items || []).slice(0, 5));
    } catch (error) {
      console.error('Failed to search items:', error);
    }
  };

  const handleAddLink = async () => {
    if (!itemId || !selectedTarget) return;

    setAdding(true);
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: itemId,
          targetId: selectedTarget,
          relationType,
          note: note || null,
        }),
      });

      if (response.ok) {
        toast.success('Link created successfully');
        fetchLinks();
        setAddDialogOpen(false);
        setSelectedTarget('');
        setSearchQuery('');
        setRelationType('related');
        setNote('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create link');
      }
    } catch (error) {
      console.error('Failed to add link:', error);
      toast.error('Failed to create link');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveLink = async (sourceId: string, targetId: string) => {
    setLinkToDelete({ sourceId, targetId });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteLink = async () => {
    if (!linkToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/links?sourceId=${linkToDelete.sourceId}&targetId=${linkToDelete.targetId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Link removed successfully');
        fetchLinks();
        setDeleteDialogOpen(false);
        setLinkToDelete(null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to remove link');
      }
    } catch (error) {
      console.error('Failed to remove link:', error);
      toast.error('Failed to remove link');
    } finally {
      setDeleting(false);
    }
  };

  if (!itemId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Network className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select an item to view its connections</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <KnowledgeGraphSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="w-5 h-5 text-indigo-500" />
              Connections
            </CardTitle>
            <CardDescription>
              {links.length} link{links.length !== 1 ? 's' : ''} to other items
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Link
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Link2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No connections yet</p>
            <p className="text-xs">Link this item to related items</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {links.map((link) => {
                const linkedItem = linkedItems.find(
                  i => i.id === (link.sourceId === itemId ? link.targetId : link.sourceId)
                );
                if (!linkedItem) return null;
                
                const isSource = link.sourceId === itemId;
                
                return (
                  <motion.div
                    key={link.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: typeColors[linkedItem.type] || '#64748b' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm truncate cursor-pointer hover:text-primary"
                        onClick={() => onSelectItem?.(linkedItem.id)}
                      >
                        {linkedItem.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1">
                          {isSource ? '→' : '←'} {link.relationType}
                        </Badge>
                        <span className="capitalize">{linkedItem.type}</span>
                      </div>
                      {link.note && (
                        <p className="text-xs text-muted-foreground mt-1 truncate italic">
                          {link.note}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6"
                      onClick={() => handleRemoveLink(link.sourceId, link.targetId)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>

      {/* Add Link Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Another Item</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Items</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchItems(e.target.value);
                  }}
                  placeholder="Search items to link..."
                  className="pl-9"
                />
              </div>
              
              {searchResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto custom-scrollbar">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      className={`w-full flex items-center gap-2 p-2 text-left hover:bg-muted ${
                        selectedTarget === item.id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => {
                        setSelectedTarget(item.id);
                        setSearchQuery(item.title);
                        setSearchResults([]);
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: typeColors[item.type] || '#64748b' }}
                      />
                      <span className="truncate flex-1">{item.title}</span>
                      <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Relationship Type</label>
              <Select value={relationType} onValueChange={setRelationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="related">Related to</SelectItem>
                  <SelectItem value="depends-on">Depends on</SelectItem>
                  <SelectItem value="blocks">Blocks</SelectItem>
                  <SelectItem value="references">References</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Note (optional)</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note about this relationship..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLink} disabled={!selectedTarget || adding}>
              {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Link Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this link? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLink}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
