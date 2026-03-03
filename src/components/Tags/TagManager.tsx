'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Merge,
  Search,
  Check,
  X,
  BarChart3,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { TagManagerSkeleton } from '@/components/LoadingStates/TagManagerSkeleton';

interface Tag {
  name: string;
  count: number;
}

export function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  // Form states
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editedTagName, setEditedTagName] = useState('');
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [mergingTag, setMergingTag] = useState<Tag | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');

  // Fetch tags
  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: sortBy,
        order: sortOrder,
      });
      const response = await fetch(`/api/tags?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Create tag
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tag');
      }

      toast.success(`Tag "${newTagName.trim()}" created`);
      setCreateDialogOpen(false);
      setNewTagName('');
      fetchTags();
    } catch (error) {
      console.error('Create tag error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    }
  };

  // Edit tag
  const handleEditTag = async () => {
    if (!editingTag || !editedTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: editingTag.name,
          newName: editedTagName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename tag');
      }

      const data = await response.json();
      toast.success(`Renamed "${editingTag.name}" to "${editedTagName.trim()}" (${data.affectedItems} items updated)`);
      setEditDialogOpen(false);
      setEditingTag(null);
      setEditedTagName('');
      fetchTags();
    } catch (error) {
      console.error('Edit tag error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rename tag');
    }
  };

  // Delete tag
  const handleDeleteTag = async () => {
    if (!deletingTag) return;

    try {
      const response = await fetch(`/api/tags?name=${encodeURIComponent(deletingTag.name)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete tag');
      }

      const data = await response.json();
      toast.success(`Tag "${deletingTag.name}" deleted (${data.affectedItems} items updated)`);
      setDeleteDialogOpen(false);
      setDeletingTag(null);
      fetchTags();
    } catch (error) {
      console.error('Delete tag error:', error);
      toast.error('Failed to delete tag');
    }
  };

  // Merge tags
  const handleMergeTags = async () => {
    if (!mergingTag || !mergeTarget) {
      toast.error('Please select a target tag');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: mergingTag.name,
          mergeInto: mergeTarget,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to merge tags');
      }

      const data = await response.json();
      toast.success(`Merged "${mergingTag.name}" into "${mergeTarget}" (${data.affectedItems} items updated)`);
      setMergeDialogOpen(false);
      setMergingTag(null);
      setMergeTarget('');
      fetchTags();
    } catch (error) {
      console.error('Merge tags error:', error);
      toast.error('Failed to merge tags');
    }
  };

  // Filter tags by search query
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate statistics
  const totalTags = tags.length;
  const totalTagUsages = tags.reduce((sum, tag) => sum + tag.count, 0);
  const avgUsagesPerTag = totalTags > 0 ? Math.round(totalTagUsages / totalTags) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6 text-purple-500" />
            Tag Manager
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and organize your tags
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Tag
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Total Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTags}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Total Usages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTagUsages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Avg. Usages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgUsagesPerTag}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search tags"
                id="tag-search"
              />
            </div>
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [s, o] = value.split('-');
              setSortBy(s as 'count' | 'name');
              setSortOrder(o as 'asc' | 'desc');
            }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count-desc">Most Used</SelectItem>
                <SelectItem value="count-asc">Least Used</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tags List */}
      {loading ? (
        <TagManagerSkeleton />
      ) : filteredTags.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No tags match your search' : 'No tags yet. Create your first tag to get started!'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {filteredTags.map((tag, index) => (
                <motion.div
                  key={tag.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  role="listitem"
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge variant="secondary" className="text-sm">
                      #{tag.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {tag.count} {tag.count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditingTag(tag);
                        setEditedTagName(tag.name);
                        setEditDialogOpen(true);
                      }}
                      title="Rename tag"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setMergingTag(tag);
                        setMergeTarget('');
                        setMergeDialogOpen(true);
                      }}
                      title="Merge tag"
                    >
                      <Merge className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeletingTag(tag);
                        setDeleteDialogOpen(true);
                      }}
                      title="Delete tag"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Tag Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Tag
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-tag-name">Tag Name</Label>
              <Input
                id="new-tag-name"
                placeholder="e.g., important, todo, reference"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Tag names can contain letters, numbers, and spaces. Max 50 characters.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setNewTagName('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTag}>Create Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              Rename Tag
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">Tag Name</Label>
              <Input
                id="edit-tag-name"
                value={editedTagName}
                onChange={(e) => setEditedTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleEditTag();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Renaming will update all items tagged with "{editingTag?.name}"
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setEditingTag(null);
              setEditedTagName('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditTag}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tag Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Tag
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag <strong>"{deletingTag?.name}"</strong>?
              This will remove the tag from {deletingTag?.count} {deletingTag?.count === 1 ? 'item' : 'items'}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingTag(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Tags Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5" />
              Merge Tags
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Merge <strong>"{mergingTag?.name}"</strong> into another tag. All items with "{mergingTag?.name}" will be updated to use the target tag instead.
            </p>
            <div className="space-y-2">
              <Label htmlFor="merge-target">Merge Into</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger id="merge-target">
                  <SelectValue placeholder="Select a tag..." />
                </SelectTrigger>
                <SelectContent>
                  {tags
                    .filter(t => t.name !== mergingTag?.name)
                    .map(tag => (
                      <SelectItem key={tag.name} value={tag.name}>
                        #{tag.name} ({tag.count} items)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMergeDialogOpen(false);
              setMergingTag(null);
              setMergeTarget('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleMergeTags} disabled={!mergeTarget}>
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
