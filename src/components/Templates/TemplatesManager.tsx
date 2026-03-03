'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerItem } from '@/lib/animations';
import {
  FileText,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Loader2,
  Layout,
  Briefcase,
  CheckSquare,
  MessageSquare,
  BookOpen,
  Filter,
  Folder,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { UseTemplateDialog } from './UseTemplateDialog';
import { EmptyState } from '@/components/EmptyState';
import { IconPicker, getIconComponent, isLucideIconName, DEFAULT_TEMPLATE_ICON } from './IconPicker';
import { TemplatesSkeleton } from '@/components/LoadingStates/TemplatesSkeleton';

interface Template {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string;
  icon: string | null;
  variables: string[] | null;
  isDefault: boolean;
  projectId: string | null;
  project?: {
    id: string;
    name: string;
    color: string;
  } | null;
  createdAt: string;
}

interface TemplatesManagerProps {
  onSelectTemplate?: (template: Template) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  general: <Layout className="w-4 h-4" />,
  meeting: <MessageSquare className="w-4 h-4" />,
  task: <CheckSquare className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
  review: <BookOpen className="w-4 h-4" />,
  project: <Briefcase className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
  general: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300 border-slate-500/20',
  meeting: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/20',
  task: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/20',
  note: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20',
  review: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/20',
  project: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/20',
};

function TemplateIcon({ icon }: { icon: string | null }) {
  if (icon && isLucideIconName(icon)) {
    const IconComp = getIconComponent(icon);
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
        <IconComp className="w-4 h-4 text-primary" />
      </div>
    );
  }
  // Fallback for legacy emoji icons
  if (icon) {
    return <span className="text-xl flex-shrink-0">{icon}</span>;
  }
  // Default icon
  const DefaultIcon = getIconComponent(DEFAULT_TEMPLATE_ICON);
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
      <DefaultIcon className="w-4 h-4 text-primary" />
    </div>
  );
}

