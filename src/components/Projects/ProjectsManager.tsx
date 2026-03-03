'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, staggerItem } from '@/lib/animations';
import {
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Archive,
  FolderOpen,
  CheckCircle2,
  Clock,
  ChevronRight,
  Loader2,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CalendarIcon,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';
import { ProjectsListSkeleton } from '@/components/LoadingStates/ProjectsListSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { ColorPicker, DEFAULT_PROJECT_COLOR } from '@/components/Projects/ColorPicker';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { safeFormatAbsolute, safeIsPast, safeIsToday, safeIsTomorrow } from '@/lib/safe-date';

type StatusFilter = 'all' | 'active' | 'on-hold' | 'completed' | 'archived';
type PriorityFilter = 'all' | 'none' | 'low' | 'medium' | 'high';

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  order: number;
  itemCount: number;
  createdAt: string;
}

interface ProjectsManagerProps {
  onSelectProject?: (projectId: string) => void;
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

const priorityColors: Record<string, string> = {
  low: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/20',
  high: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20',
  none: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300 border-slate-500/20',
};

const priorityIcons: Record<string, React.ReactNode> = {
  low: <ChevronRight className="w-3 h-3" />,
  medium: <ChevronRight className="w-3 h-3" />,
  high: <ChevronRight className="w-3 h-3" />,
  none: <ChevronRight className="w-3 h-3" />,
};


export function ProjectsManager({ onSelectProject }: ProjectsManagerProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [sortBy, setSortBy] = useState<'order' | 'name' | 'status' | 'priority' | 'createdAt'>('order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR);
  const [status, setStatus] = useState('active');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // WebSocket for real-time updates
  const { on } = useWebSocket();

  useEffect(() => {
    fetchProjects();
  }, []);

  // Listen for project created via WebSocket (real-time sync)
  useEffect(() => {
    const cleanupProjectCreated = on(WSEventType.PROJECT_CREATED, (data: any) => {
      console.log('[ProjectsManager] New project created via WebSocket:', data);

      setProjects((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.id === data.id)) {
          return prev;
        }
        // Add new project with itemCount 0
        return [...prev, { ...data, itemCount: 0, order: data.order ?? 0, description: data.description || null, icon: data.icon || null }];
      });

      toast.success('New project created', {
        description: data.name || 'Untitled project',
        duration: 2000,
      });
    });

    return () => {
      cleanupProjectCreated();
    };
  }, [on]);

