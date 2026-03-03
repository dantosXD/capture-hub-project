'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InboxItem } from './InboxItem';
import { ItemPreview } from './ItemPreview';
import { BulkActionBar } from './BulkActionBar';
import { listItem, listContainer } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  FileText,
  Edit3,
  ScanLine,
  Camera,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Inbox,
  Folder,
  Archive,
  Trash2,
  Sparkles,
  PanelRightClose,
  PanelLeftClose,
  ChevronRight,
  ChevronLeft,
  Tag,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { WSEventType } from '@/lib/ws-events';
import { fetchWithRetry, showApiErrorToast, parseApiError } from '@/lib/api-error-handler';
import { InboxListSkeleton } from '@/components/LoadingStates/InboxListSkeleton';
import { ItemPreviewSkeleton } from '@/components/LoadingStates/ItemPreviewSkeleton';
import { EmptyState } from '@/components/EmptyState';

interface CaptureItem {
  id: string;
  type: string;
  title: string;
  content: string | null;
  extractedText: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  metadata: any;
  tags: string[];
  priority: string;
  status: string;
  assignedTo: string | null;
  projectId: string | null;
  dueDate: string | null;
  reminder: string | null;
  reminderSent?: boolean;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

interface InboxListProps {
  refreshKey?: number;
  onSelectItem?: (item: CaptureItem) => void;
  statusFilter?: string;
  selectedItemId?: string | null;
  onPreviewItem?: (item: CaptureItem | null) => void;
  initialTagFilter?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  note: <FileText className="w-4 h-4" />,
  scratchpad: <Edit3 className="w-4 h-4" />,
  ocr: <ScanLine className="w-4 h-4" />,
  screenshot: <Camera className="w-4 h-4" />,
  webpage: <Globe className="w-4 h-4" />,
};

// Import centralized type colors
import { typeBgColors } from '@/lib/type-colors';
const typeColors = typeBgColors;

export function InboxList({
  refreshKey,
  onSelectItem,
  statusFilter: initialStatusFilter,
  selectedItemId,
  onPreviewItem,
  initialTagFilter,
}: InboxListProps) {
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<CaptureItem | null>(null);

  // WebSocket for real-time updates
  const { on } = useWebSocket();

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'inbox');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Pagination
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Panel collapse state for tablets
  const [listPanelCollapsed, setListPanelCollapsed] = useState(false);
  const [previewPanelCollapsed, setPreviewPanelCollapsed] = useState(false);

  // Confirmation dialog for permanent delete
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CaptureItem | null>(null);

  // Lock body scroll when delete confirmation dialog is open
  useBodyScrollLock(!!deleteConfirmItem);

  // Track deleted items for undo
  const deletedItemsRef = useRef<Map<string, { previousStatus: string; timeoutId: NodeJS.Timeout }>>(new Map());
  // Track countdown intervals for cleanup
  const countdownIntervalsRef = useRef<NodeJS.Timeout[]>([]);

