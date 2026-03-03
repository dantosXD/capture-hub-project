'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedCountBadge } from '@/components/AnimatedCountBadge';
import {
  LayoutDashboard,
  Inbox,
  Folder,
  CheckSquare,
  Archive,
  Trash2,
  FileText,
  Tag,
  Settings,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  stats: {
    inbox: number;
    assigned: number;
    projects: number;
    archived: number;
    trash: number;
  } | null;
}

export function MobileBottomNav({ activeView, onViewChange, stats }: MobileBottomNavProps) {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'inbox', icon: Inbox, label: 'Inbox', count: stats?.inbox },
    { id: 'assigned', icon: Folder, label: 'Assigned', count: stats?.assigned },
    { id: 'projects', icon: CheckSquare, label: 'Projects', count: stats?.projects },
    { id: 'templates', icon: FileText, label: 'Templates' },
    { id: 'tags', icon: Tag, label: 'Tags' },
    { id: 'archived', icon: Archive, label: 'Archived', count: stats?.archived },
    { id: 'trash', icon: Trash2, label: 'Trash', count: stats?.trash },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t md:hidden safe-area-inset-bottom touch-manipulation"
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              role="menuitem"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-3 min-h-[60px] min-w-[44px] flex-1 relative touch-manipulation transition-colors active:scale-95 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              style={{ minHeight: '60px', minWidth: '44px' }}
            >
              <div className="relative pointer-events-none">
                <Icon className="w-5 h-5" aria-hidden="true" />
                {item.count && item.count > 0 && (
                  <div className="absolute -top-1 -right-2 pointer-events-none">
                    <AnimatedCountBadge
                      count={item.count}
                      compact
                      className="h-4 min-w-4 p-0 flex items-center justify-center text-[10px] font-medium"
                      ariaLabel={`${item.count} items`}
                    />
                  </div>
                )}
              </div>
              <span className="text-[10px] mt-0.5 truncate w-full text-center responsive-text-xs">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
