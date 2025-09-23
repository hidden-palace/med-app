'use client';

import { useState, useEffect } from 'react';
import { CourseList } from './course-list';
import { ModulePlayer } from './module-player';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getCourseById } from '@/lib/database';
import type { Course, Module } from '@/lib/supabase';

interface LearningModuleProps {
  userId: string | null;
}

export function LearningModule({ userId }: LearningModuleProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setSelectedModule(null);
  };

  const handleBackToModules = () => {
    setSelectedModule(null);
  };

  if (selectedModule) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBackToModules}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Modules
          </Button>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{selectedModule.title}</h3>
            <p className="text-sm text-gray-500">{selectedCourse?.title}</p>
          </div>
        </div>
        
        <ModulePlayer module={selectedModule} course={selectedCourse} userId={userId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedCourse && (
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBackToCourses}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Courses
          </Button>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{selectedCourse.title}</h3>
            <p className="text-sm text-gray-500">Course Overview</p>
          </div>
        </div>
      )}
      
      <CourseList
        selectedCourse={selectedCourse}
        onCourseSelect={setSelectedCourse}
        onModuleSelect={setSelectedModule}
        userId={userId}
      />
    </div>
  );
}