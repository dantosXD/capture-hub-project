'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FolderOpen,
  Calendar,
  Pin,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  Image as ImageIcon,
  Globe,
  ScrollText,
  CheckCircle2,
  Clock,
  Archive,
  Loader2,
  Link2,
  Inbox,
  Plus,
  Search,
  X,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { ColorPicker, DEFAULT_PROJECT_COLOR } from '@/components/Projects/ColorPicker';
import { EmptyState } from '@/components/EmptyState';
import { typeBgColors } from '@/lib/type-colors';

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CaptureItem {
  id: string;
  type: string;
  title: string;
  content: string | null;
  tags: string[];
  priority: string;
  status: string;
  createdAt: string;
  pinned?: boolean;
}

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface ProjectDetailResponse {
  project: Project & {
    items: CaptureItem[];
    itemCount: number;
  };
  templates?: Template[];
}

const statusColors: Record<string, string> = {
  active: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/20',
  'on-hold': 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/20',
  completed: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20',
  archived: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300 border-slate-500/20',
};

const statusIcons: Record<string, React.ReactNode> = {
  active: <CheckCircle2 className="w-3 h-3" />,
  'on-hold': <Clock className="w-3 h-3" />,
  completed: <Archive className="w-3 h-3" />,
  archived: <Archive className="w-3 h-3" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  note: <FileText className="w-4 h-4" />,
  screenshot: <ImageIcon className="w-4 h-4" />,
  ocr: <ImageIcon className="w-4 h-4" />,
  webpage: <Globe className="w-4 h-4" />,
  scratchpad: <ScrollText className="w-4 h-4" />,
};

const typeColors = typeBgColors;


