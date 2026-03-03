'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SearchBar } from '@/components/Search/SearchBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bookmark,
  Command,
  LayoutDashboard,
  FileText,
  Clock,
  Download,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { safeFormatRelative } from '@/lib/safe-date';
import { DeviceIndicator } from '@/components/Header/DeviceIndicator';
import { useTheme } from '@/hooks/use-theme';

interface RecentItem {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

interface HeaderProps {
  recentItems?: RecentItem[];
  onSearchResultClick?: (item: { id: string }) => void;
  onCommandPaletteOpen?: () => void;
  onExportOpen?: () => void;
}

export function Header({
  recentItems = [],
  onSearchResultClick,
  onCommandPaletteOpen,
  onExportOpen,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectItem = (id: string) => {
    if (onSearchResultClick) {
      onSearchResultClick({ id });
    }
  };

  const getThemeIcon = () => {
    if (!mounted) return <Monitor className="w-4 h-4" />;
    if (theme === 'dark') return <Sun className="w-4 h-4" />;
    if (theme === 'light') return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const getThemeLabel = () => {
    if (!mounted) return 'Switch to Dark';
    if (theme === 'dark') return 'Switch to Light';
    if (theme === 'light') return 'Switch to System';
    return 'Switch to Dark';
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-3 sm:px-6 py-2 md:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Title with Recent Items Popover - Hide title on mobile */}
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-2 md:gap-3 cursor-pointer group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform flex-shrink-0">
                  C
                </div>
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent hidden sm:block">
                  Capture Hub
                </h1>
              </div>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Recent Captures
                </div>
                {recentItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No recent captures
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {recentItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => handleSelectItem(item.id)}
                        >
                          <FileText className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm truncate flex-1">
                            {item.title || 'Untitled'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {safeFormatRelative(item.createdAt, { addSuffix: false, fallback: 'Unknown' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Search */}
          <div className="flex-1 max-w-md sm:max-w-xl min-w-0">
            <SearchBar onResultClick={onSearchResultClick} />
          </div>

          {/* Connected Devices, Bookmarklet Link, Theme, Export & Command Palette */}
          <div className="hidden md:flex items-center gap-3">
            {/* Connected Devices Indicator */}
            <DeviceIndicator />

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/bookmarklet">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span className="hidden lg:inline">Bookmarklet</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Install bookmarklet to capture from any website</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={toggleTheme}
                >
                  {getThemeIcon()}
                  <span className="hidden lg:inline">{getThemeLabel()}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle theme (current: {theme})</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={onExportOpen}
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden lg:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export your data</p>
              </TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onCommandPaletteOpen}
            >
              <Command className="w-4 h-4" />
              <span className="hidden lg:inline">Commands</span>
              <Badge variant="secondary" className="text-[10px] ml-1">
                ⌘P
              </Badge>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
