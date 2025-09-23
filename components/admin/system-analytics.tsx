'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  FileText, 
  Clock,
  Download,
  RefreshCw
} from 'lucide-react';

export function SystemAnalytics() {
  const usageStats = [
    { metric: 'Daily Active Users', value: 245, change: '+12%', trend: 'up' },
    { metric: 'Course Completions', value: 89, change: '+8%', trend: 'up' },
    { metric: 'Notes Validated', value: 1247, change: '+15%', trend: 'up' },
    { metric: 'Average Session Time', value: '24m', change: '-3%', trend: 'down' }
  ];

  const popularCourses = [
    { title: 'Clinical Documentation Fundamentals', students: 245, completion: 87 },
    { title: 'Advanced Wound Assessment', students: 156, completion: 72 },
    { title: 'Emergency Medicine Protocols', students: 89, completion: 65 }
  ];

  const recentActivity = [
    { user: 'Dr. Sarah Johnson', action: 'completed', item: 'SOAP Note Structure', time: '5 min ago' },
    { user: 'Mike Chen', action: 'validated', item: 'Emergency Note #1247', time: '12 min ago' },
    { user: 'Dr. Emily Davis', action: 'started', item: 'Wound Care Protocols', time: '18 min ago' },
    { user: 'James Wilson', action: 'completed', item: 'Clinical Assessment', time: '25 min ago' }
  ];

  const systemHealth = {
    uptime: 99.9,
    responseTime: '1.2s',
    errorRate: 0.1,
    storage: 73
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">System Analytics</h3>
          <p className="text-sm text-gray-600">Platform insights and performance metrics</p>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {usageStats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.metric}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </div>
              <div className={`text-sm flex items-center space-x-1 ${
                stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp className={`w-3 h-3 ${
                  stat.trend === 'down' ? 'rotate-180' : ''
                }`} />
                <span>{stat.change}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Courses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Popular Courses</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {popularCourses.map((course, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="font-medium text-sm">{course.title}</div>
                  <Badge variant="outline">{course.students} students</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Completion Rate</span>
                    <span>{course.completion}%</span>
                  </div>
                  <Progress value={course.completion} className="h-2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span>System Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{systemHealth.uptime}%</div>
                <div className="text-xs text-gray-600">Uptime</div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{systemHealth.responseTime}</div>
                <div className="text-xs text-gray-600">Response Time</div>
              </div>
              
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{systemHealth.errorRate}%</div>
                <div className="text-xs text-gray-600">Error Rate</div>
              </div>
              
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{systemHealth.storage}%</div>
                <div className="text-xs text-gray-600">Storage Used</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <span>Recent Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">
                      {activity.user.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {activity.user} {activity.action} {activity.item}
                    </div>
                    <div className="text-xs text-gray-500">{activity.time}</div>
                  </div>
                </div>
                
                <Badge variant="outline" className="capitalize">
                  {activity.action}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}