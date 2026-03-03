'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Archive,
  Trash2,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  Zap,
  Tag,
  FolderOpen,
  Loader2,
  RefreshCw,
  Inbox,
  Lightbulb,
  Folder,
  Check,
  Eye,
  Rocket,
  X,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { safeFormatRelative } from '@/lib/safe-date';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';
import { EmptyState } from '@/components/EmptyState';
import { typeBgColors } from '@/lib/type-colors';

interface ProcessingWorkflowProps {
  staleItems: Array<{ id: string; title: string; type: string; createdAt: string }>;
  onSelectItem?: (id: string) => void;
  onNavigate?: (view: string) => void;
}

interface ProcessingItem {
  id: string;
  title: string;
  type: string;
  content?: string;
  tags: string[];
  createdAt: string;
  status?: string;
  aiSuggestion?: string;
  suggestedTags?: string[];
  suggestedProject?: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

const assignOptions = [
  { value: 'none', label: 'Unassigned' },
  { value: 'Projects', label: 'Projects' },
  { value: 'Tasks', label: 'Tasks' },
  { value: 'Review', label: 'Review' },
];

export function ProcessingWorkflow({ staleItems, onSelectItem, onNavigate }: ProcessingWorkflowProps) {
  const [currentItem, setCurrentItem] = useState<ProcessingItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [processedCount, setProcessedCount] = useState(0);
  const [items, setItems] = useState<ProcessingItem[]>([]);
  const [gtdGuideOpen, setGtdGuideOpen] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignedTo, setSelectedAssignedTo] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Track processing statistics for completion summary (feature #412)
  const [archivedCount, setArchivedCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);

  // Track current card direction for animations (feature #413)
  const [cardDirection, setCardDirection] = useState<'next' | 'previous' | null>(null);

  // WebSocket hook for real-time sync
  const { on: onWsEvent } = useWebSocket();

  // Fetch items for processing
  useEffect(() => {
    fetchItemsForProcessing();
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchItemsForProcessing = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inbox?status=inbox&limit=10');
      const data = await response.json();
      const parsedItems = (data.items || []).map((item: any) => ({
        ...item,
        tags: Array.isArray(item.tags) ? item.tags : (item.tags ? JSON.parse(item.tags) : []),
      }));
      setItems(parsedItems);
      if (parsedItems.length > 0 && !currentItem) {
        setCurrentItem(parsedItems[0]);
        if (aiEnabled) {
          fetchAISuggestion(parsedItems[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAISuggestion = useCallback(async (item: ProcessingItem) => {
    try {
      const response = await fetch('/api/ai/process-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await response.json();

      if (data.suggestion) {
        setCurrentItem(prev => prev ? {
          ...prev,
          aiSuggestion: data.suggestion,
          suggestedTags: data.suggestedTags,
          suggestedProject: data.suggestedProject,
        } : null);
      }
    } catch (error) {
      console.error('Failed to get AI suggestion:', error);
    }
  }, []);

  // WebSocket event handler for item updates (feature #309)
  // When an item is processed on another device, update local state
  useEffect(() => {
    const cleanup = onWsEvent(WSEventType.ITEM_UPDATED, (data: any) => {
      const { id, changes } = data;

      // If the item status changed to something other than 'inbox', remove it from queue
      if (changes.status && changes.status !== 'inbox') {
        setItems(prevItems => {
          const filtered = prevItems.filter(item => item.id !== id);

          // If the removed item was current, move to next
          if (currentItem?.id === id) {
            setCardDirection('next');
            if (filtered.length > 0) {
              const nextItem = filtered[0];
              setCurrentItem(nextItem);
              if (aiEnabled) {
                fetchAISuggestion(nextItem);
              }
            } else {
              setCurrentItem(null);
            }
          }

          return filtered;
        });

        // Increment processed count if another device processed an item
        if (changes.status === 'archived' || changes.status === 'assigned' || changes.status === 'trash') {
          setProcessedCount(prev => prev + 1);
        }
      }
    });

    return cleanup;
  }, [currentItem, aiEnabled, onWsEvent, fetchAISuggestion]);

  // Also listen for item deletion events
  useEffect(() => {
    const cleanup = onWsEvent(WSEventType.ITEM_DELETED, (data: any) => {
      const { id } = data;

      setItems(prevItems => {
        const filtered = prevItems.filter(item => item.id !== id);

        // If the deleted item was current, move to next
        if (currentItem?.id === id) {
          setCardDirection('next');
          if (filtered.length > 0) {
            const nextItem = filtered[0];
            setCurrentItem(nextItem);
            if (aiEnabled) {
              fetchAISuggestion(nextItem);
            }
          } else {
            setCurrentItem(null);
          }
        }

        return filtered;
      });
    });

    return cleanup;
  }, [currentItem, aiEnabled, onWsEvent, fetchAISuggestion]);

  const handleAction = async (action: 'archive' | 'delete' | 'assign' | 'keep') => {
    if (!currentItem) return;

    // For assign action, open the dialog first
    if (action === 'assign') {
      setAssignDialogOpen(true);
      // Set defaults from AI suggestion if available
      setSelectedAssignedTo(currentItem.suggestedProject || '');
      setSelectedProjectId('');
      return;
    }

    try {
      const previousStatus = currentItem.status || 'inbox';
      setCardDirection('next'); // Set animation direction (feature #413)

      const response = await fetch(`/api/capture/${currentItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'delete' ? 'trash' : action === 'archive' ? 'archived' : 'assigned',
        }),
      });

      if (response.ok) {
        setProcessedCount(prev => prev + 1);

        // Track processing statistics (feature #412)
        if (action === 'archive') {
          setArchivedCount(prev => prev + 1);
          toast.success('Item archived');
        } else if (action === 'delete') {
          setDeletedCount(prev => prev + 1);
          toast.success('Item moved to trash', {
            action: {
              label: 'Undo',
              onClick: async () => {
                try {
                  await fetch(`/api/capture/${currentItem.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: previousStatus }),
                  });
                  toast.success('Item restored to inbox');
                  // Optionally refresh items
                  fetchItemsForProcessing();
                } catch (error) {
                  toast.error('Failed to undo deletion');
                }
              },
            },
          });
        }

        // Move to next item with animation delay (feature #413)
        const currentIndex = items.findIndex(i => i.id === currentItem.id);
        if (currentIndex < items.length - 1) {
          const nextItem = items[currentIndex + 1];

          // Remove current item immediately
          setItems(prev => prev.filter(i => i.id !== currentItem.id));

          // Delay setting next item for smooth transition
          setTimeout(() => {
            setCurrentItem(nextItem);
            if (aiEnabled) {
              fetchAISuggestion(nextItem);
            }
          }, 200);
        } else {
          // Last item - show completion screen (feature #412)
          setItems([]);
          setTimeout(() => {
            setCurrentItem(null);
            setShowCompletion(true);
          }, 200);
        }
      } else {
        toast.error('Failed to process item');
        setCardDirection(null);
      }
    } catch (error) {
      console.error('Failed to process item:', error);
      toast.error('Failed to process item');
      setCardDirection(null);
    }
  };

  const handleAssignConfirm = async () => {
    if (!currentItem) return;

    try {
      setCardDirection('next'); // Set animation direction (feature #413)

      const updateData: any = {
        status: 'assigned',
      };

      // Only set assignedTo if a value is selected
      if (selectedAssignedTo && selectedAssignedTo !== 'none') {
        updateData.assignedTo = selectedAssignedTo;
      }

      // Only set projectId if a value is selected
      if (selectedProjectId && selectedProjectId !== 'none') {
        updateData.projectId = selectedProjectId;
      }

      const response = await fetch(`/api/capture/${currentItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setProcessedCount(prev => prev + 1);
        setAssignedCount(prev => prev + 1); // Track assigned items (feature #412)
        setAssignDialogOpen(false);
        setSelectedAssignedTo('');
        setSelectedProjectId('');

        toast.success('Item assigned successfully');

        // Move to next item with animation delay (feature #413)
        const currentIndex = items.findIndex(i => i.id === currentItem.id);
        if (currentIndex < items.length - 1) {
          const nextItem = items[currentIndex + 1];

          // Remove current item immediately
          setItems(prev => prev.filter(i => i.id !== currentItem.id));

          // Delay setting next item for smooth transition
          setTimeout(() => {
            setCurrentItem(nextItem);
            if (aiEnabled) {
              fetchAISuggestion(nextItem);
            }
          }, 200);
        } else {
          // Last item - show completion screen (feature #412)
          setItems([]);
          setTimeout(() => {
            setCurrentItem(null);
            setShowCompletion(true);
          }, 200);
        }
      } else {
        toast.error('Failed to assign item');
        setCardDirection(null);
      }
    } catch (error) {
      console.error('Failed to assign item:', error);
      toast.error('Failed to assign item');
      setCardDirection(null);
    }
  };

  const handleAssignCancel = () => {
    setAssignDialogOpen(false);
    setSelectedAssignedTo('');
    setSelectedProjectId('');
  };

  const skipItem = () => {
    if (!currentItem) return;

    setCardDirection('next'); // Set animation direction (feature #413)

    const currentIndex = items.findIndex(i => i.id === currentItem.id);
    if (currentIndex < items.length - 1) {
      const nextItem = items[currentIndex + 1];
      // Remove skipped item from current queue but keep it in inbox
      setItems(prev => prev.filter(i => i.id !== currentItem.id));
      toast.info('Skipped - item remains in inbox for later');

      // Delay setting next item for smooth transition (feature #413)
      setTimeout(() => {
        setCurrentItem(nextItem);
        if (aiEnabled) {
          fetchAISuggestion(nextItem);
        }
      }, 200);
    } else {
      // If this is the last item, just show message and clear current item
      toast.info('Skipped - item remains in inbox for later');
      setItems(prev => prev.filter(i => i.id !== currentItem.id));
      setTimeout(() => {
        setCurrentItem(null);
      }, 200);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0 || !currentItem) {
    // Show completion screen when all items processed (feature #412)
    if (showCompletion && processedCount > 0) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <Card className="border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              {/* Celebration Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex justify-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      rotate: [0, 10, -10, 10, -10, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 0.5,
                      delay: 0.3,
                    }}
                  >
                    <CheckCircle2 className="w-24 h-24 text-green-500" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles className="w-8 h-8 text-yellow-500" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Congratulations Message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                  Inbox Zero! 🎉
                </h2>
                <p className="text-muted-foreground">
                  Amazing work! You've processed all items in your inbox.
                </p>
              </motion.div>

              {/* Summary Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-3 gap-4 pt-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Archive className="w-4 h-4 text-blue-500" />
                    <span className="text-2xl font-bold">{archivedCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Archived</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <FolderOpen className="w-4 h-4 text-indigo-500" />
                    <span className="text-2xl font-bold">{assignedCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Assigned</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1">
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span className="text-2xl font-bold">{deletedCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Deleted</p>
                </div>
              </motion.div>

              {/* Next Actions Suggestions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3 pt-4 border-t"
              >
                <p className="text-sm font-medium text-muted-foreground">What's next?</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => onNavigate?.('projects')}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Review Projects
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => window.location.href = '/'}
                  >
                    <Plus className="w-4 h-4" />
                    Capture New Items
                  </Button>
                </div>
              </motion.div>

              {/* Check for new items button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    fetchItemsForProcessing();
                    setShowCompletion(false);
                    setArchivedCount(0);
                    setAssignedCount(0);
                    setDeletedCount(0);
                    setProcessedCount(0);
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check for New Items
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    // Regular empty state (no items processed)
    return (
      <EmptyState
        icon={<CheckCircle2 className="w-full h-full text-green-500" />}
        title={processedCount > 0 ? "All Caught Up!" : "No Items to Process"}
        description={processedCount > 0
          ? `Great job! You processed ${processedCount} item${processedCount !== 1 ? 's' : ''}. Your inbox is clear.`
          : "Your inbox is empty! Capture some items first, then come back to process them with GTD."}
        action={{
          label: 'Check for New Items',
          onClick: () => fetchItemsForProcessing(),
          icon: <RefreshCw className="w-4 h-4" />,
        }}
      />
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Current Item */}
      <div className="md:col-span-2 space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, x: cardDirection === 'next' ? 50 : -50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: cardDirection === 'next' ? -50 : 50, scale: 0.95 }}
            transition={{
              duration: 0.2,
              ease: "easeInOut"
            }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Process Item</CardTitle>
                    <CardDescription>
                      Item {processedCount + 1} of {processedCount + items.length} • {items.length} remaining
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {currentItem.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
            {/* Item Title */}
            <div>
              <h3 className="text-xl font-semibold">{currentItem.title}</h3>
              <p className="text-sm text-muted-foreground">
                Created {safeFormatRelative(currentItem.createdAt, { fallback: 'recently' })}
              </p>
            </div>

            {/* Content Preview */}
            {currentItem.content && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm line-clamp-3">{currentItem.content}</p>
              </div>
            )}

            {/* Current Tags */}
            {currentItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentItem.tags.map(tag => (
                  <Badge key={tag} variant="secondary">#{tag}</Badge>
                ))}
              </div>
            )}

            {/* AI Suggestion */}
            {aiEnabled && currentItem.aiSuggestion && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium">AI Suggestion</span>
                </div>
                <p className="text-sm">{currentItem.aiSuggestion}</p>
                {currentItem.suggestedTags && currentItem.suggestedTags.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1">
                      {currentItem.suggestedTags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button
                variant="default"
                className="h-16 flex-col gap-1"
                onClick={() => handleAction('archive')}
              >
                <Archive className="w-5 h-5" />
                <span>Archive</span>
                <span className="text-xs opacity-70">Done with it</span>
              </Button>
              <Button
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={() => handleAction('assign')}
              >
                <FolderOpen className="w-5 h-5" />
                <span>Assign</span>
                <span className="text-xs opacity-70">Needs action</span>
              </Button>
              <Button
                variant="outline"
                className="h-16 flex-col gap-1"
                onClick={skipItem}
              >
                <Clock className="w-5 h-5" />
                <span>Skip</span>
                <span className="text-xs opacity-70">Later</span>
              </Button>
              <Button
                variant="ghost"
                className="h-16 flex-col gap-1 text-destructive hover:text-destructive"
                onClick={() => handleAction('delete')}
              >
                <Trash2 className="w-5 h-5" />
                <span>Delete</span>
                <span className="text-xs opacity-70">Remove</span>
              </Button>
            </div>
          </CardContent>
        </Card>
          </motion.div>
        </AnimatePresence>

        {/* Assign Dialog */}
        <AnimatePresence>
          {assignDialogOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={handleAssignCancel}
              />
              {/* Dialog */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Assign Item</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleAssignCancel}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      Choose a category and optionally a project
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select value={selectedAssignedTo} onValueChange={setSelectedAssignedTo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Project (optional)</label>
                      <Select
                        value={selectedProjectId}
                        onValueChange={setSelectedProjectId}
                        disabled={loadingProjects}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingProjects ? 'Loading...' : 'Select project'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: project.color }}
                                />
                                {project.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleAssignCancel}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleAssignConfirm}
                        disabled={(!selectedAssignedTo || selectedAssignedTo === 'none') && (!selectedProjectId || selectedProjectId === 'none')}
                      >
                        Assign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Fraction Display */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold text-green-500">{processedCount}</span>
                <span className="text-2xl text-muted-foreground">/</span>
                <span className="text-xl text-muted-foreground">{processedCount + items.length}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Items Processed</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress
                value={processedCount + items.length > 0 ? (processedCount / (processedCount + items.length)) * 100 : 0}
                className="h-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Item {processedCount + 1} of {processedCount + items.length}</span>
                <span>
                  {processedCount + items.length > 0
                    ? Math.round((processedCount / (processedCount + items.length)) * 100)
                    : 0}%
                </span>
              </div>
            </div>

            {/* Items Remaining Badge */}
            <div className="flex justify-center">
              <Badge variant={items.length > 5 ? 'destructive' : items.length > 0 ? 'default' : 'secondary'} className="text-sm">
                {items.length} item{items.length !== 1 ? 's' : ''} remaining
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* GTD Quick Guide */}
        <Card>
          <Collapsible open={gtdGuideOpen} onOpenChange={setGtdGuideOpen}>
            <CardHeader className="pb-2">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="w-4 h-4 text-indigo-500" />
                  GTD Quick Guide
                </CardTitle>
                {gtdGuideOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3 text-sm">
                {/* Capture */}
                <div className="flex items-start gap-2">
                  <Inbox className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Capture</p>
                    <p className="text-xs text-muted-foreground">Collect all ideas, tasks, and commitments in one place.</p>
                  </div>
                </div>
                {/* Clarify */}
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Clarify</p>
                    <p className="text-xs text-muted-foreground">Process what each item means. Is it actionable?</p>
                  </div>
                </div>
                {/* Organize */}
                <div className="flex items-start gap-2">
                  <Folder className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Organize</p>
                    <p className="text-xs text-muted-foreground">Put it where it belongs: projects, calendar, or next actions.</p>
                  </div>
                </div>
                {/* Reflect */}
                <div className="flex items-start gap-2">
                  <Eye className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Reflect</p>
                    <p className="text-xs text-muted-foreground">Review regularly to keep system current and complete.</p>
                  </div>
                </div>
                {/* Engage */}
                <div className="flex items-start gap-2">
                  <Rocket className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Engage</p>
                    <p className="text-xs text-muted-foreground">Take action based on context, time, and energy available.</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Queue - Feature #100 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Up Next</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {Math.max(0, items.length - 1)} left
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.slice(1, 6).map((item, index) => {
                const age = safeFormatRelative(item.createdAt, { fallback: 'unknown' });
                const colorClass = typeBgColors[item.type] || 'bg-gray-500';

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setCardDirection('next');
                      setCurrentItem(item);
                      if (aiEnabled) fetchAISuggestion(item);
                    }}
                  >
                    <span className="text-xs text-muted-foreground w-4 font-medium">{index + 2}</span>
                    <div className={`w-2 h-2 rounded-full ${colorClass} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{item.type}</span>
                        <span>•</span>
                        <span>{age}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </motion.div>
                );
              })}
              {items.length > 6 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{items.length - 6} more items
                </p>
              )}
              {items.length <= 1 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No more items in queue
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
