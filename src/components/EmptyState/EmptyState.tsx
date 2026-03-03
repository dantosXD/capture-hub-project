'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn(
      'text-center border-dashed bg-gradient-to-br from-muted/20 to-muted/5',
      className
    )}>
      <CardContent className="py-12 px-6">
        <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
          <div className="w-16 h-16 flex items-center justify-center rounded-full bg-muted/50 text-muted-foreground/70">
            {icon}
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
          {action && (
            <Button onClick={action.onClick} className="gap-2 mt-2">
              {action.icon}
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
