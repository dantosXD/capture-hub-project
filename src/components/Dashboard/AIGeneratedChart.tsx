'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Tag,
  LineChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { TagDistribution } from './TagDistribution';
import { EmptyState } from '@/components/EmptyState';

interface WeeklyData {
  date: string;
  count: number;
}

interface AIGeneratedChartProps {
  weeklyData: WeeklyData[];
  topTags: Array<{ tag: string; count: number }>;
}

export function AIGeneratedChart({ weeklyData, topTags }: AIGeneratedChartProps) {
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
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCaptures}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgPerDay}</p>
                <p className="text-sm text-muted-foreground">Avg/Day</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Tag className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{topTags.length}</p>
                <p className="text-sm text-muted-foreground">Active Tags</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5 text-blue-500" />
            Captures This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-40">
            {weeklyData.map((day, index) => {
              const height = (day.count / maxCount) * 100;
              const date = parseISO(day.date);
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

      {/* Tags Distribution */}
      <TagDistribution topTags={topTags} />
    </div>
  );
}
