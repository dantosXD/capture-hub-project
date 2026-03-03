'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import { getIconComponent, isLucideIconName, DEFAULT_TEMPLATE_ICON } from './IconPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';

interface VariableField {
  name: string;
  label: string;
  defaultValue: string;
  multiline: boolean;
}

interface UseTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: string;
    name: string;
    content: string;
    category: string;
    icon: string | null;
  } | null;
  onCreateCapture: (data: { type: string; title: string; content: string }) => Promise<void>;
}

// Parse {{variable}} patterns from template content
function parseTemplateVariables(content: string): VariableField[] {
  const variablePattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const matches = new Set<string>();
  let match;

  while ((match = variablePattern.exec(content)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches).map(name => {
    // Generate a nice label from the variable name
    const label = name
      .split(/_/g)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Determine if this should be multiline based on name hints
    const multiline = ['notes', 'thoughts', 'description', 'content', 'agenda', 'key_points'].some(hint =>
      name.toLowerCase().includes(hint)
    );

    return {
      name,
      label,
      defaultValue: '',
      multiline,
    };
  });
}

function TemplateDialogIcon({ icon }: { icon: string | null }) {
  if (icon && isLucideIconName(icon)) {
    const IconComp = getIconComponent(icon);
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
        <IconComp className="w-5 h-5 text-primary" />
      </div>
    );
  }
  if (icon) {
    return <span className="text-2xl">{icon}</span>;
  }
  const DefaultIcon = getIconComponent(DEFAULT_TEMPLATE_ICON);
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
      <DefaultIcon className="w-5 h-5 text-primary" />
    </div>
  );
}

// Replace {{variable}} placeholders with actual values
function replaceTemplateVariables(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, varName) => {
    return values[varName] || match;
  });
}

export function UseTemplateDialog({
  open,
  onOpenChange,
  template,
  onCreateCapture,
}: UseTemplateDialogProps) {
  const [variables, setVariables] = useState<VariableField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Lock body scroll when dialog is open
  useBodyScrollLock(open);

  // Parse variables when template changes
  useEffect(() => {
    if (template) {
      const parsedVars = parseTemplateVariables(template.content);
      setVariables(parsedVars);

      // Initialize empty values
      const initialValues: Record<string, string> = {};
      parsedVars.forEach(v => {
        initialValues[v.name] = '';
      });
      setValues(initialValues);

      // Set initial preview
      setPreview(template.content);
    } else {
      setVariables([]);
      setValues({});
      setPreview('');
    }
  }, [template]);

  // Update preview when values change
  useEffect(() => {
    if (template) {
      const replaced = replaceTemplateVariables(template.content, values);
      setPreview(replaced);
    }
  }, [values, template]);

  const handleValueChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateCapture = async () => {
    if (!template) return;

    // Check if all variables are filled
    const emptyVars = variables.filter(v => !values[v.name]?.trim());
    if (emptyVars.length > 0) {
      toast.error(`Please fill in all template fields: ${emptyVars.map(v => v.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      // Create capture with filled template content
      await onCreateCapture({
        type: 'note',
        title: template.name,
        content: preview,
      });

      // Reset and close
      setValues({});
      setPreview('');
      onOpenChange(false);
      toast.success('Capture created from template');
    } catch (error) {
      console.error('Failed to create capture from template:', error);
      toast.error('Failed to create capture');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setValues({});
      setPreview('');
      onOpenChange(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TemplateDialogIcon icon={template.icon} />
            <span>Use Template: {template.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Variable Input Fields */}
          {variables.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Fill in the template fields below:
              </div>

              <div className="grid gap-4">
                {variables.map((variable) => (
                  <motion.div
                    key={variable.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: variables.indexOf(variable) * 0.05 }}
                    className="space-y-2"
                  >
                    <Label htmlFor={`var-${variable.name}`} className="text-sm font-medium">
                      {variable.label}
                    </Label>

                    {variable.multiline ? (
                      <Textarea
                        id={`var-${variable.name}`}
                        value={values[variable.name] || ''}
                        onChange={(e) => handleValueChange(variable.name, e.target.value)}
                        placeholder={`Enter ${variable.label.toLowerCase()}...`}
                        rows={3}
                        className="resize-none"
                      />
                    ) : (
                      <Input
                        id={`var-${variable.name}`}
                        value={values[variable.name] || ''}
                        onChange={(e) => handleValueChange(variable.name, e.target.value)}
                        placeholder={`Enter ${variable.label.toLowerCase()}...`}
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              This template has no variables. The content will be used as-is.
            </div>
          )}

          {/* Preview Section */}
          {variables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Preview
              </Label>
              <div className="p-4 bg-muted/50 rounded-lg border">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                  {preview || template.content}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateCapture}
            disabled={submitting || variables.some(v => !values[v.name]?.trim())}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
