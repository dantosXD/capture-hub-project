'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  Filter,
  Tag,
  FolderOpen,
  Flag,
  User,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ExportFormat = 'json' | 'csv' | 'markdown';
type ItemStatus = 'all' | 'inbox' | 'assigned' | 'archived' | 'trash';
type ItemType = 'all' | 'note' | 'scratchpad' | 'ocr' | 'screenshot' | 'webpage';
type ItemPriority = 'all' | 'none' | 'low' | 'medium' | 'high';
type AssignedTo = 'all' | 'Projects' | 'Tasks' | 'Review';

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [status, setStatus] = useState<ItemStatus>('all');
  const [type, setType] = useState<ItemType>('all');
  const [priority, setPriority] = useState<ItemPriority>('all');
  const [assignedTo, setAssignedTo] = useState<AssignedTo>('all');
  const [tag, setTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  const formatOptions = [
    { value: 'json' as const, label: 'JSON', icon: FileJson, description: 'Full data with metadata' },
    { value: 'csv' as const, label: 'CSV', icon: FileSpreadsheet, description: 'Spreadsheet compatible' },
    { value: 'markdown' as const, label: 'Markdown', icon: FileText, description: 'Formatted document' },
  ];

  const statusOptions = [
    { value: 'all' as const, label: 'All Items' },
    { value: 'inbox' as const, label: 'Inbox' },
    { value: 'assigned' as const, label: 'Assigned' },
    { value: 'archived' as const, label: 'Archived' },
    { value: 'trash' as const, label: 'Trash' },
  ];

  const typeOptions = [
    { value: 'all' as const, label: 'All Types' },
    { value: 'note' as const, label: 'Notes' },
    { value: 'scratchpad' as const, label: 'Scratchpad' },
    { value: 'ocr' as const, label: 'OCR' },
    { value: 'screenshot' as const, label: 'Screenshots' },
    { value: 'webpage' as const, label: 'Web Pages' },
  ];

  const priorityOptions = [
    { value: 'all' as const, label: 'Any Priority' },
    { value: 'none' as const, label: 'None' },
    { value: 'low' as const, label: 'Low' },
    { value: 'medium' as const, label: 'Medium' },
    { value: 'high' as const, label: 'High' },
  ];

  const assignedToOptions = [
    { value: 'all' as const, label: 'Any Assignment' },
    { value: 'Projects' as const, label: 'Projects' },
    { value: 'Tasks' as const, label: 'Tasks' },
    { value: 'Review' as const, label: 'Review' },
  ];

  const handleExport = async () => {
    setExporting(true);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.set('format', format);

      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      if (priority !== 'all') params.set('priority', priority);
      if (assignedTo !== 'all') params.set('assignedTo', assignedTo);
      if (tag.trim()) params.set('tag', tag.trim());
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const url = `/api/export?${params.toString()}`;

      // Open in new tab to trigger download
      window.open(url, '_blank');

      toast.success('Export started', {
        description: `Your ${format.toUpperCase()} file should download shortly.`,
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters = status !== 'all' || type !== 'all' || priority !== 'all' || assignedTo !== 'all' || tag.trim() || searchQuery.trim();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Export Data</h2>
                    <p className="text-sm text-muted-foreground">
                      Choose format and filters
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Format Selection */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Export Format</Label>
                    <div className="grid gap-2">
                      {formatOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFormat(option.value)}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            format === option.value
                              ? 'border-indigo-500 bg-indigo-500/10'
                              : 'border-border hover:border-border/80 hover:bg-muted/50'
                          }`}
                        >
                          <option.icon className={`w-5 h-5 ${
                            format === option.value ? 'text-indigo-500' : 'text-muted-foreground'
                          }`} />
                          <div className="flex-1">
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                          {format === option.value && (
                            <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filters Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Filters</Label>
                      {hasActiveFilters && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-500 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Status</Label>
                      <Select value={status} onValueChange={(v) => setStatus(v as ItemStatus)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Type</Label>
                      <Select value={type} onValueChange={(v) => setType(v as ItemType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Priority</Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as ItemPriority)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assignment */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Assigned To</Label>
                      <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v as AssignedTo)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignedToOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tag */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Tag</Label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Filter by tag..."
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Search */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search in title or content..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStatus('all');
                          setType('all');
                          setPriority('all');
                          setAssignedTo('all');
                          setTag('');
                          setSearchQuery('');
                        }}
                        className="w-full"
                      >
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="flex items-center gap-3 p-6 border-t border-border bg-muted/30">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={exporting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex-1 gap-2"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export {format.toUpperCase()}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
