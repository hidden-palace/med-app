'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Clock, 
  BookOpen, 
  CheckCircle,
  PlayCircle
} from 'lucide-react';
import { getCourses, getCourseModules, getAllModules, getUserProgress } from '@/lib/database';
import type { Course, Module, UserProgress } from '@/lib/supabase';

// Add debug logging
const DEBUG = true;

function debugLog(message: string, data?: any) {
  if (DEBUG) {
    console.log(`[CourseList] ${message}`, data);
  }
}

interface CourseListProps {
  selectedCourse: Course | null;
  onCourseSelect: (course: Course) => void;
  onModuleSelect: (module: Module) => void;
  userId: string | null;
}

export function CourseList({ selectedCourse, onCourseSelect, onModuleSelect, userId }: CourseListProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [allAvailableModules, setAllAvailableModules] = useState<Module[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  
  const loadCourses = useCallback(async () => {
    debugLog('Starting to load courses...');
    try {
      const coursesData = await getCourses();
      // Skip user progress if no authenticated user
      const progressData = userId ? await getUserProgress(userId) : [];
      // Load all modules for progress calculation and course details
      const allModulesData = await getAllModules();
      debugLog('Loaded courses and progress:', { 
        coursesCount: coursesData.length, 
        progressCount: progressData.length,
        modulesCount: allModulesData.length
      });
      setCourses(coursesData);
      setUserProgress(progressData);
      setAllAvailableModules(allModulesData);
    } catch (error) {
      debugLog('Error loading courses:', error);
      // Try to load all courses (including unpublished) for debugging
      try {
        const { getAllCourses } = await import('@/lib/database');
        const allCourses = await getAllCourses();
        debugLog('All courses (including unpublished):', allCourses);
      } catch (debugError) {
        debugLog('Error loading all courses for debug:', debugError);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadCourseModules = useCallback(async (courseId: string) => {
    debugLog('Loading modules for course:', courseId);
    try {
      debugLog('About to call getCourseModules with courseId:', courseId);
      // Fetch published modules directly for the selected course
      const modulesData = await getCourseModules(courseId);
      debugLog('Loaded modules:', { courseId, modulesCount: modulesData.length });
      debugLog('Module details:', modulesData);
      setModules(modulesData);
    } catch (error) {
      debugLog('Error loading modules:', error);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (selectedCourse) {
      loadCourseModules(selectedCourse.id);
    }
  }, [loadCourseModules, selectedCourse]);
  
  const calculateCourseProgress = (courseId: string) => {
    // Use the modules state for the selected course, or filter from allAvailableModules for other courses
    const courseModules = selectedCourse?.id === courseId ? modules : allAvailableModules.filter(m => m.course_id === courseId);
    const completedModules = userProgress.filter(p => 
      p.course_id === courseId && p.completed
    );
    
    const totalModules = courseModules.length;
    if (totalModules === 0) return 0;
    return Math.round((completedModules.length / totalModules) * 100);
  };
  
  const isModuleCompleted = (moduleId: string) => {
    return userProgress.some(p => p.module_id === moduleId && p.completed);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading courses...</p>
        </div>
      </div>
    );
  }
  
  if (selectedCourse) {
    const courseProgress = calculateCourseProgress(selectedCourse.id);
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{selectedCourse.title}</CardTitle>
                <p className="text-gray-600 mt-2">{selectedCourse.description}</p>
              </div>
              <Image
                src={selectedCourse.thumbnail}
                alt={selectedCourse.title}
                width={96}
                height={64}
                className="w-24 h-16 object-cover rounded-lg"
                loading="lazy"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">{modules.length} modules</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">~{modules.length * 30}min total</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{courseProgress}% complete</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Course Progress</span>
                <span>{courseProgress}%</span>
              </div>
              <Progress value={courseProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Modules</h3>
          <div className="grid gap-4">
            {modules.map((module, index) => {
              const completed = isModuleCompleted(module.id);
              return (
                <Card key={module.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg">
                        {completed ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <PlayCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{module.title}</h4>
                          {completed && <Badge variant="secondary">Completed</Badge>}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Module {index + 1}</span>
                          <span>{module.duration}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => onModuleSelect(module)}
                      variant={completed ? "outline" : "default"}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {completed ? 'Review' : 'Start'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {courses.map((course) => {
          const progress = calculateCourseProgress(course.id);
          return (
            <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardHeader className="p-0">
              <div className="relative overflow-hidden rounded-t-lg h-48">
                <Image
                  src={course.thumbnail}
                  alt={course.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300" />
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <p className="text-sm text-gray-600 mt-2">{course.description}</p>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <BookOpen className="w-4 h-4" />
                    <span>{allAvailableModules.filter(m => m.course_id === course.id).length} modules</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{Math.round(allAvailableModules.filter(m => m.course_id === course.id).length * 0.5 * 10) / 10} hours</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                
                <Button 
                  className="w-full"
                  onClick={() => onCourseSelect(course)}
                >
                  {progress > 0 ? 'Continue Course' : 'Start Course'}
                </Button>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}