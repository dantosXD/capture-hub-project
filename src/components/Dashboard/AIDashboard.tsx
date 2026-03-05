'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import {
  Sparkles,
  Inbox,
  Archive,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  FileText,
  Lightbulb,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Target,
  Zap,
  Calendar,
  BarChart3,
  Plus,
  FolderOpen,
  Brain,
  Play,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfWeek, subDays, subWeeks } from 'date-fns';
import { safeFormatRelative } from '@/lib/safe-date';
import { AIGeneratedChart } from './AIGeneratedChart';
import { AnalyticsTab } from './AnalyticsTab';
import { QuickActions } from './QuickActions';
import { ProcessingWorkflow } from './ProcessingWorkflow';
import { GTDWorkflow } from '@/components/GTD/GTDWorkflow';
import { AnimatedNumber } from './AnimatedNumber';
import { useWebSocket } from '@/hooks/useWebSocket';
import { WSEventType } from '@/lib/ws-events';
import { DashboardContentSkeleton } from '@/components/LoadingStates/DashboardStatsSkeleton';
import { ItemConnections } from './ItemConnections';

interface DashboardStats {
  total: number;
  inbox: number;
  archived: number;
  today: number;
  thisWeek: number;
  lastWeek: number;
  stale: number;
  processingRate: number;
  avgProcessingTime: number;
}

interface WeeklyData {
  date: string;
  count: number;
}

interface TrendInfo {
  current: number;
  previous: number;
  change: number | null;
  direction: 'up' | 'down';
}

interface DashboardTrends {
  total: TrendInfo;
  inbox: TrendInfo;
  captures: TrendInfo;
  processingRate: TrendInfo;
}

interface DashboardData {
  stats: DashboardStats;
  trends: DashboardTrends | null;
  staleItems: Array<{ id: string; title: string; type: string; createdAt: string }>;
  recentItems: Array<{ id: string; title: string; type: string; createdAt: string }>;
  topTags: Array<{ tag: string; count: number }>;
  insight: string;
  suggestions: Array<{ text: string; action: string; target?: string }>;
  connections: Array<{ itemA: { id: string; title: string }; itemB: { id: string; title: string }; reason: string; sharedTags?: string[]; confidence?: number }>;
  weeklyData: WeeklyData[];
  projects: Array<{ id: string; name: string; itemCount: number; color: string; status: string }>;
  productivity: {
    capturesPerDay: number;
    archiveRate: number;
    staleRate: number;
  };
}

interface AIDashboardProps {
  onNavigate?: (view: string, options?: { tag?: string }) => void;
  onSelectItem?: (id: string) => void;
  onOpenCapture?: (module: string) => void;
}

const defaultStats: DashboardStats = {
  total: 0,
  inbox: 0,
  archived: 0,
  today: 0,
  thisWeek: 0,
  lastWeek: 0,
  stale: 0,
  processingRate: 0,
  avgProcessingTime: 0,
};

const defaultData: DashboardData = {
  stats: defaultStats,
  trends: null,
  staleItems: [],
  recentItems: [],
  topTags: [],
  insight: '',
  suggestions: [],
  connections: [],
  weeklyData: [],
  projects: [],
  productivity: { capturesPerDay: 0, archiveRate: 0, staleRate: 0 },
};

const DASHBOARD_TAB_STORAGE_KEY = 'capture-hub-dashboard-tab';
const VALID_TABS = ['overview', 'workflow', 'analytics', 'projects'];

function getPersistedTab(): string {
  if (typeof window === 'undefined') return 'overview';
  try {
    const saved = sessionStorage.getItem(DASHBOARD_TAB_STORAGE_KEY);
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch {
    // sessionStorage not available (e.g., private browsing restrictions)
  }
  return 'overview';
}

function persistTab(tab: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DASHBOARD_TAB_STORAGE_KEY, tab);
  } catch {
    // Silently fail if sessionStorage is not available
  }
}

