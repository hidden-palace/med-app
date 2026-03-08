'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  FileCheck, 
  Clock, 
  Trophy,
  TrendingUp,
  Users,
  Activity
} from 'lucide-react';
import { getDashboardStats, getRecentActivity, getUserCourseProgress } from '@/lib/database';
import type { RecentActivity } from '@/lib/supabase';

interface DashboardProps {
  userId: string | null;
  onNavigateToLearning?: () => void;
}

export function Dashboard({ userId, onNavigateToLearning }: DashboardProps) {
  const [stats, setStats] = useState([
    { title: 'Total Courses', value: '0', change: 'Loading...', icon: BookOpen, color: 'text-blue-600' },
    { title: 'Notes Validated', value: '0', change: 'Loading...', icon: FileCheck, color: 'text-green-600' },
    { title: 'Study Hours', value: '0', change: 'Loading...', icon: Clock, color: 'text-purple-600' },
    { title: 'Completion Rate', value: '0%', change: 'Loading...', icon: Trophy, color: 'text-orange-600' }
  ]);
  
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [userCourseProgress, setUserCourseProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Define loadDashboardData using useCallback to ensure stable reference
  const loadDashboardData = useCallback(async () => {
    // Early return if no authenticated user
    if (!userId) {
      console.log('No authenticated user - skipping dashboard data load');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Loading dashboard data for user:', userId);
      const [dashboardStats, activities, courseProgress] = await Promise.all([
        getDashboardStats(userId),
        getRecentActivity(userId, 4),
        getUserCourseProgress(userId)
      ]);
      
      console.log('Dashboard stats received:', dashboardStats);
      console.log('Recent activities received:', activities);
      console.log('Course progress received:', courseProgress);
      
      const completionRate = dashboardStats.totalCourses > 0 
        ? Math.round((dashboardStats.completedModules / Math.max(dashboardStats.totalCourses * 9, 1)) * 100)
        : 0;
      
      setStats([
        {
          title: 'Total Courses',
          value: dashboardStats.totalCourses.toString(),
          change: '',
          icon: BookOpen,
          color: 'text-blue-600'
        },
        {
          title: 'Notes Validated',
          value: dashboardStats.totalValidations.toString(),
          change: '',
          icon: FileCheck,
          color: 'text-green-600'
        },
        {
          title: 'Study Hours',
          value: dashboardStats.studyHours,
          change: '',
          icon: Clock,
          color: 'text-purple-600'
        },
        {
          title: 'Completion Rate',
          value: `${completionRate}%`,
          change: '',
          icon: Trophy,
          color: 'text-orange-600'
        }
      ]);
      
      setRecentActivity(activities);
      setUserCourseProgress(courseProgress);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set empty stats on error instead of mock data
      setStats([
        {
          title: 'Total Courses',
          value: '0',
          change: 'Error loading data',
          icon: BookOpen,
          color: 'text-blue-600'
        },
        {
          title: 'Notes Validated',
          value: '0',
          change: 'Error loading data',
          icon: FileCheck,
          color: 'text-green-600'
        },
        {
          title: 'Study Hours',
          value: '0',
          change: 'Error loading data',
          icon: Clock,
          color: 'text-purple-600'
        },
        {
          title: 'Completion Rate',
          value: '0%',
          change: 'Error loading data',
          icon: Trophy,
          color: 'text-orange-600'
        }
      ]);
      setRecentActivity([]);
      setUserCourseProgress([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Use the memoized function in useEffect
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'course_completed':
      case 'course_started':
        return 'bg-blue-500';
      case 'module_completed':
        return 'bg-green-500';
      case 'note_validated':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  const handleContinueLearning = () => {
    onNavigateToLearning?.();
  };

  // Get top 3 courses for progress display
  const topCoursesForProgress = userCourseProgress
    .slice()
    .sort((a, b) => {
      // Show started courses first, then by order
      if (a.isStarted && !b.isStarted) return -1;
      if (!a.isStarted && b.isStarted) return 1;
      return a.order_index - b.order_index;
    })
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                {stat.change && (
                  <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Learning Progress */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Learning Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCoursesForProgress.length > 0 ? (
              topCoursesForProgress.map((course, index) => (
                <div key={course.id}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 truncate pr-2">{course.title}</span>
                    <span className="font-medium">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-2" />
                  <div className="text-xs text-gray-500 mt-1">
                    {course.completedModulesCount} of {course.totalModules} modules completed
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No courses available</p>
              </div>
            )}
            <div className="pt-4">
              <Button 
                className="w-full" 
                onClick={handleContinueLearning}
                disabled={!onNavigateToLearning}
              >
                Continue Learning
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-green-600" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 text-sm">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  getActivityIcon(activity.activity_type)
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium truncate">
                    {activity.title}
                  </p>
                  <p className="text-gray-500 capitalize">
                    {activity.description} • {formatTimeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && !loading && (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 text-left justify-start">
              <div className="flex items-center space-x-3">
                <BookOpen className="w-6 h-6 text-blue-600" />
                <div>
                  <div className="font-medium">Start New Course</div>
                  <div className="text-xs text-gray-500 hidden sm:block">Browse available courses</div>
                </div>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 text-left justify-start">
              <div className="flex items-center space-x-3">
                <FileCheck className="w-6 h-6 text-green-600" />
                <div>
                  <div className="font-medium">Validate Note</div>
                  <div className="text-xs text-gray-500 hidden sm:block">Upload clinical notes</div>
                </div>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 text-left justify-start">
              <div className="flex items-center space-x-3">
                <Users className="w-6 h-6 text-purple-600" />
                <div>
                  <div className="font-medium">View Reports</div>
                  <div className="text-xs text-gray-500 hidden sm:block">Analytics and insights</div>
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}