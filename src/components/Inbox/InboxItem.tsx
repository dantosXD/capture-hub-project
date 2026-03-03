'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trash2, ExternalLink, Clock, Pin, RotateCcw,
  Calendar, Bell, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { safeFormatRelative, safeFormatAbsolute, safeIsPast, safeIsToday, safeIsTomorrow } from '@/lib/safe-date';
import { stripMarkdown, getTypeDescription } from '@/lib/markdown';
import { getCaptureItemAriaLabel, getDueDateAriaLabel } from '@/lib/accessibility';
import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CaptureItem {
  id: string;
  type: string;
  title: string;
  content: string | null;
  extractedText: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  tags: string[];
  priority: string;
  status: string;
  assignedTo: string | null;
  dueDate: string | null;
  reminder: string | null;
  reminderSent?: boolean;
  createdAt: string;
  pinned?: boolean;
}

interface InboxItemProps {
  item: CaptureItem;
  selected: boolean;
  isActive?: boolean;
  onSelect: (checked: boolean) => void;
  onClick: () => void;
  onDelete: () => void;
  onPin?: () => void;
  onRestore?: () => void;
  typeIcon: React.ReactNode;
  typeColor: string;
}

const priorityColors: Record<string, string> = {
  none: 'bg-gray-500/20 text-gray-700 dark:bg-gray-600/30 dark:text-gray-300 border-gray-500/50',
  low: 'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-600/30 dark:text-indigo-300 border-indigo-500/50',
  medium: 'bg-amber-500/20 text-amber-700 dark:bg-amber-600/30 dark:text-amber-300 border-amber-500/50',
  high: 'bg-purple-500/20 text-purple-700 dark:bg-purple-600/30 dark:text-purple-300 border-purple-500/50',
};

