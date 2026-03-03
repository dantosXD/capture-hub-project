'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Edit3,
  ScanLine,
  Camera,
  Globe,
  Clock,
} from 'lucide-react';
import { safeFormatRelative } from '@/lib/safe-date';
import { typeBgColors } from '@/lib/type-colors';

interface RecentItem {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

interface RecentActivityProps {
  items: RecentItem[];
  onItemClick?: (id: string) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  note: <FileText className="w-3 h-3" />,
  scratchpad: <Edit3 className="w-3 h-3" />,
  ocr: <ScanLine className="w-3 h-3" />,
  screenshot: <Camera className="w-3 h-3" />,
  webpage: <Globe className="w-3 h-3" />,
};

const typeColors = typeBgColors;

export function RecentActivity({ items, onItemClick }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No recent captures
          </div>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 group cursor-pointer"
                  onClick={() => onItemClick?.(item.id)}
                >
                  <div
                    className={`w-7 h-7 rounded-lg ${
                      typeColors[item.type] || 'bg-gray-500'
                    } flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    {typeIcons[item.type] || <FileText className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {item.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {safeFormatRelative(item.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                    {item.type}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
