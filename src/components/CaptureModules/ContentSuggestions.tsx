'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Lightbulb,
  Tags,
  FileText,
  FolderOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface RelatedItem {
  id: string;
  title: string;
  type: string;
  tags: string[];
  score: number;
  reason: string;
}

interface SuggestedProject {
  id: string;
  name: string;
  color: string;
  itemCount: number;
}

interface SuggestionsData {
  relatedItems: RelatedItem[];
  suggestedTags: string[];
  processingSuggestions: string[];
  suggestedProjects: SuggestedProject[];
}

interface ContentSuggestionsProps {
  title: string;
  content: string;
  tags: string[];
  type?: string;
  excludeId?: string;
  onAddTag?: (tag: string) => void;
  onSelectRelatedItem?: (itemId: string) => void;
  onSelectProject?: (projectId: string) => void;
  className?: string;
}

export function ContentSuggestions({
  title,
  content,
  tags,
  type = 'note',
  excludeId,
  onAddTag,
  onSelectRelatedItem,
  onSelectProject,
  className,
}: ContentSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['processing']));

  // Fetch suggestions when content changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title || content) {
        fetchSuggestions();
      } else {
        setSuggestions(null);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [title, content, tags, type, excludeId]);

  const fetchSuggestions = async () => {
    if (!title && !content) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags, type, excludeId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data);

      // Auto-expand sections that have content
      const hasContent = new Set<string>();
      if (data.processingSuggestions?.length > 0) hasContent.add('processing');
      if (data.suggestedTags?.length > 0) hasContent.add('tags');
      if (data.relatedItems?.length > 0) hasContent.add('related');
      if (data.suggestedProjects?.length > 0) hasContent.add('projects');
      setExpandedSections(hasContent);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      setError('Could not load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const hasAnySuggestions =
    suggestions &&
    (suggestions.processingSuggestions?.length > 0 ||
      suggestions.suggestedTags?.length > 0 ||
      suggestions.relatedItems?.length > 0 ||
      suggestions.suggestedProjects?.length > 0);

  if (loading) {
    return (
      <div className={cn('p-4 space-y-4', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analyzing content...</span>
        </div>
      </div>
    );
  }

  if (error || !hasAnySuggestions) {
    return null;
  }

  return (
    <div className={cn('p-4 space-y-4 bg-muted/30 rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="w-4 h-4 text-primary" />
        <span>AI Suggestions</span>
      </div>

      <Separator />

      {/* GTD Processing Suggestions */}
      {suggestions?.processingSuggestions && suggestions.processingSuggestions.length > 0 && (
        <SuggestionSection
          title="Processing Tips"
          icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
          expanded={expandedSections.has('processing')}
          onToggle={() => toggleSection('processing')}
        >
          <div className="space-y-2">
            {suggestions.processingSuggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="text-sm text-muted-foreground flex items-start gap-2 p-2 bg-background rounded"
              >
                <div className="w-1 h-1 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </SuggestionSection>
      )}

      {/* Suggested Tags */}
      {suggestions?.suggestedTags && suggestions.suggestedTags.length > 0 && (
        <SuggestionSection
          title="Suggested Tags"
          icon={<Tags className="w-4 h-4 text-blue-500" />}
          expanded={expandedSections.has('tags')}
          onToggle={() => toggleSection('tags')}
        >
          <div className="flex flex-wrap gap-2">
            {suggestions.suggestedTags.map(tag => {
              const isAdded = tags.includes(tag);
              return (
                <Badge
                  key={tag}
                  variant={isAdded ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer hover:bg-primary/80 transition-colors',
                    !isAdded && 'border-dashed'
                  )}
                  onClick={() => !isAdded && onAddTag?.(tag)}
                >
                  {tag}
                  {!isAdded && <span className="ml-1 opacity-50">+</span>}
                </Badge>
              );
            })}
          </div>
        </SuggestionSection>
      )}

      {/* Related Items */}
      {suggestions?.relatedItems && suggestions.relatedItems.length > 0 && (
        <SuggestionSection
          title="Related Items"
          icon={<FileText className="w-4 h-4 text-purple-500" />}
          expanded={expandedSections.has('related')}
          onToggle={() => toggleSection('related')}
        >
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {suggestions.relatedItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-2 bg-background rounded border hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => onSelectRelatedItem?.(item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {item.type}
                        </Badge>
                        {item.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.score}%
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </SuggestionSection>
      )}

      {/* Suggested Projects */}
      {suggestions?.suggestedProjects && suggestions.suggestedProjects.length > 0 && (
        <SuggestionSection
          title="Suggested Projects"
          icon={<FolderOpen className="w-4 h-4 text-green-500" />}
          expanded={expandedSections.has('projects')}
          onToggle={() => toggleSection('projects')}
        >
          <div className="space-y-2">
            {suggestions.suggestedProjects.map(project => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-2 bg-background rounded border hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => onSelectProject?.(project.id)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="text-sm font-medium">{project.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {project.itemCount} items
                </Badge>
              </motion.div>
            ))}
          </div>
        </SuggestionSection>
      )}
    </div>
  );
}

interface SuggestionSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SuggestionSection({ title, icon, expanded, onToggle, children }: SuggestionSectionProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="overflow-hidden">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
      <Separator />
    </div>
  );
}