export function TemplatesManager({ onSelectTemplate }: TemplatesManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [useTemplateDialogOpen, setUseTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Lock body scroll when any dialog is open
  useBodyScrollLock(createDialogOpen || !!editTemplate || deleteDialogOpen || useTemplateDialogOpen);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [icon, setIcon] = useState(DEFAULT_TEMPLATE_ICON);
  const [projectId, setProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchProjects();
  }, [categoryFilter]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const url = categoryFilter === 'all'
        ? '/api/templates'
        : `/api/templates?category=${categoryFilter}`;

      const response = await fetch(url);
      const data = await response.json();

      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, content, category, icon, projectId: projectId || null }),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(prev => [...prev, data.template]);
        resetForm();
        setCreateDialogOpen(false);
        toast.success('Template created');
      }
    } catch (error) {
      console.error('Failed to create template:', error);
      toast.error('Failed to create template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (template: Template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const openEditDialog = (template: Template) => {
    setEditTemplate(template);
    setName(template.name);
    setDescription(template.description || '');
    setContent(template.content);
    setCategory(template.category);
    setIcon(template.icon && isLucideIconName(template.icon) ? template.icon : (template.icon || DEFAULT_TEMPLATE_ICON));
    setProjectId(template.projectId || '');
  };

  const handleUpdate = async () => {
    if (!editTemplate || !name.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/templates/${editTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, content, category, icon, projectId: projectId || null }),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(prev => prev.map(t => t.id === editTemplate.id ? data.template : t));
        resetForm();
        setEditTemplate(null);
        toast.success('Template updated successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update template');
      }
    } catch (error) {
      console.error('Failed to update template:', error);
      toast.error('Failed to update template');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;

    try {
      const response = await fetch(`/api/templates/${templateToDelete.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (response.ok) {
        setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
        toast.success('Template deleted');
      } else {
        toast.error(data.error || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
      toast.error('Failed to delete template');
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleUseTemplate = (template: Template) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      // Open the use template dialog with variable parsing
      setSelectedTemplate(template);
      setUseTemplateDialogOpen(true);
    }
  };

  const handleCreateCapture = async (data: { type: string; title: string; content: string }) => {
    const response = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create capture');
    }

    return await response.json();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setContent('');
    setCategory('general');
    setIcon(DEFAULT_TEMPLATE_ICON);
    setProjectId('');
  };

  if (loading) {
    return <TemplatesSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-medium">Templates</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1 text-sm rounded-md border bg-background"
            >
              <option value="all">All Categories</option>
              <option value="general">General</option>
              <option value="meeting">Meeting</option>
              <option value="task">Task</option>
              <option value="note">Note</option>
              <option value="review">Review</option>
              <option value="project">Project</option>
            </select>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          New
        </Button>
      </div>

      <div className="grid gap-3">
        {templates.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-full h-full" />}
            title="No templates found"
            description={categoryFilter === 'all'
              ? 'Create your first template to speed up capturing notes with reusable content.'
              : `No templates in the "${categoryFilter}" category.`}
            action={{
              label: 'Create Template',
              onClick: () => { resetForm(); setCreateDialogOpen(true); },
              icon: <Plus className="w-4 h-4" />,
            }}
          />
        ) : (
          <AnimatePresence>
            {templates.map((template, index) => (
            <motion.div
              key={template.id}
              variants={staggerItem}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleUseTemplate(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <TemplateIcon icon={template.icon} />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm truncate">{template.name}</CardTitle>
                        {template.description && (
                          <CardDescription className="text-xs mt-0.5 truncate">
                            {template.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {template.project && (
                        <Badge variant="outline" className="text-xs" style={{ backgroundColor: `${template.project.color}20`, borderColor: `${template.project.color}40`, color: template.project.color }}>
                          <Folder className="w-3 h-3 mr-1" />
                          {template.project.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className={categoryColors[template.category] || ''}>
                        {categoryIcons[template.category]}
                        <span className="ml-1 capitalize text-xs">{template.category}</span>
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUseTemplate(template); }}>
                            <Copy className="w-4 h-4 mr-2" />
                            Use Template
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); openEditDialog(template); }}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDelete(template); }}
                            className={template.isDefault ? 'text-muted-foreground cursor-not-allowed' : 'text-destructive'}
                            disabled={template.isDefault}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {template.isDefault ? 'Default (locked)' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono line-clamp-2">
                    {template.content}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Icon</Label>
                <IconPicker value={icon} onChange={setIcon} />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm">
                <option value="general">General</option>
                <option value="meeting">Meeting</option>
                <option value="task">Task</option>
                <option value="note">Note</option>
                <option value="review">Review</option>
                <option value="project">Project</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Project (Optional)</Label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm">
                <option value="">No Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{"Content (use {{variable}} for placeholders)"}</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Template content with {{variables}}" rows={6} className="font-mono text-sm" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !name.trim() || !content.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Icon</Label>
                <IconPicker value={icon} onChange={setIcon} />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm">
                <option value="general">General</option>
                <option value="meeting">Meeting</option>
                <option value="task">Task</option>
                <option value="note">Note</option>
                <option value="review">Review</option>
                <option value="project">Project</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Project (Optional)</Label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm">
                <option value="">No Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{"Content (use {{variable}} for placeholders)"}</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Template content with {{variables}}" rows={6} className="font-mono text-sm" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={submitting || !name.trim() || !content.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              {templateToDelete?.isDefault
                ? 'Default templates cannot be deleted.'
                : 'Are you sure you want to delete this template? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            {templateToDelete?.isDefault ? (
              <AlertDialogAction onClick={() => setDeleteDialogOpen(false)}>
                OK
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Use Template Dialog */}
      <UseTemplateDialog
        open={useTemplateDialogOpen}
        onOpenChange={setUseTemplateDialogOpen}
        template={selectedTemplate}
        onCreateCapture={handleCreateCapture}
      />
    </div>
  );
}