export function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [projectData, setProjectData] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Assign items state
  const [availableItems, setAvailableItems] = useState<CaptureItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CaptureItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);

  // Lock body scroll when dialogs are open
  useBodyScrollLock(editDialogOpen || deleteDialogOpen || assignDialogOpen);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_PROJECT_COLOR);
  const [editStatus, setEditStatus] = useState('active');
  const [editPriority, setEditPriority] = useState('medium');

  useEffect(() => {
    fetchProjectDetail();
  }, [projectId]);

  const fetchProjectDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Project not found');
        } else {
          setError('Failed to load project');
        }
        return;
      }
      const data = await response.json();
      setProjectData(data);
    } catch (err) {
      console.error('Failed to fetch project detail:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/capture/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: null }),
      });

      if (response.ok) {
        // Refresh project data
        fetchProjectDetail();
        toast.success('Item unassigned from project');
      }
    } catch (err) {
      console.error('Failed to unassign item:', err);
      toast.error('Failed to unassign item');
    }
  };

  const loadAvailableItems = async () => {
    setLoadingItems(true);
    try {
      // Fetch items that are not already assigned to this project
      const response = await fetch('/api/capture?limit=100');
      if (response.ok) {
        const data = await response.json();
        // Filter out items already assigned to this project
        const assignedIds = projectData?.project.items.map(i => i.id) || [];
        const unassignedItems = data.items.filter((item: CaptureItem) => !assignedIds.includes(item.id));
        setAvailableItems(unassignedItems);
        setFilteredItems(unassignedItems);
      }
    } catch (err) {
      console.error('Failed to load available items:', err);
      toast.error('Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleOpenAssignDialog = () => {
    setSelectedItemIds(new Set());
    setSearchQuery('');
    loadAvailableItems();
    setAssignDialogOpen(true);
  };

  const handleToggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleAssignItems = async () => {
    if (selectedItemIds.size === 0) {
      toast.error('Please select at least one item');
      return;
    }

    setSubmitting(true);
    try {
      // Assign all selected items to this project
      const promises = Array.from(selectedItemIds).map(itemId =>
        fetch(`/api/capture/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.ok);

      if (allSuccess) {
        toast.success(`${selectedItemIds.size} item(s) assigned to project`);
        setAssignDialogOpen(false);
        setSelectedItemIds(new Set());
        fetchProjectDetail();
      } else {
        toast.error('Some items failed to assign');
      }
    } catch (err) {
      console.error('Failed to assign items:', err);
      toast.error('Failed to assign items');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(availableItems);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = availableItems.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, availableItems]);

  const openEditDialog = () => {
    if (!projectData) return;
    const { project } = projectData;
    setEditName(project.name);
    setEditDescription(project.description || '');
    setEditColor(project.color);
    setEditStatus(project.status);
    setEditPriority(project.priority);
    setEditDialogOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!editName.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          color: editColor,
          status: editStatus,
          priority: editPriority,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProjectData(prev => prev ? { ...prev, project: { ...prev.project, ...data.project } } : null);
        setEditDialogOpen(false);
        toast.success('Project updated successfully');
      } else {
        toast.error('Failed to update project');
      }
    } catch (err) {
      console.error('Failed to update project:', err);
      toast.error('Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Project deleted successfully');
        setDeleteDialogOpen(false);
        setTimeout(() => {
          router.push('/?view=projects');
        }, 500);
      } else {
        toast.error('Failed to delete project');
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      toast.error('Failed to delete project');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Error</h3>
          <p className="text-muted-foreground mb-4">{error || 'Project not found'}</p>
          <Button onClick={() => router.push('/?view=projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { project } = projectData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/?view=projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openEditDialog}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the project "{projectData?.project.name}". All associated items will be unassigned but not deleted. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProject}
                  disabled={submitting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Delete Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Project Info Card */}
      <Card className="overflow-hidden">
        {/* Project color accent bar */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: project.color }}
        />
        <CardHeader>
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl border"
              style={{ backgroundColor: `${project.color}20`, borderColor: `${project.color}40` }}
            >
              {project.icon || '📁'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <Badge variant="outline" className={statusColors[project.status]}>
                  {statusIcons[project.status]}
                  <span className="ml-1 capitalize">{project.status}</span>
                </Badge>
              </div>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FolderOpen className="w-4 h-4" />
                  {project.itemCount} items
                </div>
                {project.dueDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Due: {new Date(project.dueDate).toLocaleDateString()}
                  </div>
                )}
                <Badge variant="outline">
                  {project.priority}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Associated Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-500" />
              Associated Items
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleOpenAssignDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Assign Items
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {project.items.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="w-full h-full text-muted-foreground/50" />}
              title="No items assigned yet"
              description="Assign items from your inbox to this project to keep everything organized."
              action={{
                label: 'Go to Inbox',
                onClick: () => router.push('/?view=inbox'),
                icon: <Inbox className="w-4 h-4" />,
              }}
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {project.items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`w-8 h-8 rounded flex items-center justify-center text-white ${typeColors[item.type] || 'bg-gray-500'}`}
                      >
                        {typeIcons[item.type] || <FileText className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.title}</span>
                          {item.pinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {item.type}
                          </Badge>
                          {item.tags.length > 0 && (
                            <div className="flex gap-1">
                              {item.tags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {item.tags.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{item.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnassignItem(item.id)}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      Unassign
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Associated Templates */}
      {projectData.templates && projectData.templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Project Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projectData.templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div>
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {template.category}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Link2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <ColorPicker value={editColor} onChange={setEditColor} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <select
                  id="edit-priority"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject} disabled={submitting || !editName.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Items Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Items to Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items by title, content, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Selected count */}
            {selectedItemIds.size > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{selectedItemIds.size} item(s) selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItemIds(new Set())}
                >
                  Clear selection
                </Button>
              </div>
            )}

            {/* Items List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-lg">
              {loadingItems ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Inbox className="w-8 h-8 mb-2" />
                  <p className="text-sm">
                    {searchQuery ? 'No items match your search' : 'No items available to assign'}
                  </p>
                </div>
              ) : (
                <div className="divide-y max-h-80">
                  {filteredItems.map((item) => {
                    const isSelected = selectedItemIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItemSelection(item.id)}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                          isSelected ? 'bg-primary/10' : ''
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div
                          className={`w-8 h-8 rounded flex items-center justify-center text-white ${typeColors[item.type] || 'bg-gray-500'}`}
                        >
                          {typeIcons[item.type] || <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.type}
                            </Badge>
                            {item.tags.length > 0 && (
                              <div className="flex gap-1">
                                {item.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {item.tags.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{item.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignItems}
              disabled={submitting || selectedItemIds.size === 0}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign {selectedItemIds.size > 0 && selectedItemIds.size} Item{selectedItemIds.size !== 1 && 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