export function AIDashboard({ onNavigate, onSelectItem, onOpenCapture }: AIDashboardProps) {
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const isInitialLoadRef = useRef(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState(getPersistedTab);
  const { on: onWsEvent } = useWebSocket();

  // Persist tab selection to sessionStorage whenever it changes
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    persistTab(tab);
  }, []);

  const fetchInsights = useCallback(async () => {
    // Only show full skeleton on initial load, not on re-fetches
    if (isInitialLoadRef.current) {
      setLoading(true);
    }
    setError(false);
    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      setData({
        ...defaultData,
        ...result,
        stats: { ...defaultStats, ...result.stats },
        trends: result.trends || null,
        productivity: { ...defaultData.productivity, ...result.productivity },
      });
    } catch (err) {
      console.error('Failed to fetch insights:', err);
      setError(true);
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
    }
  }, []);

  // Listen for stats updates from WebSocket
  useEffect(() => {
    const cleanup = onWsEvent(WSEventType.STATS_UPDATED, (statsData) => {
      console.log('[AIDashboard] Stats update event received:', statsData);
      // Refresh stats when items change on any device
      fetchInsights();
    });

    return cleanup;
  }, [onWsEvent, fetchInsights]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  if (loading && isInitialLoadRef.current) {
    return <DashboardContentSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <p>Failed to load dashboard</p>
        <Button variant="outline" size="sm" onClick={fetchInsights}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Helper to format trend display
  const formatTrend = (trend: TrendInfo | undefined, invertColors = false) => {
    if (!trend || trend.change === null || (trend.current === 0 && trend.previous === 0)) {
      return { trend: undefined, trendValue: undefined };
    }
    const direction = trend.current >= trend.previous ? 'up' : 'down';
    // For some stats like "inbox", going down is good (invertColors)
    const displayDirection = invertColors
      ? (direction === 'up' ? 'down' : 'up') as 'up' | 'down'
      : direction as 'up' | 'down';
    const absChange = Math.abs(trend.change);
    const sign = trend.current >= trend.previous ? '+' : '-';
    return {
      trend: displayDirection,
      trendValue: `${sign}${absChange}% vs last week`,
    };
  };

  const totalTrend = formatTrend(data.trends?.total);
  const inboxTrend = formatTrend(data.trends?.inbox, true); // Lower inbox is better
  const capturesTrend = formatTrend(data.trends?.captures);
  const processingTrend = formatTrend(data.trends?.processingRate);

  const statCards = [
    {
      label: 'Total Items',
      value: data.stats.total,
      icon: FileText,
      color: 'text-indigo-500',
      trend: totalTrend.trend,
      trendValue: totalTrend.trendValue,
    },
    {
      label: 'In Inbox',
      value: data.stats.inbox,
      icon: Inbox,
      color: 'text-indigo-500',
      subtitle: data.stats.inbox > 0 ? 'Needs processing' : 'All clear!',
      trend: inboxTrend.trend,
      trendValue: inboxTrend.trendValue,
    },
    {
      label: 'This Week',
      value: data.stats.thisWeek,
      icon: TrendingUp,
      color: 'text-green-500',
      trend: capturesTrend.trend,
      trendValue: capturesTrend.trendValue,
    },
    {
      label: 'Processing Rate',
      value: `${data.productivity.archiveRate}%`,
      icon: Target,
      color: 'text-amber-500',
      subtitle: 'Items archived',
      trend: processingTrend.trend,
      trendValue: processingTrend.trendValue,
    },
  ];

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-500" />
            Dashboard
          </h2>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchInsights}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid - 1 column on mobile, 2 on tablet, 4 on desktop */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold">
                      <AnimatedNumber value={stat.value} />
                    </p>
                    {stat.subtitle && (
                      <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                    )}
                    {stat.trend && (
                      <div className={`flex items-center gap-1 text-xs ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                        {stat.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {stat.trendValue}
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-full bg-muted">
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <QuickActions
          onOpenCapture={onOpenCapture}
          onNavigate={onNavigate}
          onSwitchTab={handleTabChange}
          inboxCount={data.stats.inbox}
        />
      </motion.div>

      {/* AI Insight */}
      {data.insight && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-amber-500" />
                AI Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{data.insight}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflow">Process</TabsTrigger>
          <TabsTrigger value="kanban">GTD Board</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <TabsContent value="overview" className="space-y-6 mt-4">
                <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                  {/* Suggestions */}
                  {data.suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            Suggestions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {data.suggestions.map((suggestion, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group"
                              onClick={() => {
                                if (suggestion.action === 'navigate') {
                                  onNavigate?.(suggestion.target || 'inbox');
                                } else if (suggestion.action === 'openCapture') {
                                  onOpenCapture?.(suggestion.target || 'note');
                                } else if (suggestion.action === 'filter') {
                                  // Navigate to inbox with specific filter
                                  onNavigate?.(suggestion.target || 'inbox');
                                }
                              }}
                            >
                              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                              <span className="text-sm">{suggestion.text}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Stale Items Warning */}
                  {data.stats.stale > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <Card className="border-amber-500/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-lg text-amber-500">
                            <AlertTriangle className="w-5 h-5" />
                            Stale Items
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            {data.stats.stale} items haven't been processed in over 7 days
                          </p>
                          {data.staleItems.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
                              onClick={() => onSelectItem?.(item.id)}
                            >
                              <span className="truncate text-sm">{item.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {safeFormatRelative(item.createdAt)}
                              </span>
                            </div>
                          ))}
                          {data.stats.stale > 3 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => onNavigate?.('inbox')}
                            >
                              View all stale items
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>

                {/* Recent Activity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="w-5 h-5 text-blue-500" />
                        Recent Captures
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {data.recentItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
                            onClick={() => onSelectItem?.(item.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="capitalize">{item.type}</Badge>
                              <span className="truncate">{item.title}</span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {safeFormatRelative(item.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Top Tags & Connections */}
                <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                  {/* Top Tags */}
                  {data.topTags.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                    >
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Top Tags</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {data.topTags.map(({ tag, count }) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-sm cursor-pointer hover:bg-primary/20 transition-colors"
                                onClick={() => onNavigate?.('inbox', { tag })}
                              >
                                #{tag} <span className="ml-1 opacity-50">{count}</span>
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* AI-Discovered Connections */}
                  {data.connections.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                    >
                      <ItemConnections
                        connections={data.connections}
                        onSelectItem={onSelectItem}
                      />
                    </motion.div>
                  )}
                </div>
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'workflow' && (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <TabsContent value="workflow" className="mt-4">
                <ProcessingWorkflow
                  staleItems={data.staleItems}
                  onSelectItem={onSelectItem}
                  onNavigate={onNavigate}
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'kanban' && (
            <motion.div
              key="kanban"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <TabsContent value="kanban" className="mt-4 h-[calc(100vh-280px)]">
                <GTDWorkflow
                  onSelectItem={onSelectItem}
                  onNavigate={onNavigate}
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <TabsContent value="analytics" className="mt-4">
                <AnalyticsTab
                  weeklyData={data.weeklyData || []}
                  topTags={data.topTags}
                  stats={data.stats}
                  productivity={data.productivity}
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'projects' && (
            <motion.div
              key="projects"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <TabsContent value="projects" className="mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FolderOpen className="w-5 h-5 text-indigo-500" />
                          Projects
                        </CardTitle>
                        <CardDescription>
                          Organize your captures into projects
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => onNavigate?.('projects')}>
                        <Plus className="w-4 h-4 mr-1" />
                        New Project
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {data.projects && data.projects.length > 0 ? (
                      <>
                        {/* Project Statistics - stack on mobile, 4 columns on larger screens */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          {(() => {
                            const statusCounts = data.projects.reduce((acc, p) => {
                              acc[p.status] = (acc[p.status] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>);

                            const stats = [
                              { label: 'Total', value: data.projects.length, color: 'bg-slate-500' },
                              { label: 'Active', value: statusCounts.active || 0, color: 'bg-indigo-500' },
                              { label: 'On Hold', value: statusCounts['on-hold'] || 0, color: 'bg-amber-500' },
                              { label: 'Completed', value: statusCounts.completed || 0, color: 'bg-purple-500' },
                            ];

                            return stats.map((stat) => (
                              <div key={stat.label} className="text-center">
                                <div className={`text-2xl font-bold`}>
                                  <AnimatedNumber value={stat.value} />
                                </div>
                                <div className="text-xs text-muted-foreground">{stat.label}</div>
                              </div>
                            ));
                          })()}
                        </div>

                        {/* Project Grid */}
                        <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {data.projects.map((project) => (
                            <div
                              key={project.id}
                              className="p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => onNavigate?.('projects')}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
                                  style={{ backgroundColor: `${project.color}20`, borderColor: `${project.color}40` }}
                                >
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: project.color }}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{project.name}</p>
                                  <p className="text-sm text-muted-foreground">{project.itemCount} items</p>
                                  <Badge
                                    variant="outline"
                                    className={`mt-2 text-xs capitalize ${project.status === 'active'
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/20'
                                        : project.status === 'on-hold'
                                          ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/20'
                                          : project.status === 'completed'
                                            ? 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 border-purple-500/20'
                                            : 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300 border-slate-500/20'
                                      }`}
                                  >
                                    {project.status === 'on-hold' ? 'On Hold' : project.status}
                                  </Badge>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No projects yet</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => onNavigate?.('projects')}>
                          <Plus className="w-4 h-4 mr-1" />
                          Create Project
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </motion.div>
  );
}
