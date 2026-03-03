'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  closestCorners,
  DroppableContainer,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Inbox,
  FolderOpen,
  Archive,
  CheckCircle2,
  Clock,
  GripVertical,
  MoreVertical,
  Eye,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { safeFormatRelative } from '@/lib/safe-date';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';
import { EmptyState } from '@/components/EmptyState';
import { typeBgColors } from '@/lib/type-colors';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GTDSkeleton } from '@/components/LoadingStates/GTDSkeleton';

interface GTDWorkflowProps {
  onNavigate?: (view: string) => void;
  onSelectItem?: (id: string) => void;
}

interface CaptureItem {
  id: string;
  title: string;
  type: string;
  content?: string;
  tags: string[];
  priority: string;
  status: string;
  assignedTo?: string;
  createdAt: string;
  pinned?: boolean;
}

// Stage definitions
const STAGES = [
  { id: 'inbox', label: 'Inbox', description: 'New captures', icon: Inbox, color: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/50' },
  { id: 'assigned', label: 'Organize', description: 'To process', icon: FolderOpen, color: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50' },
  { id: 'archived', label: 'Archive', description: 'Completed', icon: Archive, color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50' },
] as const;

type StageId = typeof STAGES[number]['id'];

// Draggable item component
function DraggableItem({ item, onSelect }: { item: CaptureItem; onSelect?: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/capture/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'trash' }),
      });
      if (response.ok) {
        toast.success('Item moved to trash');
      }
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
      tabIndex={0}
      aria-label={`${item.title} - ${item.type}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(item.id);
        }
      }}
    >
      <Card
        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-ring outline-none"
        onClick={() => onSelect?.(item.id)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {/* Drag handle */}
            <div className="cursor-grab active:cursor-grabbing mt-1">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Type indicator */}
            <div className={`w-8 h-8 rounded-lg ${typeBgColors[item.type] || 'bg-gray-500'} flex items-center justify-center text-white flex-shrink-0`}>
              {item.type === 'note' && <span className="text-xs font-bold">N</span>}
              {item.type === 'screenshot' && <span className="text-xs font-bold">S</span>}
              {item.type === 'webpage' && <span className="text-xs font-bold">W</span>}
              {item.type === 'ocr' && <span className="text-xs font-bold">O</span>}
              {item.type === 'scratchpad' && <span className="text-xs font-bold">SP</span>}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{item.title}</h4>
              {item.content && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.content}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  {safeFormatRelative(item.createdAt, { fallback: 'recently' })}
                </span>
                {item.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
                {item.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs">+{item.tags.length - 2}</Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSelect?.(item.id)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Stage column component
function StageColumn({
  stage,
  items,
  onSelectItem,
}: {
  stage: typeof STAGES[number];
  items: CaptureItem[];
  onSelectItem?: (id: string) => void;
}) {
  const setNodeRef = useCallback((node: HTMLElement | null) => {
    // This node will be used by DndContext
  }, []);

  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-lg border">
      {/* Header */}
      <div className={`p-4 border-b ${stage.color} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <stage.icon className="w-5 h-5" />
            <h3 className="font-semibold">{stage.label}</h3>
            <Badge variant="secondary">{items.length}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
      </div>

      {/* Items */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No items
          </div>
        ) : (
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <DraggableItem key={item.id} item={item} onSelect={onSelectItem} />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export function GTDWorkflow({ onNavigate, onSelectItem }: GTDWorkflowProps) {
  const [items, setItems] = useState<Record<StageId, CaptureItem[]>>({
    inbox: [],
    assigned: [],
    archived: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<CaptureItem | null>(null);

  // WebSocket for real-time sync
  const { on: onWsEvent } = useWebSocket();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start dragging
      },
    })
  );

  // Fetch items for all stages
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [inboxRes, assignedRes, archivedRes] = await Promise.all([
        fetch('/api/inbox?status=inbox&limit=20&sortBy=newest'),
        fetch('/api/inbox?status=assigned&limit=20&sortBy=newest'),
        fetch('/api/inbox?status=archived&limit=20&sortBy=newest'),
      ]);

      const [inboxData, assignedData, archivedData] = await Promise.all([
        inboxRes.json(),
        assignedRes.json(),
        archivedRes.json(),
      ]);

      setItems({
        inbox: (inboxData.items || []).map(normalizeItem),
        assigned: (assignedData.items || []).map(normalizeItem),
        archived: (archivedData.items || []).map(normalizeItem),
      });
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Listen for real-time updates
  useEffect(() => {
    const cleanup = onWsEvent(WSEventType.ITEM_UPDATED, (data: any) => {
      const { id, changes, updatedAt } = data;

      setItems(prev => {
        // Find which stage the item is in
        let sourceStage: StageId | null = null;
        let itemIndex = -1;

        for (const [stage, stageItems] of Object.entries(prev)) {
          const idx = stageItems.findIndex(i => i.id === id);
          if (idx !== -1) {
            sourceStage = stage as StageId;
            itemIndex = idx;
            break;
          }
        }

        if (sourceStage && itemIndex !== -1) {
          const item = prev[sourceStage][itemIndex];
          const updatedItem = { ...item, ...changes, updatedAt };

          // If status changed, move to appropriate stage
          if (changes.status) {
            const newStage = changes.status === 'inbox' ? 'inbox' :
                            changes.status === 'assigned' ? 'assigned' : 'archived';

            if (newStage !== sourceStage) {
              // Remove from source stage
              const newSource = prev[sourceStage].filter(i => i.id !== id);
              // Add to target stage
              const newTarget = [...prev[newStage], updatedItem];

              return {
                ...prev,
                [sourceStage]: newSource,
                [newStage]: newTarget,
              };
            }
          }

          // Just update in place
          return {
            ...prev,
            [sourceStage]: prev[sourceStage].map((i, idx) =>
              idx === itemIndex ? updatedItem : i
            ),
          };
        }

        return prev;
      });
    });

    return cleanup;
  }, [onWsEvent]);

  // Listen for new items
  useEffect(() => {
    const cleanup = onWsEvent(WSEventType.ITEM_CREATED, (data: any) => {
      const newItem = normalizeItem(data);
      if (newItem.status === 'inbox') {
        setItems(prev => ({
          ...prev,
          inbox: [newItem, ...prev.inbox],
        }));
      }
    });

    return cleanup;
  }, [onWsEvent]);

  // Listen for deletions
  useEffect(() => {
    const cleanup = onWsEvent(WSEventType.ITEM_DELETED, (data: any) => {
      const { id } = data;

      setItems(prev => {
        const updated: Record<StageId, CaptureItem[]> = { inbox: [], assigned: [], archived: [] };
        for (const [stage, stageItems] of Object.entries(prev)) {
          updated[stage as StageId] = stageItems.filter(i => i.id !== id);
        }
        return updated;
      });
    });

    return cleanup;
  }, [onWsEvent]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Find the dragged item
    for (const [stage, stageItems] of Object.entries(items)) {
      const item = stageItems.find(i => i.id === event.active.id);
      if (item) {
        setDraggedItem(item);
        break;
      }
    }
  };

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source stage and active item
    let sourceStage: StageId | null = null;
    let activeItem: CaptureItem | null = null;

    for (const [stage, stageItems] of Object.entries(items)) {
      const item = stageItems.find(i => i.id === activeId);
      if (item) {
        sourceStage = stage as StageId;
        activeItem = item;
        break;
      }
    }

    if (!activeItem || !sourceStage) return;

    // Check if over is a stage container or an item
    const overStageId = STAGES.find(s => s.id === overId)?.id;

    if (overStageId && overStageId !== sourceStage) {
      // Dragging over a stage container - would move to that stage
      // Visual feedback only
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedItem(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source stage and active item
    let sourceStage: StageId | null = null;
    let activeItem: CaptureItem | null = null;
    let itemIndex = -1;

    for (const [stage, stageItems] of Object.entries(items)) {
      const idx = stageItems.findIndex(i => i.id === activeId);
      if (idx !== -1) {
        sourceStage = stage as StageId;
        activeItem = stageItems[idx];
        itemIndex = idx;
        break;
      }
    }

    if (!activeItem || !sourceStage) return;

    // Check if dropping on a stage container
    const targetStage = STAGES.find(s => s.id === overId);

    if (targetStage) {
      // Moving to a different stage - update status
      if (targetStage.id !== sourceStage) {
        try {
          await fetch(`/api/capture/${activeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStage.id }),
          });

          toast.success(`Moved to ${targetStage.label}`);
        } catch (error) {
          console.error('Failed to move item:', error);
          toast.error('Failed to move item');
        }
      }
    } else {
      // Reordering within the same stage
      const overItemIndex = items[sourceStage].findIndex(i => i.id === overId);
      if (overItemIndex !== -1 && overItemIndex !== itemIndex) {
        const newItems = arrayMove(items[sourceStage], itemIndex, overItemIndex);
        setItems(prev => ({
          ...prev,
          [sourceStage]: newItems,
        }));
      }
    }
  };

  if (loading) {
    return <GTDSkeleton />;
  }

  const totalItems = items.inbox.length + items.assigned.length + items.archived.length;

  if (totalItems === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="w-full h-full text-green-500" />}
        title="No Items Yet"
        description="Capture some items to start using your GTD workflow."
        action={{
          label: 'Start Capturing',
          onClick: () => onNavigate?.('dashboard'),
          icon: <RefreshCw className="w-4 h-4" />,
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div>
          <h2 className="text-lg font-semibold">GTD Workflow</h2>
          <p className="text-sm text-muted-foreground">
            Drag items between stages to process them
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchItems}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 p-4 overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-w-[800px]">
            {STAGES.map((stage) => (
              <div
                key={stage.id}
                className="h-full"
              >
                <StageColumn
                  stage={stage}
                  items={items[stage.id]}
                  onSelectItem={onSelectItem}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && draggedItem ? (
            <div className="rotate-3 opacity-80">
              <DraggableItem item={draggedItem} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Progress Summary */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {totalItems} total items
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{items.inbox.length} Inbox</Badge>
              <Badge variant="secondary">{items.assigned.length} Organize</Badge>
              <Badge variant="secondary">{items.archived.length} Archived</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Inbox Zero Progress</span>
            <Progress
              value={totalItems > 0 ? ((items.assigned.length + items.archived.length) / totalItems) * 100 : 0}
              className="w-32 h-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to normalize item data
function normalizeItem(item: any): CaptureItem {
  return {
    id: item.id,
    title: item.title || 'Untitled',
    type: item.type || 'note',
    content: item.content ?? null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    priority: item.priority || 'none',
    status: item.status || 'inbox',
    assignedTo: item.assignedTo ?? null,
    createdAt: item.createdAt || new Date().toISOString(),
    pinned: item.pinned ?? false,
  };
}
