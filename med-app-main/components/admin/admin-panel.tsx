'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CourseManagement } from './course-management';
import { UserManagement } from './user-management';
import { ReportsOverview } from './reports-overview';
import { 
  BookOpen, 
  Users,
  FileText,
  Settings
} from 'lucide-react';
import { getAllCourses, getProfiles, getAllValidationHistory } from '@/lib/database';

interface AdminPanelProps {
  userId: string | null;
}

export function AdminPanel({ userId }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('users');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalValidations: 0,
    activeSessions: 0
  });
  const [loading, setLoading] = useState(true);

  const loadAdminStats = useCallback(async () => {
    try {
      setLoading(true);

      // Load all data in parallel
      const [coursesData, usersData, validationsData] = await Promise.all([
        getAllCourses(),
        getProfiles(),
        getAllValidationHistory(1000) // Get more records for accurate count
      ]);
      
      // Calculate active sessions (users who signed in within last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeSessions = usersData.filter(user => 
        user.last_sign_in_at && new Date(user.last_sign_in_at) > oneDayAgo
      ).length;
      
      setStats({
        totalUsers: usersData.length,
        totalCourses: coursesData.length,
        totalValidations: validationsData.length,
        activeSessions
      });
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      console.error('Error loading admin stats:', errorString);
      // Keep default values on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminStats();
  }, [loadAdminStats]);

  const adminStats = [
    {
      title: 'Total Users',
      value: loading ? 'Loading...' : stats.totalUsers.toString(),
      change: 'All registered users',
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'Total Courses',
      value: loading ? 'Loading...' : stats.totalCourses.toString(),
      change: 'Published and draft courses',
      icon: BookOpen,
      color: 'text-green-600'
    },
    {
      title: 'Total Validations',
      value: loading ? 'Loading...' : stats.totalValidations.toString(),
      change: 'All validation requests',
      icon: FileText,
      color: 'text-purple-600'
    },
    {
      title: 'Active Sessions',
      value: loading ? 'Loading...' : stats.activeSessions.toString(),
      change: 'Last 24 hours',
      icon: Settings,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Admin Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {adminStats.map((stat, index) => {
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
                <div className={`text-2xl font-bold text-gray-900 ${loading ? 'animate-pulse' : ''}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Admin Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">User Management</span>
            <span className="sm:hidden">Users</span>
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Courses & Lessons</span>
            <span className="sm:hidden">Courses</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <FileText className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Validation Reports</span>
            <span className="sm:hidden">Reports</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 sm:mt-6">
          <TabsContent value="users">
            <UserManagement onStatsChange={loadAdminStats} />
          </TabsContent>

          <TabsContent value="courses">
            <CourseManagement onStatsChange={loadAdminStats} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsOverview onStatsChange={loadAdminStats} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
