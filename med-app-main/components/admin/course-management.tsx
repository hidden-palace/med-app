'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  Users,
  Clock,
  BookOpen,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertTriangle,
  Play,
  Save,
  X,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { 
  getCourses, 
  getAllCourses,
  getCourseModules,
  createCourse, 
  updateCourse, 
  deleteCourse, 
  publishCourse,
  createModule,
  updateModule,
  deleteModule,
  publishModule,
  reorderCourses,
  reorderModules
} from '@/lib/database';
import type { Course, Module } from '@/lib/supabase';

interface CourseManagementProps {
  onStatsChange?: () => void;
}

export function CourseManagement({ onStatsChange }: CourseManagementProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateModuleModalOpen, setIsCreateModuleModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [activeTab, setActiveTab] = useState('courses');
  const [success, setSuccess] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllCourses(); // Load all courses including unpublished for admin
      setCourses(data);
      setSuccess('Courses loaded successfully');
      
      // Notify parent component about stats change
      if (onStatsChange) {
        onStatsChange();
      }
    } catch (err) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onStatsChange]);

  const loadModules = useCallback(async (courseId: string) => {
    try {
      setModulesLoading(true);
      const data = await getCourseModules(courseId);
      setModules(data);
    } catch (err) {
      console.error('Error loading modules:', err);
      setError('Failed to load modules.');
    } finally {
      setModulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (selectedCourse) {
      loadModules(selectedCourse.id);
    }
  }, [selectedCourse, loadModules]);

  // Auto-clear success and error messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleTogglePublishCourse = async (courseId: string, currentStatus: boolean) => {
    try {
      setActionLoading(`publish-course-${courseId}`);
      await publishCourse(courseId, !currentStatus);
      
      // Update local state
      setCourses(courses.map(course => 
        course.id === courseId 
          ? { ...course, published: !currentStatus }
          : course
      ));
      setSuccess(`Course ${!currentStatus ? 'published' : 'unpublished'} successfully`);
    } catch (err) {
      console.error('Error updating course publish status:', err);
      setError('Failed to update course publish status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePublishModule = async (moduleId: string, currentStatus: boolean) => {
    try {
      setActionLoading(`publish-module-${moduleId}`);
      await publishModule(moduleId, !currentStatus);
      
      // Update local state
      setModules(modules.map(module => 
        module.id === moduleId 
          ? { ...module, published: !currentStatus }
          : module
      ));
      setSuccess(`Module ${!currentStatus ? 'published' : 'unpublished'} successfully`);
    } catch (err) {
      console.error('Error updating module publish status:', err);
      setError('Failed to update module publish status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course? This will also delete all associated modules.')) {
      return;
    }

    try {
      setActionLoading(`delete-course-${courseId}`);
      await deleteCourse(courseId);
      
      // Update local state
      setCourses(courses.filter(course => course.id !== courseId));
      
      // Clear selected course if it was deleted
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
        setModules([]);
      }
      setSuccess('Course deleted successfully');
    } catch (err) {
      console.error('Error deleting course:', err);
      setError('Failed to delete course.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module?')) {
      return;
    }

    try {
      setActionLoading(`delete-module-${moduleId}`);
      await deleteModule(moduleId);
      
      // Update local state
      setModules(modules.filter(module => module.id !== moduleId));
      setSuccess('Module deleted successfully');
    } catch (err) {
      console.error('Error deleting module:', err);
      setError('Failed to delete module.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReorderCourses = async (direction: 'up' | 'down', courseIndex: number) => {
    if (
      (direction === 'up' && courseIndex === 0) ||
      (direction === 'down' && courseIndex === courses.length - 1)
    ) {
      return;
    }

    const newCourses = [...courses];
    const targetIndex = direction === 'up' ? courseIndex - 1 : courseIndex + 1;
    
    // Swap courses
    [newCourses[courseIndex], newCourses[targetIndex]] = [newCourses[targetIndex], newCourses[courseIndex]];
    
    try {
      setActionLoading(`reorder-courses`);
      const courseIds = newCourses.map(course => course.id);
      await reorderCourses(courseIds);
      setCourses(newCourses);
      setSuccess('Courses reordered successfully');
    } catch (err) {
      console.error('Error reordering courses:', err);
      setError('Failed to reorder courses.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReorderModules = async (direction: 'up' | 'down', moduleIndex: number) => {
    if (
      !selectedCourse ||
      (direction === 'up' && moduleIndex === 0) ||
      (direction === 'down' && moduleIndex === modules.length - 1)
    ) {
      return;
    }

    const newModules = [...modules];
    const targetIndex = direction === 'up' ? moduleIndex - 1 : moduleIndex + 1;
    
    // Swap modules
    [newModules[moduleIndex], newModules[targetIndex]] = [newModules[targetIndex], newModules[moduleIndex]];
    
    try {
      setActionLoading(`reorder-modules`);
      const moduleIds = newModules.map(module => module.id);
      await reorderModules(selectedCourse.id, moduleIds);
      setModules(newModules);
      setSuccess('Modules reordered successfully');
    } catch (err) {
      console.error('Error reordering modules:', err);
      setError('Failed to reorder modules.');
    } finally {
      setActionLoading(null);
    }
  };

  const CourseForm = ({ course, onSave, onCancel }: { 
    course?: Course | null, 
    onSave: (course: Omit<Course, 'id' | 'created_at' | 'updated_at'>) => void, 
    onCancel: () => void 
  }) => {
    const [formData, setFormData] = useState({
      title: course?.title || '',
      description: course?.description || '',
      thumbnail: course?.thumbnail || '',
      order_index: course?.order_index || 0,
      published: course?.published || false
    });
    const [formLoading, setFormLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      try {
        setFormLoading(true);
        
        if (course) {
          // Update existing course
          await updateCourse(course.id, formData);
          setSuccess('Course updated successfully');
        } else {
          // Create new course
          await createCourse(formData);
          setSuccess('Course created successfully');
        }
        
        onSave(formData);
        loadCourses(); // Reload courses
        onCancel(); // Close modal
      } catch (err) {
        console.error('Error saving course:', err);
        setError('Failed to save course.');
      } finally {
        setFormLoading(false);
      }
    };

    return (
      <ScrollArea className="max-h-[70vh]">
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div>
          <Label htmlFor="title">Course Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            disabled={formLoading}
          />
        </div>
        
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={formLoading}
            rows={3}
          />
        </div>
        
        <div>
          <Label htmlFor="thumbnail">Thumbnail URL</Label>
          <Input
            id="thumbnail"
            value={formData.thumbnail}
            onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
            placeholder="https://example.com/image.jpg"
            required
            disabled={formLoading}
          />
          {formData.thumbnail && (
            <div className="mt-2">
              <Image
                src={formData.thumbnail}
                alt="Thumbnail preview"
                width={128}
                height={80}
                className="w-32 h-20 object-cover rounded border"
                loading="lazy"
              />
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="published"
            checked={formData.published}
            onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
            disabled={formLoading}
          />
          <Label htmlFor="published">Published</Label>
        </div>
        
        <div className="flex space-x-2">
          <Button type="submit" disabled={formLoading} className="flex-1">
            {formLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {course ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {course ? 'Update Course' : 'Create Course'}
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={formLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
        </form>
      </ScrollArea>
    );
  };

  const ModuleForm = ({ module, onSave, onCancel }: { 
    module?: Module | null, 
    onSave: (module: Omit<Module, 'id' | 'created_at' | 'updated_at'>) => void, 
    onCancel: () => void 
  }) => {
    const [formData, setFormData] = useState({
      course_id: selectedCourse?.id || '',
      title: module?.title || '',
      description: module?.description || '',
      video_url: module?.video_url || '',
      transcript: module?.transcript || '',
      duration: module?.duration || '',
      order_index: module?.order_index || 0,
      published: module?.published || false
    });
    const [formLoading, setFormLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!selectedCourse) {
        setError('Please select a course first.');
        return;
      }

      try {
        setFormLoading(true);
        
        const moduleData = {
          ...formData,
          course_id: selectedCourse.id
        };
        
        if (module) {
          // Update existing module
          await updateModule(module.id, moduleData);
          setSuccess('Module updated successfully');
        } else {
          // Create new module
          await createModule(moduleData);
          setSuccess('Module created successfully');
        }
        
        onSave(moduleData);
        loadModules(selectedCourse.id); // Reload modules
        onCancel(); // Close modal
      } catch (err) {
        console.error('Error saving module:', err);
        setError('Failed to save module.');
      } finally {
        setFormLoading(false);
      }
    };

    return (
      <ScrollArea className="max-h-[70vh]">
        <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div>
          <Label htmlFor="module-title">Module Title</Label>
          <Input
            id="module-title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            disabled={formLoading}
          />
        </div>
        
        <div>
          <Label htmlFor="module-description">Description</Label>
          <Textarea
            id="module-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={formLoading}
            rows={3}
          />
        </div>
        
        <div>
          <Label htmlFor="video-url">Video URL</Label>
          <Input
            id="video-url"
            value={formData.video_url}
            onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
            placeholder="https://example.com/video.mp4"
            required
            disabled={formLoading}
          />
        </div>
        
        <div>
          <Label htmlFor="transcript">Transcript</Label>
          <Textarea
            id="transcript"
            value={formData.transcript}
            onChange={(e) => setFormData({ ...formData, transcript: e.target.value })}
            rows={4}
            disabled={formLoading}
          />
        </div>
        
        <div>
          <Label htmlFor="module-duration">Duration</Label>
          <Input
            id="module-duration"
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            placeholder="e.g., 15:30"
            required
            disabled={formLoading}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="module-published"
            checked={formData.published}
            onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
            disabled={formLoading}
          />
          <Label htmlFor="module-published">Published</Label>
        </div>
        
        <div className="flex space-x-2">
          <Button type="submit" disabled={formLoading} className="flex-1">
            {formLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {module ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {module ? 'Update Module' : 'Create Module'}
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={formLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
        </form>
      </ScrollArea>
    );
  };

  const CourseLoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Course Management</h3>
            <p className="text-sm text-gray-600">Manage courses and lessons</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <CourseLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Course Management</h3>
          <p className="text-sm text-gray-600">Manage courses and lessons</p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={loadCourses} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Course
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Course</DialogTitle>
            </DialogHeader>
            <CourseForm
              onSave={(course) => {
                // Course will be reloaded in the form handler
                setIsCreateModalOpen(false);
              }}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* Tabs for Courses and Modules */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="modules" disabled={!selectedCourse}>
            Modules {selectedCourse && `(${modules.length})`}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="courses" className="space-y-4">
          {/* Courses List */}
          {courses.map((course, index) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {course.thumbnail && (
                        <Image
                          src={course.thumbnail}
                          alt={course.title}
                          width={64}
                          height={40}
                          className="w-16 h-10 object-cover rounded border"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{course.title}</h4>
                          <Badge variant={course.published ? "default" : "secondary"}>
                            {course.published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 mb-3">{course.description}</p>
                    
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <BookOpen className="w-4 h-4" />
                        <span>Order: {course.order_index}</span>
                      </div>
                      <span>Created: {new Date(course.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(course.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Reorder buttons */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReorderCourses('up', index)}
                      disabled={index === 0 || actionLoading === 'reorder-courses'}
                      title="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReorderCourses('down', index)}
                      disabled={index === courses.length - 1 || actionLoading === 'reorder-courses'}
                      title="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    
                    {/* Select course for module management */}
                    <Button
                      variant={selectedCourse?.id === course.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedCourse(course);
                        setActiveTab('modules');
                      }}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Modules
                    </Button>
                    
                    {/* Publish/Unpublish */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePublishCourse(course.id, course.published)}
                      disabled={actionLoading === `publish-course-${course.id}`}
                    >
                      {actionLoading === `publish-course-${course.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                        course.published ? 'Unpublish' : 'Publish'
                      )}
                    </Button>
                    
                    {/* View */}
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    {/* Edit */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Course</DialogTitle>
                        </DialogHeader>
                        <CourseForm
                          course={course}
                          onSave={(updatedCourse) => {
                            // Course will be reloaded in the form handler
                          }}
                          onCancel={() => {}}
                        />
                      </DialogContent>
                    </Dialog>
                    
                    {/* Delete */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCourse(course.id)}
                      disabled={actionLoading === `delete-course-${course.id}`}
                      className="text-red-600 hover:text-red-700"
                    >
                      {actionLoading === `delete-course-${course.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                      <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {courses.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No courses found</p>
                <Button className="mt-4" onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Course
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="modules" className="space-y-4">
          {selectedCourse && (
            <>
              {/* Module Management Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-semibold">Modules for &ldquo;{selectedCourse.title}&rdquo;</h4>
                  <p className="text-sm text-gray-600">Manage lessons within this course</p>
                </div>
                
                <Dialog open={isCreateModuleModalOpen} onOpenChange={setIsCreateModuleModalOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Module
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Module</DialogTitle>
                    </DialogHeader>
                    <ModuleForm
                      onSave={(module) => {
                        // Module will be reloaded in the form handler
                        setIsCreateModuleModalOpen(false);
                      }}
                      onCancel={() => setIsCreateModuleModalOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              
              {/* Modules Loading State */}
              {modulesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-1/3" />
                          </div>
                          <div className="flex space-x-2">
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-8 w-16" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                /* Modules List */
                modules.map((module, index) => (
                <Card key={module.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h5 className="font-semibold text-gray-900">{module.title}</h5>
                          <Badge variant={module.published ? "default" : "secondary"}>
                            {module.published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-600 mb-2">{module.description}</p>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{module.duration}</span>
                          </div>
                          <span>Order: {module.order_index}</span>
                          <span>Updated: {new Date(module.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Reorder buttons */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReorderModules('up', index)}
                          disabled={index === 0 || actionLoading === 'reorder-modules'}
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReorderModules('down', index)}
                          disabled={index === modules.length - 1 || actionLoading === 'reorder-modules'}
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        
                        {/* Publish/Unpublish */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePublishModule(module.id, module.published)}
                          disabled={actionLoading === `publish-module-${module.id}`}
                        >
                          {actionLoading === `publish-module-${module.id}` ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            module.published ? 'Unpublish' : 'Publish'
                          )}
                        </Button>
                        
                        {/* Edit */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Edit Module</DialogTitle>
                            </DialogHeader>
                            <ModuleForm
                              module={module}
                              onSave={(updatedModule) => {
                                // Module will be reloaded in the form handler
                              }}
                              onCancel={() => {}}
                            />
                          </DialogContent>
                        </Dialog>
                        
                        {/* Delete */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteModule(module.id)}
                          disabled={actionLoading === `delete-module-${module.id}`}
                          className="text-red-600 hover:text-red-700"
                        >
                          {actionLoading === `delete-module-${module.id}` ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                          <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              )}
              
              {modules.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No modules found for this course</p>
                    <Button className="mt-4" onClick={() => setIsCreateModuleModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Module
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}