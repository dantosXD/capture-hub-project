'use client';

import { motion } from 'framer-motion';
import {
  Zap,
  FileText,
  Edit3,
  ScanLine,
  Camera,
  Globe,
  Inbox,
  CheckCircle2,
  Archive,
  Sparkles,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { typeTextColors } from '@/lib/type-colors';

interface QuickActionsProps {
  onOpenCapture?: (module: string) => void;
  onNavigate?: (view: string) => void;
  onSwitchTab?: (tab: string) => void;
  inboxCount: number;
}

const captureActions = [
  { id: 'quick', label: 'Quick Note', icon: FileText, color: typeTextColors.note },
  { id: 'scratchpad', label: 'Scratch Pad', icon: Edit3, color: typeTextColors.scratchpad },
  { id: 'ocr', label: 'OCR Tool', icon: ScanLine, color: typeTextColors.ocr },
  { id: 'screenshot', label: 'Screenshot', icon: Camera, color: typeTextColors.screenshot },
  { id: 'webpage', label: 'Web Capture', icon: Globe, color: typeTextColors.webpage },
];

const workflowActions = [
  { id: 'process-inbox', label: 'Process Inbox', icon: CheckCircle2, color: 'text-indigo-500', tab: 'workflow' },
  { id: 'review-archived', label: 'Review Archive', icon: Archive, color: 'text-slate-500', view: 'archived' },
  { id: 'view-analytics', label: 'View Analytics', icon: BarChart3, color: 'text-blue-500', tab: 'analytics' },
  { id: 'ai-suggestions', label: 'AI Suggestions', icon: Sparkles, color: 'text-amber-500', tab: 'overview' },
];

export function QuickActions({ onOpenCapture, onNavigate, onSwitchTab, inboxCount }: QuickActionsProps) {
  return (
    <Card className="bg-gradient-to-r from-muted/50 to-muted/30">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Quick Actions</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Capture Actions */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">Capture</p>
            <div className="flex flex-wrap gap-2">
              {captureActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => onOpenCapture?.(action.id)}
                  >
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                    {action.label}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Workflow Actions */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground font-medium">Workflow</p>
            <div className="flex flex-wrap gap-2">
              {workflowActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (index + 5) * 0.05 }}
                >
                  <Button
                    variant={action.id === 'process-inbox' && inboxCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      // Use tab switch for dashboard-internal navigation, view for page-level navigation
                      if ('tab' in action) {
                        onSwitchTab?.(action.tab as string);
                      } else if ('view' in action) {
                        onNavigate?.(action.view as string);
                      }
                    }}
                  >
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                    {action.label}
                    {action.id === 'process-inbox' && inboxCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-background/20 rounded text-xs">
                        {inboxCount}
                      </span>
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Productivity Tip */}
        {inboxCount > 5 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3"
          >
            <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-medium">Tip:</span> Process your inbox regularly to maintain clarity. 
                Try the "2-minute rule" - if it takes less than 2 minutes, do it now!
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate?.('inbox')}
              className="flex-shrink-0"
            >
              Start
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