  // Update status filter when prop changes
  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
      setAssignedToFilter('all'); // Reset category filter when status changes
      setPage(0);
    }
  }, [initialStatusFilter]);

  // Update tag filter when prop changes
  useEffect(() => {
    if (initialTagFilter !== undefined) {
      setTagFilter(initialTagFilter);
      setPage(0);
    }
  }, [initialTagFilter]);

  // Handle external selected item (from search)
  useEffect(() => {
    if (selectedItemId && items.length > 0) {
      const item = items.find((i) => i.id === selectedItemId);
      if (item) {
        setPreviewItem(item);
        onPreviewItem?.(item);
      }
    }
  }, [selectedItemId, items, onPreviewItem]);

  // Cleanup timeouts and intervals on unmount
  useEffect(() => {
    return () => {
      deletedItemsRef.current.forEach(({ timeoutId }) => {
        clearTimeout(timeoutId);
      });
      countdownIntervalsRef.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
    };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      params.set('status', statusFilter);
      if (assignedToFilter !== 'all' && statusFilter === 'assigned') params.set('assignedTo', assignedToFilter);
      if (tagFilter) params.set('tag', tagFilter);
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      params.set('sortBy', sortBy);

      const data = await fetchWithRetry<{ items: CaptureItem[]; total: number }>(
        `/api/inbox?${params}`,
        {
          context: 'inbox',
          showErrorToast: false, // Handle custom error below
          maxRetries: 2,
        }
      );

      // Sort items: pinned first, then by date
      const sortedItems = (data.items || []).sort((a: CaptureItem, b: CaptureItem) => {
        if (sortBy === 'pinned') {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setItems(sortedItems);
      setTotal(data.total || 0);
    } catch (error) {
      const apiError = parseApiError(error, 'inbox');
      showApiErrorToast(apiError, {
        retryAction: () => fetchItems(),
      });
    } finally {
      setLoading(false);
    }
  }, [typeFilter, priorityFilter, statusFilter, assignedToFilter, tagFilter, sortBy, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  // Listen for new items created via WebSocket (real-time sync)
  useEffect(() => {
    const cleanupItemCreated = on(WSEventType.ITEM_CREATED, (data: any) => {
      console.log('[InboxList] New item created via WebSocket:', data);

      // Normalize item data with defaults for any missing fields
      const newItem: CaptureItem = {
        id: data.id,
        type: data.type || 'note',
        title: data.title || 'Untitled',
        content: data.content ?? null,
        extractedText: data.extractedText ?? null,
        imageUrl: data.imageUrl ?? null,
        sourceUrl: data.sourceUrl ?? null,
        metadata: data.metadata ?? null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        priority: data.priority || 'none',
        status: data.status || 'inbox',
        assignedTo: data.assignedTo ?? null,
        projectId: data.projectId ?? null,
        dueDate: data.dueDate ?? null,
        reminder: data.reminder ?? null,
        reminderSent: data.reminderSent ?? false,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
        pinned: data.pinned ?? false,
      };

      // Only add the item if it matches all current filters
      const matchesTypeFilter = typeFilter === 'all' || newItem.type === typeFilter;
      const matchesPriorityFilter = priorityFilter === 'all' || newItem.priority === priorityFilter;
      const matchesStatusFilter = newItem.status === statusFilter;
      const matchesAssignedToFilter = assignedToFilter === 'all' || newItem.assignedTo === assignedToFilter;
      const matchesTagFilter = !tagFilter || newItem.tags.some((t: string) => t.toLowerCase() === tagFilter.toLowerCase());

      if (matchesTypeFilter && matchesPriorityFilter && matchesStatusFilter && matchesAssignedToFilter && matchesTagFilter) {
        setItems((prev) => {
          // Avoid duplicates
          if (prev.some((item) => item.id === newItem.id)) {
            return prev;
          }
          // Add new item to the beginning of the list (animated via AnimatePresence)
          return [newItem, ...prev];
        });
        setTotal((prev) => prev + 1);

        // Show subtle notification of new item
        toast.success(`New ${newItem.type} captured`, {
          description: newItem.title || 'Untitled',
          duration: 2000,
        });
      }
    });

    return () => {
      cleanupItemCreated();
    };
  }, [on, typeFilter, priorityFilter, statusFilter, assignedToFilter, tagFilter]);

  // Listen for item updates via WebSocket (real-time sync for status changes, pin/unpin)
  useEffect(() => {
    const cleanupItemUpdated = on(WSEventType.ITEM_UPDATED, (data: { id: string; changes: any; updatedAt: string }) => {
      console.log('[InboxList] Item updated via WebSocket:', data);

      const { id, changes, updatedAt } = data;

      setItems((prev) => {
        const updated = prev.map((item) => {
          if (item.id === id) {
            // Apply the changes to the item
            const updatedItem = { ...item, ...changes, updatedAt };
            return updatedItem;
          }
          return item;
        });

        // Filter out items that no longer match the current view filters
        const filtered = updated.filter((item) => {
          // Only check items that were actually updated
          if (item.id !== id) return true;

          // If status changed and no longer matches current filter, remove it
          if (changes.status && item.status !== statusFilter) {
            return false;
          }
          // If type changed and no longer matches current type filter, remove it
          if (changes.type && typeFilter !== 'all' && item.type !== typeFilter) {
            return false;
          }
          // If priority changed and no longer matches current priority filter, remove it
          if (changes.priority && priorityFilter !== 'all' && item.priority !== priorityFilter) {
            return false;
          }
          return true;
        });

        // Track how many items were removed for total count update
        const removedCount = updated.length - filtered.length;
        if (removedCount > 0) {
          // Decrement total count for items removed from view
          setTotal((prevTotal) => Math.max(0, prevTotal - removedCount));

          // Clear selected items that were removed
          setSelectedItems((prevSelected) => {
            const removedIds = updated
              .filter((item) => !filtered.some((f) => f.id === item.id))
              .map((item) => item.id);
            const newSelected = prevSelected.filter((selId) => !removedIds.includes(selId));
            return newSelected.length !== prevSelected.length ? newSelected : prevSelected;
          });
        }

        // Re-sort if pinned status changed
        if (changes.pinned !== undefined || sortBy === 'pinned') {
          return filtered.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            if (sortBy === 'oldest') {
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        return filtered;
      });

      // Update preview item if it's the one being updated
      if (previewItem?.id === id) {
        // If the item status changed and no longer matches, close preview
        if (changes.status && changes.status !== statusFilter) {
          setPreviewItem(null);
          onPreviewItem?.(null);
        } else {
          setPreviewItem((prev) => prev ? { ...prev, ...changes, updatedAt } : null);
        }
      }
    });

    return () => {
      cleanupItemUpdated();
    };
  }, [on, statusFilter, typeFilter, priorityFilter, sortBy, previewItem, onPreviewItem]);

  // Listen for item deletions via WebSocket (real-time sync)
  useEffect(() => {
    const cleanupItemDeleted = on(WSEventType.ITEM_DELETED, (data: { id: string; deletedAt: string }) => {
      console.log('[InboxList] Item deleted via WebSocket:', data);

      const { id } = data;

      setItems((prev) => {
        const wasInList = prev.some((item) => item.id === id);
        if (wasInList) {
          setTotal((prevTotal) => Math.max(0, prevTotal - 1));
          // Clean up selection if the deleted item was selected
          setSelectedItems((prevSelected) => {
            if (prevSelected.includes(id)) {
              return prevSelected.filter((selId) => selId !== id);
            }
            return prevSelected;
          });
        }
        return prev.filter((item) => item.id !== id);
      });

      // Clear preview if deleted item was being previewed
      if (previewItem?.id === id) {
        setPreviewItem(null);
        onPreviewItem?.(null);
      }
    });

    return () => {
      cleanupItemDeleted();
    };
  }, [on, previewItem, onPreviewItem]);

  // Listen for bulk item updates via WebSocket (real-time sync for bulk actions)
  useEffect(() => {
    const cleanupBulkUpdate = on(WSEventType.ITEM_BULK_UPDATE, (data: { itemIds: string[]; changes: any; updatedAt: string }) => {
      console.log('[InboxList] Bulk update received via WebSocket:', data);

      const { itemIds, changes, updatedAt } = data;

      setItems((prev) => {
        const updated = prev.map((item) => {
          if (itemIds.includes(item.id)) {
            // Apply the changes to the item
            const updatedItem = { ...item, ...changes, updatedAt };
            return updatedItem;
          }
          return item;
        });

        // Filter out items that no longer match the current view filters
        const filtered = updated.filter((item) => {
          // Only check items that were actually bulk-updated
          if (!itemIds.includes(item.id)) return true;

          // If status changed and no longer matches current filter, remove it
          if (changes.status && item.status !== statusFilter) {
            return false;
          }
          // If type changed and no longer matches current type filter, remove it
          if (changes.type && typeFilter !== 'all' && item.type !== typeFilter) {
            return false;
          }
          // If priority changed and no longer matches current priority filter, remove it
          if (changes.priority && priorityFilter !== 'all' && item.priority !== priorityFilter) {
            return false;
          }
          return true;
        });

        // Track how many items were removed for total count update
        const removedCount = updated.length - filtered.length;
        if (removedCount > 0) {
          // Decrement total count for items removed from view
          setTotal((prevTotal) => Math.max(0, prevTotal - removedCount));
        }

        // Re-sort if pinned status changed or current sort is pinned
        if (changes.pinned !== undefined || changes.status !== undefined || sortBy === 'pinned') {
          return filtered.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            if (sortBy === 'oldest') {
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }

        return filtered;
      });

      // Update preview item if it's one of the bulk-updated items
      if (previewItem && itemIds.includes(previewItem.id)) {
        // If the item status changed and no longer matches, close preview
        if (changes.status && changes.status !== statusFilter) {
          setPreviewItem(null);
          onPreviewItem?.(null);
        } else {
          setPreviewItem((prev) => prev ? { ...prev, ...changes, updatedAt } : null);
        }
      }

      // Clear selection if any selected items were affected
      setSelectedItems((prevSelected) => {
        if (itemIds.some((id) => prevSelected.includes(id))) {
          return [];
        }
        return prevSelected;
      });

      // Show notification for bulk update
      toast.success(`Updated ${itemIds.length} items`, {
        description: `Bulk action applied: ${Object.keys(changes).join(', ')}`,
        duration: 2000,
      });
    });

    return () => {
      cleanupBulkUpdate();
    };
  }, [on, statusFilter, typeFilter, priorityFilter, sortBy, previewItem, onPreviewItem]);

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, id]);
    } else {
      setSelectedItems(selectedItems.filter((i) => i !== id));
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((i) => i.id));
    }
  };

  const handleBulkAction = async (action: string, value?: string) => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return;
    }

    try {
      const body: any = { ids: selectedItems };

      // Handle different bulk actions
      if (action === 'archive') {
        body.status = 'archived';
      } else if (action === 'trash') {
        body.status = 'trash';
      } else if (action === 'assign') {
        body.assignedTo = value;
      } else if (action === 'assignProject') {
        body.projectId = value;
        body.status = 'assigned';
      } else if (action === 'unassign') {
        body.assignedTo = null;
      } else if (action === 'priority') {
        body.priority = value;
      } else if (action === 'addTag') {
        body.addTags = [value];
      }

      const response = await fetchWithRetry('/api/inbox/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        context: 'inbox',
        showErrorToast: false,
      });

      // Success message based on action
      let actionLabel: string;
      if (action === 'archive') {
        actionLabel = 'archived';
      } else if (action === 'trash') {
        actionLabel = 'moved to trash';
      } else if (action === 'priority') {
        actionLabel = `priority set to ${value}`;
      } else if (action === 'assign') {
        actionLabel = `assigned to ${value}`;
      } else if (action === 'assignProject') {
        actionLabel = 'assigned to project';
      } else if (action === 'unassign') {
        actionLabel = 'unassigned';
      } else if (action === 'addTag') {
        actionLabel = `tag "${value}" added`;
      } else {
        actionLabel = action;
      }
      toast.success(`Updated ${selectedItems.length} items (${actionLabel})`);

      setSelectedItems([]);
      fetchItems();
    } catch (error) {
      const apiError = parseApiError(error, 'inbox');
      showApiErrorToast(apiError, {
        retryAction: () => handleBulkAction(action, value),
      });
    }
  };

  // Soft delete with undo
  const handleDeleteItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const previousStatus = item.status;

    // Move to trash immediately
    try {
      await fetchWithRetry(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'trash' }),
        context: 'capture',
        showErrorToast: false,
      });

      // Remove from local state
      setItems((prev) => prev.filter((i) => i.id !== id));
      setPreviewItem(null);
      onPreviewItem?.(null);

      // Show toast with undo and countdown
      const timeoutId = setTimeout(async () => {
        // After 5 seconds, permanently update (item stays in trash)
        deletedItemsRef.current.delete(id);
      }, 5000);

      deletedItemsRef.current.set(id, { previousStatus, timeoutId });

      // Create countdown toast that updates every second
      let secondsLeft = 5;
      const toastId = toast(
        <div className="flex items-center gap-2">
          <span>Item moved to trash</span>
          <span className="text-muted-foreground" id={`countdown-${id}`}>(5s)</span>
        </div>,
        {
          action: {
            label: 'Undo',
            onClick: async () => {
              clearTimeout(timeoutId);
              deletedItemsRef.current.delete(id);

              // Update countdown display to show cancelled
              const countdownEl = document.getElementById(`countdown-${id}`);
              if (countdownEl) {
                countdownEl.textContent = '(cancelled)';
              }

              try {
                // Restore previous status
                await fetchWithRetry(`/api/capture/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: previousStatus }),
                  context: 'capture',
                  showErrorToast: false,
                });

                fetchItems();
                toast.success('Item restored');
                toast.dismiss(toastId);
              } catch (error) {
                const apiError = parseApiError(error, 'capture');
                showApiErrorToast(apiError);
              }
            },
          },
          duration: 5000,
          id: `delete-${id}`,
        }
      );

      // Update countdown every second
      const countdownInterval = setInterval(() => {
        secondsLeft--;
        const countdownEl = document.getElementById(`countdown-${id}`);
        if (countdownEl && secondsLeft > 0) {
          countdownEl.textContent = `(${secondsLeft}s)`;
        } else if (secondsLeft <= 0) {
          clearInterval(countdownInterval);
          // Remove from tracked intervals
          countdownIntervalsRef.current = countdownIntervalsRef.current.filter(i => i !== countdownInterval);
          if (countdownEl) {
            countdownEl.textContent = '(expired)';
          }
        }
      }, 1000);

      // Track interval for cleanup
      countdownIntervalsRef.current.push(countdownInterval);
    } catch (error) {
      const apiError = parseApiError(error, 'capture');
      showApiErrorToast(apiError, {
        retryAction: () => handleDeleteItem(id),
      });
    }
  };

  // Toggle pin
  const handleTogglePin = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      await fetchWithRetry(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !item.pinned }),
        context: 'capture',
        showErrorToast: false,
      });

      // Update local state
      setItems((prev) =>
        prev
          .map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i))
          .sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
      );

      toast.success(item.pinned ? 'Item unpinned' : 'Item pinned');
    } catch (error) {
      const apiError = parseApiError(error, 'capture');
      showApiErrorToast(apiError, {
        retryAction: () => handleTogglePin(id),
      });
    }
  };

  // Archive item
  const handleArchiveItem = async (id: string) => {
    try {
      await fetchWithRetry(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
        context: 'capture',
        showErrorToast: false,
      });

      toast.success('Item archived');
      fetchItems();
    } catch (error) {
      const apiError = parseApiError(error, 'capture');
      showApiErrorToast(apiError, {
        retryAction: () => handleArchiveItem(id),
      });
    }
  };

  // Restore from trash
  const handleRestoreItem = async (id: string) => {
    try {
      await fetchWithRetry(`/api/capture/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inbox' }),
        context: 'capture',
        showErrorToast: false,
      });

      toast.success('Item restored to inbox');
      fetchItems();
    } catch (error) {
      const apiError = parseApiError(error, 'capture');
      showApiErrorToast(apiError, {
        retryAction: () => handleRestoreItem(id),
      });
    }
  };

  // Permanently delete
  const handlePermanentDelete = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Show confirmation dialog
    setDeleteConfirmItem(item);
  };

  // Confirm permanent delete
  const confirmPermanentDelete = async () => {
    if (!deleteConfirmItem) return;

    try {
      await fetchWithRetry(`/api/capture/${deleteConfirmItem.id}`, {
        method: 'DELETE',
        context: 'capture',
        showErrorToast: false,
      });

      toast.success('Item permanently deleted');
      setPreviewItem(null);
      onPreviewItem?.(null);
      setDeleteConfirmItem(null);
      fetchItems();
    } catch (error) {
      const apiError = parseApiError(error, 'capture');
      showApiErrorToast(apiError, {
        retryAction: () => confirmPermanentDelete(),
      });
    }
  };

  // List panel content (reused in both mobile and desktop)
  const listPanelContent = listPanelCollapsed ? (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
      <PanelLeftClose className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-lg font-medium text-center">List panel hidden</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setListPanelCollapsed(false)}
        className="mt-4"
      >
        <ChevronRight className="w-4 h-4 mr-1" />
        Show List
      </Button>
    </div>
  ) : (
    <div className="flex flex-col h-full">
      {/* Tablet collapse button */}
      <div className="md:hidden lg:flex items-center justify-end p-2 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setListPanelCollapsed(!listPanelCollapsed)}
          className="h-8 px-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="ml-1 text-xs">Hide List</span>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b flex-wrap" hidden={listPanelCollapsed}>
        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[110px] sm:w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
            <SelectItem value="scratchpad">Scratch Pads</SelectItem>
            <SelectItem value="ocr">OCR</SelectItem>
            <SelectItem value="screenshot">Screenshots</SelectItem>
            <SelectItem value="webpage">Web Pages</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[110px] sm:w-[140px]">
            <SelectValue placeholder="All Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>

        {/* Category Filter (only show in assigned view) */}
        {statusFilter === 'assigned' && (
          <Select value={assignedToFilter} onValueChange={(v) => { setAssignedToFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[110px] sm:w-[140px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Projects">Projects</SelectItem>
              <SelectItem value="Tasks">Tasks</SelectItem>
              <SelectItem value="Review">Review</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Tag Filter */}
        <div className="relative flex items-center">
          <Tag className="absolute left-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Filter by tag..."
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(0); }}
            className="w-[140px] sm:w-[180px] pl-8 pr-8 h-9"
          />
          {tagFilter && (
            <button
              onClick={() => { setTagFilter(''); setPage(0); }}
              className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setAssignedToFilter('all'); setPage(0); }}>
          <SelectTrigger className="w-[110px] sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inbox">Inbox</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="trash">Trash</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[110px] sm:w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="pinned">Pinned First</SelectItem>
          </SelectContent>
        </Select>

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <BulkActionBar
            selectedCount={selectedItems.length}
            onAction={handleBulkAction}
            selectedItems={items.filter(i => selectedItems.includes(i.id))}
          />
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" hidden={listPanelCollapsed}>
        {loading ? (
          <InboxListSkeleton />
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            {statusFilter === 'inbox' && (
              <EmptyState
                icon={<Inbox className="w-full h-full" />}
                title="No items in your inbox"
                description="Your inbox is empty! Capture something to get started with organizing your thoughts."
                action={{
                  label: 'Quick Capture',
                  onClick: () => document.querySelector('[data-capture-trigger]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
                  icon: <Sparkles className="w-4 h-4" />,
                }}
              />
            )}
            {statusFilter === 'assigned' && (
              <EmptyState
                icon={<Folder className="w-full h-full" />}
                title="No assigned items"
                description="Items you assign to Projects, Tasks, or Review will appear here."
              />
            )}
            {statusFilter === 'archived' && (
              <EmptyState
                icon={<Archive className="w-full h-full" />}
                title="No archived items"
                description="Items you archive will be stored here for future reference."
              />
            )}
            {statusFilter === 'trash' && (
              <EmptyState
                icon={<Trash2 className="w-full h-full" />}
                title="Trash is empty"
                description="Items you delete will be moved here. You can restore them or delete permanently."
              />
            )}
          </div>
        ) : (
          <>
            {/* List Header with Select All */}
            {items.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
                <Checkbox
                  checked={selectedItems.length === items.length && items.length > 0}
                  indeterminate={selectedItems.length > 0 && selectedItems.length < items.length}
                  onCheckedChange={(checked) => {
                    // If currently all selected or some selected (indeterminate), deselect all
                    // If currently none selected, select all
                    if (selectedItems.length === items.length) {
                      setSelectedItems([]);
                    } else {
                      setSelectedItems(items.map((i) => i.id));
                    }
                  }}
                  aria-label="Select all items"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedItems.length === items.length
                    ? `All ${items.length} items selected`
                    : selectedItems.length > 0
                    ? `${selectedItems.length} of ${items.length} selected`
                    : `${items.length} items`}
                </span>
              </div>
            )}
            <motion.div
              role="list"
              aria-label={`${statusFilter} items`}
              className="divide-y"
              variants={listContainer}
              initial="hidden"
              animate="visible"
            >
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  variants={listItem}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.15) }}
                  layout
                >
                  <InboxItem
                    item={item}
                    selected={selectedItems.includes(item.id)}
                    isActive={previewItem?.id === item.id}
                    onSelect={(checked) => handleSelectItem(item.id, checked)}
                    onClick={() => {
                      setPreviewItem(item);
                      onPreviewItem?.(item);
                    }}
                    onDelete={() =>
                      statusFilter === 'trash'
                        ? handlePermanentDelete(item.id)
                        : handleDeleteItem(item.id)
                    }
                    onPin={statusFilter !== 'trash' ? () => handleTogglePin(item.id) : undefined}
                    onRestore={statusFilter === 'trash' ? () => handleRestoreItem(item.id) : undefined}
                    typeIcon={typeIcons[item.type]}
                    typeColor={typeColors[item.type]}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          </>
        )}
      </div>

      {/* Pagination */}
      {total > limit && !listPanelCollapsed && (
        <div className="flex items-center justify-center gap-4 p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronUp className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(total / limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * limit >= total}
            onClick={() => setPage(page + 1)}
          >
            Next <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );

  // Preview panel content (reused in both mobile and desktop)
  const previewPanelContent = previewPanelCollapsed ? (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
      <PanelRightClose className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-lg font-medium text-center">Preview panel hidden</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPreviewPanelCollapsed(false)}
        className="mt-4"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Show Preview
      </Button>
    </div>
  ) : previewItem ? (
    <div className="h-full flex flex-col relative">
      {/* Tablet collapse button for preview */}
      <div className="md:hidden lg:flex absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPreviewPanelCollapsed(true)}
          className="h-8 w-8 bg-background/80 backdrop-blur-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <ItemPreview
        item={previewItem}
        onClose={() => {
          setPreviewItem(null);
          onPreviewItem?.(null);
        }}
        onDelete={() =>
          statusFilter === 'trash'
            ? handlePermanentDelete(previewItem.id)
            : handleDeleteItem(previewItem.id)
        }
        onUpdate={() => fetchItems()}
        onPin={() => handleTogglePin(previewItem.id)}
        onRestore={statusFilter === 'trash' ? () => handleRestoreItem(previewItem.id) : undefined}
        onArchive={statusFilter !== 'trash' && statusFilter !== 'archived' ? () => handleArchiveItem(previewItem.id) : undefined}
        typeIcon={typeIcons[previewItem.type]}
        typeColor={typeColors[previewItem.type]}
      />
    </div>
  ) : (
    <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground">
      <PanelRightClose className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-lg font-medium">No item selected</p>
      <p className="text-sm mt-1">Click an item from the list to preview it here</p>
      {/* Collapse button for empty preview panel */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPreviewPanelCollapsed(true)}
        className="mt-4 md:hidden lg:flex"
      >
        <ChevronRight className="w-4 h-4 mr-1" />
        Hide Preview
      </Button>
    </div>
  );

  return (
    <>
      {/* Desktop and Tablet: Resizable two-panel layout with collapse support */}
      <div className="hidden md:block h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel: Item List */}
          <ResizablePanel
            defaultSize={50}
            minSize={listPanelCollapsed ? 0 : 30}
            maxSize={listPanelCollapsed ? 0 : 70}
            collapsible={true}
          >
            <div className="h-full overflow-hidden">
              {listPanelContent}
            </div>
          </ResizablePanel>

          {/* Resize Handle - hide if either panel is collapsed */}
          {!listPanelCollapsed && !previewPanelCollapsed && <ResizableHandle withHandle />}

          {/* Right Panel: Item Preview */}
          <ResizablePanel
            defaultSize={50}
            minSize={previewPanelCollapsed ? 0 : 30}
            maxSize={previewPanelCollapsed ? 0 : 70}
            collapsible={true}
          >
            <div className="h-full overflow-hidden relative">
              {previewPanelContent}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: Stacked layout with overlay preview */}
      <div className="block md:hidden h-full">
        {listPanelContent}

        {/* Preview Panel - Fixed position overlay on mobile */}
        {previewItem && (
          <div className="fixed inset-0 z-50 bg-background">
            <ItemPreview
              item={previewItem}
              onClose={() => {
                setPreviewItem(null);
                onPreviewItem?.(null);
              }}
              onDelete={() =>
                statusFilter === 'trash'
                  ? handlePermanentDelete(previewItem.id)
                  : handleDeleteItem(previewItem.id)
              }
              onUpdate={() => fetchItems()}
              onPin={() => handleTogglePin(previewItem.id)}
              onRestore={statusFilter === 'trash' ? () => handleRestoreItem(previewItem.id) : undefined}
              onArchive={statusFilter !== 'trash' && statusFilter !== 'archived' ? () => handleArchiveItem(previewItem.id) : undefined}
              typeIcon={typeIcons[previewItem.type]}
              typeColor={typeColors[previewItem.type]}
            />
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Permanent Delete */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Permanently Delete Item?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>&quot;{deleteConfirmItem?.title}&quot;</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