  // Listen for project updated via WebSocket (real-time sync)
  useEffect(() => {
    const cleanupProjectUpdated = on(WSEventType.PROJECT_UPDATED, (data: { id: string; changes: any; updatedAt: string }) => {
      console.log('[ProjectsManager] Project updated via WebSocket:', data);

      const { id, changes } = data;

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            // Apply the changes to the project
            return { ...p, ...changes };
          }
          return p;
        })
      );
    });

    return () => {
      cleanupProjectUpdated();
    };
  }, [on]);

  // Listen for project deleted via WebSocket (real-time sync)
  useEffect(() => {
    const cleanupProjectDeleted = on(WSEventType.PROJECT_DELETED, (data: { id: string; deletedAt: string }) => {
      console.log('[ProjectsManager] Project deleted via WebSocket:', data);

      const { id } = data;

      setProjects((prev) => prev.filter((p) => p.id !== id));

      toast.info('Project deleted', {
        description: 'A project was deleted from another device',
        duration: 2000,
      });
    });

    return () => {
      cleanupProjectDeleted();
    };
  }, [on]);

  // Listen for item bulk updates via WebSocket (refresh project counts)
  useEffect(() => {
    const cleanupItemBulkUpdate = on(WSEventType.ITEM_BULK_UPDATE, (data: { itemIds: string[]; changes: any; updatedAt: string }) => {
      console.log('[ProjectsManager] Item bulk update via WebSocket, refreshing project counts:', data);

      // If projectId changed, refresh project counts
      if (data.changes.projectId !== undefined || data.changes.status !== undefined) {
        fetchProjects();
      }
    });

    return () => {
      cleanupItemBulkUpdate();
    };
  }, [on]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color, status, priority, dueDate }),
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(prev => [...prev, { ...data.project, itemCount: 0 }]);
        resetForm();
        setCreateDialogOpen(false);
        toast.success('Project created successfully');
      } else {
        toast.error('Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editProject || !name.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${editProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color, status, priority, dueDate }),
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(prev => prev.map(p =>
          p.id === editProject.id ? { ...data.project, itemCount: p.itemCount } : p
        ));
        resetForm();
        setEditProject(null);
        toast.success('Project updated successfully');
      } else {
        toast.error('Failed to update project');
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error('Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Delete this project? Items will be unassigned but not deleted.')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        toast.success('Project deleted successfully');
      } else {
        toast.error('Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  };

  const handleReorder = async (projectId: string, direction: 'up' | 'down') => {
    // Find the project in the current sorted (by order) list
    const sorted = [...projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const currentIndex = sorted.findIndex(p => p.id === projectId);
    if (currentIndex < 0) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const currentProject = sorted[currentIndex];
    const swapProject = sorted[swapIndex];

    // Swap order values
    const currentOrder = currentProject.order ?? 0;
    const swapOrder = swapProject.order ?? 0;

    // Optimistic UI update
    setProjects(prev => prev.map(p => {
      if (p.id === currentProject.id) return { ...p, order: swapOrder };
      if (p.id === swapProject.id) return { ...p, order: currentOrder };
      return p;
    }));

    // Update both projects via API
    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/projects/${currentProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: swapOrder }),
        }),
        fetch(`/api/projects/${swapProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: currentOrder }),
        }),
      ]);

      if (!res1.ok || !res2.ok) {
        // Rollback on failure
        setProjects(prev => prev.map(p => {
          if (p.id === currentProject.id) return { ...p, order: currentOrder };
          if (p.id === swapProject.id) return { ...p, order: swapOrder };
          return p;
        }));
        toast.error('Failed to reorder projects');
      }
    } catch (error) {
      console.error('Failed to reorder projects:', error);
      // Rollback
      setProjects(prev => prev.map(p => {
        if (p.id === currentProject.id) return { ...p, order: currentOrder };
        if (p.id === swapProject.id) return { ...p, order: swapOrder };
        return p;
      }));
      toast.error('Failed to reorder projects');
    }
  };

  const openEditDialog = (project: Project) => {
    setEditProject(project);
    setName(project.name);
    setDescription(project.description || '');
    setColor(project.color);
    setStatus(project.status);
    setPriority(project.priority);
    setDueDate(project.dueDate || null);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setColor(DEFAULT_PROJECT_COLOR);
    setStatus('active');
    setPriority('medium');
    setDueDate(null);
    setCalendarOpen(false);
  };

  // Filter projects by status and priority
  const filteredProjects = projects
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => priorityFilter === 'all' || p.priority === priorityFilter)
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'order') {
        comparison = (a.order ?? 0) - (b.order ?? 0);
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortBy === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1, none: 0 };
        comparison = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Count projects by status for filter badges
  const statusCounts: Record<string, number> = projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  statusCounts.all = projects.length;

  // Count projects by priority for filter badges
  const priorityCounts: Record<string, number> = projects.reduce((acc, p) => {
    acc[p.priority] = (acc[p.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  priorityCounts.all = projects.length;

  if (loading) {
    return <ProjectsListSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-indigo-500" />
            Projects
          </h2>
          <p className="text-muted-foreground">Organize your captures into projects</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Sorting */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'order' | 'name' | 'status' | 'priority' | 'createdAt')}
            className="px-3 py-1.5 rounded-md border bg-background text-sm"
          >
            <option value="order">Custom Order</option>
            <option value="createdAt">Created Date</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      )}

      {/* Status & Priority Filters */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Filter:</span>
          <span className="text-xs text-muted-foreground">Status:</span>
          {(['all', 'active', 'on-hold', 'completed', 'archived'] as StatusFilter[]).map((filter) => (
            <Button
              key={`status-${filter}`}
              variant={statusFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter)}
              className="relative"
            >
              <span className="capitalize">{filter === 'on-hold' ? 'On Hold' : filter}</span>
              {statusCounts[filter] > 0 && (
                <Badge
                  variant={statusFilter === filter ? 'secondary' : 'outline'}
                  className="ml-2 text-xs"
                >
                  {statusCounts[filter]}
                </Badge>
              )}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">Priority:</span>
          {(['all', 'none', 'low', 'medium', 'high'] as PriorityFilter[]).map((filter) => (
            <Button
              key={`priority-${filter}`}
              variant={priorityFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPriorityFilter(filter)}
              className="relative"
            >
              <span className="capitalize">{filter}</span>
              {priorityCounts[filter] > 0 && (
                <Badge
                  variant={priorityFilter === filter ? 'secondary' : 'outline'}
                  className="ml-2 text-xs"
                >
                  {priorityCounts[filter]}
                </Badge>
              )}
            </Button>
          ))}
          {(statusFilter !== 'all' || priorityFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); }}
              className="text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {filteredProjects.length === 0 && projects.length > 0 ? (
        <EmptyState
          icon={<Filter className="w-full h-full" />}
          title="No projects match this filter"
          description={`No projects match the current filters. Status: "${statusFilter}", Priority: "${priorityFilter}". Try different filters or create a new project.`}
          action={{
            label: 'Clear Filters',
            onClick: () => { setStatusFilter('all'); setPriorityFilter('all'); },
            icon: <X className="w-4 h-4" />,
          }}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-full h-full" />}
          title="No projects yet"
          description="Create your first project to organize your captures into meaningful groups."
          action={{
            label: 'Create Project',
            onClick: () => { resetForm(); setCreateDialogOpen(true); },
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      ) : (
        <AnimatePresence>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                variants={staggerItem}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
              >
                <Card
                  className="h-full hover:shadow-md transition-shadow cursor-pointer group overflow-hidden flex flex-col"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  {/* Project color accent bar */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {sortBy === 'order' && (
                          <div className="flex flex-col gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={index === 0}
                              onClick={(e) => { e.stopPropagation(); handleReorder(project.id, 'up'); }}
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={index === filteredProjects.length - 1}
                              onClick={(e) => { e.stopPropagation(); handleReorder(project.id, 'down'); }}
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 border"
                          style={{ backgroundColor: `${project.color}20`, borderColor: `${project.color}40` }}
                        >
                          {project.icon || '📁'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                          <CardDescription className="line-clamp-1">
                            {project.description || `${project.itemCount} items`}
                          </CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(project); }}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleReorder(project.id, 'up'); }}
                            disabled={index === 0 || sortBy !== 'order'}
                          >
                            <ArrowUp className="w-4 h-4 mr-2" />
                            Move Up
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleReorder(project.id, 'down'); }}
                            disabled={index === filteredProjects.length - 1 || sortBy !== 'order'}
                          >
                            <ArrowDown className="w-4 h-4 mr-2" />
                            Move Down
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-2">
                    {project.dueDate && (() => {
                      const overdue = safeIsPast(project.dueDate) && !safeIsToday(project.dueDate);
                      const isDueToday = safeIsToday(project.dueDate);
                      const isDueTomorrow = safeIsTomorrow(project.dueDate);

                      let colorClass = 'text-muted-foreground';
                      let label = safeFormatAbsolute(project.dueDate, 'MMM d, yyyy', 'No date');
                      if (overdue) {
                        colorClass = 'text-red-600 dark:text-red-400';
                        label = `Overdue: ${safeFormatAbsolute(project.dueDate, 'MMM d, yyyy', 'overdue')}`;
                      } else if (isDueToday) {
                        colorClass = 'text-amber-600 dark:text-amber-400';
                        label = 'Due today';
                      } else if (isDueTomorrow) {
                        colorClass = 'text-amber-600 dark:text-amber-400';
                        label = 'Due tomorrow';
                      }

                      return (
                        <div className={`flex items-center gap-1.5 text-xs ${colorClass}`}>
                          {overdue ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <CalendarIcon className="w-3.5 h-3.5" />
                          )}
                          <span className={overdue ? 'font-semibold' : ''}>{label}</span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={statusColors[project.status]}>
                          {statusIcons[project.status]}
                          <span className="ml-1 capitalize">{project.status}</span>
                        </Badge>
                        {project.priority && project.priority !== 'none' && (
                          <Badge variant="outline" className={priorityColors[project.priority]}>
                            {priorityIcons[project.priority]}
                            <span className="ml-1 capitalize">{project.priority}</span>
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{project.itemCount} items</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <Dialog open={createDialogOpen || !!editProject} onOpenChange={(open) => {
        if (!open) { setCreateDialogOpen(false); setEditProject(null); resetForm(); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
            </div>
            
            <ColorPicker value={color} onChange={setColor} />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background">
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4" />
                  Due Date
                </span>
                {dueDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setDueDate(null)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                )}
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? safeFormatAbsolute(dueDate, 'MMM d, yyyy', 'Pick a due date (optional)') : 'Pick a due date (optional)'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(date) => {
                      setDueDate(date ? date.toISOString() : null);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setEditProject(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={editProject ? handleUpdate : handleCreate} disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editProject ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