export function InboxItem({
  item,
  selected,
  isActive,
  onSelect,
  onClick,
  onDelete,
  onPin,
  onRestore,
  typeIcon,
  typeColor,
}: InboxItemProps) {
  // State for periodic timestamp updates
  const [, setCurrentTime] = useState(Date.now());

  // Update timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every 60 seconds

    return () => clearInterval(interval);
  }, []);

  const getPreview = () => {
    if (item.type === 'screenshot' && item.imageUrl) {
      return (
        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      );
    }

    // Get text content, prioritizing content over extractedText
    const rawText = item.content || item.extractedText || '';

    if (rawText) {
      // Strip markdown formatting for preview
      const plainText = stripMarkdown(rawText);
      // Truncate to ~100 characters
      const truncated = plainText.length > 100
        ? plainText.substring(0, 100) + '...'
        : plainText;

      return (
        <div className="text-sm text-muted-foreground line-clamp-2">
          {truncated}
        </div>
      );
    }

    // No content - show type description
    return (
      <div className="text-sm text-muted-foreground italic">
        {getTypeDescription(item.type)}
      </div>
    );
  };

  const getIconDisplay = () => {
    // For webpages, show favicon if available
    if (item.type === 'webpage' && item.imageUrl) {
      return (
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          <img
            src={item.imageUrl}
            alt=""
            className="w-6 h-6 object-contain"
            onError={(e) => {
              // Fallback to default icon if favicon fails to load
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-foreground"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
              }
            }}
          />
        </div>
      );
    }

    // For other types, use the default type icon
    return (
      <div
        className={`w-8 h-8 rounded-lg ${typeColor} flex items-center justify-center text-white flex-shrink-0`}
      >
        {typeIcon}
      </div>
    );
  };

  const getDueDateDisplay = () => {
    if (!item.dueDate) return null;
    
    const overdue = safeIsPast(item.dueDate) && !safeIsToday(item.dueDate);
    
    let label = safeFormatAbsolute(item.dueDate, 'MMM d', 'No date');
    let icon = Calendar;
    let colorClass = 'text-muted-foreground';
    
    if (overdue) {
      label = `Overdue: ${safeFormatRelative(item.dueDate, { fallback: 'overdue' })}`;
      colorClass = 'text-red-500';
      icon = AlertTriangle;
    } else if (safeIsToday(item.dueDate)) {
      label = 'Due today';
      colorClass = 'text-amber-500';
      icon = AlertTriangle;
    } else if (safeIsTomorrow(item.dueDate)) {
      label = 'Due tomorrow';
      colorClass = 'text-blue-500';
    }
    
    return { label, icon, colorClass };
  };

  const getReminderDisplay = () => {
    if (!item.reminder) return null;
    
    const isUpcoming = !safeIsPast(item.reminder);
    
    return {
      label: safeFormatAbsolute(item.reminder, 'MMM d, h:mm a', 'Reminder'),
      isUpcoming,
      isPast: safeIsPast(item.reminder) && !item.reminderSent,
    };
  };

  const dueDateDisplay = getDueDateDisplay();
  const reminderDisplay = getReminderDisplay();

  return (
    <div
      role="option"
      tabIndex={0}
      aria-label={getCaptureItemAriaLabel(item)}
      aria-selected={selected}
      className={`flex items-start gap-3 p-3 sm:p-4 min-h-[60px] hover:bg-muted/50 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isActive ? 'bg-primary/5 border-l-2 border-l-primary' : item.pinned ? 'bg-amber-500/5 border-l-2 border-l-amber-500' : ''
      } ${dueDateDisplay?.colorClass === 'text-red-500' ? 'bg-red-500/5' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 h-5 w-5 sm:h-4 sm:w-4"
      />

      {/* Type Icon / Favicon */}
      {getIconDisplay()}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{item.title}</h3>
            {item.pinned && (
              <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.assignedTo && (
              <Badge variant="default" className="bg-indigo-500 hover:bg-indigo-600">
                {item.assignedTo}
              </Badge>
            )}
            {item.priority !== 'none' && (
              <Badge variant="outline" className={priorityColors[item.priority]}>
                {item.priority}
              </Badge>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                    <Clock className="w-3 h-3" />
                    {safeFormatRelative(item.createdAt, { fallback: 'Unknown' })}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{safeFormatAbsolute(item.createdAt, 'PPpp', '')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {getPreview()}

        {/* Tags & Meta */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Due Date */}
          {dueDateDisplay && (
            <Badge
              variant="outline"
              className={`text-xs ${dueDateDisplay.colorClass} border-current`}
              aria-label={getDueDateAriaLabel(item.dueDate!, dueDateDisplay.colorClass === 'text-red-500' ? 'overdue' : dueDateDisplay.colorClass === 'text-amber-500' ? (safeIsToday(item.dueDate) ? 'today' : 'tomorrow') : 'upcoming')}
            >
              <dueDateDisplay.icon className="w-3 h-3 mr-1" aria-hidden="true" />
              {dueDateDisplay.label}
            </Badge>
          )}
          
          {/* Reminder */}
          {reminderDisplay && (
            <Badge 
              variant="outline" 
              className={`text-xs ${reminderDisplay.isPast ? 'text-red-500 border-red-500/50' : 'text-blue-500 border-blue-500/50'}`}
            >
              <Bell className="w-3 h-3 mr-1" />
              {reminderDisplay.isPast ? 'Missed reminder' : reminderDisplay.label}
            </Badge>
          )}
          
          {/* Tags */}
          {item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {item.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{item.tags.length - 3}
            </Badge>
          )}
          
          {/* Source URL */}
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Source
            </a>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
        {/* Restore button for trash items */}
        {item.status === 'trash' && onRestore && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            title="Restore item"
          >
            <RotateCcw className="w-4 h-4 text-primary" />
          </Button>
        )}

        {/* Pin button */}
        {onPin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            title={item.pinned ? 'Unpin item' : 'Pin item'}
          >
            <Pin
              className={`w-4 h-4 ${
                item.pinned
                  ? 'text-amber-500 fill-amber-500'
                  : 'text-muted-foreground'
              }`}
            />
          </Button>
        )}

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:h-8 sm:w-8 touch-manipulation"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
