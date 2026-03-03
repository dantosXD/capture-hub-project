'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Keyboard, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShortcutItem {
  keys: string;
  description: string;
}

interface KeyboardShortcutsHelpProps {
  shortcuts: ShortcutItem[];
  className?: string;
}

export function KeyboardShortcutsHelp({
  shortcuts,
  className = '',
}: KeyboardShortcutsHelpProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group shortcuts by category for better organization
  const groupedShortcuts: Record<string, ShortcutItem[]> = {
    capture: [],
    navigation: [],
    search: [],
    general: [],
  };

  shortcuts.forEach((shortcut) => {
    if (shortcut.description.toLowerCase().includes('capture')) {
      groupedShortcuts.capture.push(shortcut);
    } else if (
      shortcut.description.toLowerCase().includes('palette') ||
      shortcut.description.toLowerCase().includes('tab')
    ) {
      groupedShortcuts.navigation.push(shortcut);
    } else if (shortcut.description.toLowerCase().includes('search')) {
      groupedShortcuts.search.push(shortcut);
    } else {
      groupedShortcuts.general.push(shortcut);
    }
  });

  return (
    <div className={`fixed bottom-4 left-4 z-40 ${className}`}>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-2 bg-card/95 backdrop-blur-sm border rounded-xl shadow-xl p-4 max-w-xs"
          >
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              Keyboard Shortcuts
            </h3>

            <div className="space-y-3">
              {Object.entries(groupedShortcuts).map(
                ([category, items]) =>
                  items.length > 0 && (
                    <div key={category}>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                        {category}
                      </div>
                      <div className="space-y-1.5">
                        {items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {item.description}
                            </span>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {item.keys}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
              )}
            </div>

            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">?</kbd> to toggle this
              help
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Keyboard className="w-3.5 h-3.5" />
        <span className="text-xs">Shortcuts</span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}

// Compact version for minimal display
export function KeyboardShortcutsCompact({
  shortcuts,
  className = '',
}: KeyboardShortcutsHelpProps) {
  return (
    <div
      className={`fixed bottom-4 left-4 z-40 bg-card/80 backdrop-blur-sm border rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground flex items-center gap-2 ${className}`}
    >
      <Keyboard className="w-3 h-3" />
      <span>
        <kbd className="px-1 py-0.5 bg-muted rounded font-mono">⌘K</kbd>
        {' '}
        menu ·{' '}
        <kbd className="px-1 py-0.5 bg-muted rounded font-mono">⌘P</kbd>
        {' '}
        palette ·{' '}
        <kbd className="px-1 py-0.5 bg-muted rounded font-mono">/</kbd>
        {' '}
        search
      </span>
    </div>
  );
}
