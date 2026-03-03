'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Tag,
  LineChart,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { TagDistribution } from './TagDistribution';
import { StatCard } from './StatCard';
import { EmptyState } from '@/components/EmptyState';
import { staggerContainer, staggerItem } from '@/lib/animations';

interface WeeklyData {
  date: string;
  count: number;
}

interface AnalyticsTabProps {
  weeklyData: WeeklyData[];
  topTags: Array<{ tag: string; count: number }>;
  stats?: {
    total: number;
    inbox: number;
    archived: number;
    thisWeek: number;
    lastWeek: number;
  };
  productivity?: {
    capturesPerDay: number;
    archiveRate: number;
    staleRate: number;
  };
}

export function AnalyticsTab({ weeklyData, topTags, stats, productivity }: AnalyticsTabProps) {
  const maxCount = useMemo(() => {
    return Math.max(...weeklyData.map(d => d.count), 1);
  }, [weeklyData]);

  const totalCaptures = useMemo(() => {
    return weeklyData.reduce((sum, d) => sum + d.count, 0);
  }, [weeklyData]);

  const avgPerDay = useMemo(() => {
    const daysWithData = weeklyData.filter(d => d.count > 0).length || 1;
    return (totalCaptures / daysWithData).toFixed(1);
  }, [weeklyData, totalCaptures]);

  const peakDay = useMemo(() => {
    if (weeklyData.length === 0) return null;
    const peak = weeklyData.reduce((max, d) => d.count > max.count ? d : max, weeklyData[0]);
    if (peak.count === 0) return null;
    try {
      return { day: format(parseISO(peak.date), 'EEEE'), count: peak.count };
    } catch {
      return null;
    }
  }, [weeklyData]);

  // Show empty state if there's no data
  if (totalCaptures === 0 && topTags.length === 0) {
    return (
      <EmptyState
        icon={<LineChart className="w-full h-full" />}
        title="Not enough data for analytics"
        description="Start capturing items to see your activity trends and tag distribution."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Header */}
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-indigo-500" />
        <div>
          <h3 className="text-lg font-semibold">Analytics Overview</h3>
          <p className="text-sm text-muted-foreground">
            Your capture activity and tag distribution at a glance
          </p>
        </div>
      </div>

      {/* Weekly Chart - Placed prominently at top */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-blue-500" />
              Captures This Week
            </CardTitle>
            <CardDescription>
              {totalCaptures} total captures this week
              {peakDay && ` \u2022 Peak: ${peakDay.day} (${peakDay.count})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {weeklyData.map((day, index) => {
                const height = (day.count / maxCount) * 100;
                let date: Date;
                try {
                  date = parseISO(day.date);
                } catch {
                  return null;
                }
                const isToday = format(new Date(), 'yyyy-MM-dd') === day.date;

                return (
                  <motion.div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="relative w-full flex justify-center">
                      <motion.div
                        className={`w-full max-w-[40px] rounded-t-lg ${
                          isToday
                            ? 'bg-gradient-to-t from-indigo-500 to-purple-500'
                            : 'bg-gradient-to-t from-indigo-500/50 to-purple-500/50'
                        }`}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(height, 4)}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                      />
                      {day.count > 0 && (
                        <span className="absolute -top-6 text-xs font-medium">
                          {day.count}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                      {format(date, 'EEE')}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Summary Cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={staggerItem}>
          <StatCard
            title="This Week"
            value={totalCaptures}
            icon={BarChart3}
            description="Total captures"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title="Avg / Day"
            value={avgPerDay}
            icon={TrendingUp}
            description="Active days"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title="Active Tags"
            value={topTags.length}
            icon={Tag}
            description="Unique tags used"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard
            title="Archive Rate"
            value={`${productivity?.archiveRate ?? 0}%`}
            icon={Activity}
            description="Items processed"
          />
        </motion.div>
      </motion.div>

      {/* Tag Distribution - Placed below chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <TagDistribution topTags={topTags} />
      </motion.div>
    </div>
  );
}
