'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Link2,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ConnectionPair {
  itemA: { id: string; title: string };
  itemB: { id: string; title: string };
  reason: string;
  sharedTags: string[];
  confidence: number;
}

interface ItemConnectionsProps {
  connections: Array<{
    itemA: { id: string; title: string };
    itemB: { id: string; title: string };
    reason: string;
    sharedTags?: string[];
    confidence?: number;
  }>;
  onSelectItem?: (id: string) => void;
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'Strong';
  if (confidence >= 50) return 'Moderate';
  return 'Weak';
}

function getConfidenceBadgeVariant(confidence: number): 'default' | 'secondary' | 'outline' {
  if (confidence >= 80) return 'default';
  if (confidence >= 50) return 'secondary';
  return 'outline';
}

export function ItemConnections({ connections, onSelectItem }: ItemConnectionsProps) {
  if (!connections || connections.length === 0) {
    return null;
  }

  // Normalize connections to include sharedTags and confidence
  const normalizedConnections: ConnectionPair[] = connections.map((conn) => {
    // Extract shared tags from reason if not provided separately
    let sharedTags = conn.sharedTags || [];
    let confidence = conn.confidence || 0;

    if (sharedTags.length === 0 && conn.reason) {
      // Parse "Share tags: tag1, tag2" from reason
      const tagMatch = conn.reason.match(/(?:Share|Shared)\s+tags?:\s*(.+?)(?:;|$)/i);
      if (tagMatch) {
        sharedTags = tagMatch[1].split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    }

    // Calculate confidence from number of shared tags if not provided
    if (confidence === 0) {
      confidence = Math.min(100, sharedTags.length * 25 + 15);
      // Boost if reason includes content similarity
      if (conn.reason?.toLowerCase().includes('similar content')) {
        confidence = Math.min(100, confidence + 20);
      }
      if (conn.reason?.toLowerCase().includes('similar title')) {
        confidence = Math.min(100, confidence + 15);
      }
    }

    return {
      ...conn,
      sharedTags,
      confidence,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="w-5 h-5 text-purple-500" />
          AI-Discovered Connections
        </CardTitle>
        <CardDescription>
          Items linked by shared tags and semantic similarity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {normalizedConnections.map((conn, index) => (
              <motion.div
                key={`${conn.itemA.id}-${conn.itemB.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.1 }}
                className="p-3 rounded-lg border hover:border-purple-500/30 hover:bg-muted/30 transition-all"
              >
                {/* Connection pair */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="truncate flex-1 text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={() => onSelectItem?.(conn.itemA.id)}
                    title={conn.itemA.title}
                  >
                    {conn.itemA.title}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <ArrowRight className="w-4 h-4 text-purple-400" />
                  </div>
                  <span
                    className="truncate flex-1 text-sm font-medium cursor-pointer hover:text-primary transition-colors text-right"
                    onClick={() => onSelectItem?.(conn.itemB.id)}
                    title={conn.itemB.title}
                  >
                    {conn.itemB.title}
                  </span>
                </div>

                {/* Confidence score */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <Progress
                      value={conn.confidence}
                      className="h-1.5"
                    />
                  </div>
                  <Badge
                    variant={getConfidenceBadgeVariant(conn.confidence)}
                    className="text-xs whitespace-nowrap"
                  >
                    {conn.confidence}% {getConfidenceLabel(conn.confidence)}
                  </Badge>
                </div>

                {/* Shared tags */}
                {conn.sharedTags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    {conn.sharedTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-xs py-0 px-1.5"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
