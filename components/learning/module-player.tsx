'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, Volume2, Maximize, Captions as ClosedCaptioning, CheckCircle, FileText } from 'lucide-react';
import { VolumeX } from 'lucide-react';
import { updateModuleProgress, addRecentActivity } from '@/lib/database';
import type { Course, Module } from '@/lib/supabase';

interface ModulePlayerProps {
  module: Module;
  course: Course | null;
  userId: string | null;
}

export function ModulePlayer({ module, course, userId }: ModulePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isDirectVideo, setIsDirectVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    // Check if the URL is a direct video file or a webpage
    const videoUrl = module.video_url;
    const isDirectVideoFile = /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(videoUrl);
    setIsDirectVideo(isDirectVideoFile);
  }, [module.id, module.video_url]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.target as HTMLVideoElement;
    setCurrentTime(video.currentTime);
    
    // Auto-save progress every 10 seconds
    if (Math.floor(video.currentTime) % 10 === 0) {
      saveProgress(video.currentTime, false);
    }
    
    // Mark as completed if watched 90% of the video
    if (video.duration && video.currentTime / video.duration > 0.9 && !completed) {
      handleMarkComplete();
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.target as HTMLVideoElement;
    setDuration(video.duration);
  };

  const saveProgress = async (position: number, isCompleted: boolean) => {
    try {
      // Skip saving if no authenticated user
      if (!userId) {
        console.log('Demo mode: Progress not saved (no authenticated user)');
        return;
      }
      await updateModuleProgress(
        userId,
        module.course_id,
        module.id,
        isCompleted,
        position
      );
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleMarkComplete = async () => {
    if (completed) return;
    
    try {
      setCompleted(true);
      
      // Skip database operations if no authenticated user
      if (userId) {
        await saveProgress(currentTime, true);
      
        // Add to recent activity
        await addRecentActivity(
          userId,
          'module_completed',
          module.title,
          `Completed module in ${course?.title || 'course'}`
        );
      } else {
        console.log('Demo mode: Module marked complete locally (no authenticated user)');
      }
    } catch (error) {
      console.error('Error marking complete:', error);
    }
  };

  const handleIframeLoad = () => {
    // For iframe videos, we can't control playback directly
    // So we'll simulate some basic functionality
    setDuration(0); // Unknown duration for iframe videos
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderVideoPlayer = () => {
    if (isDirectVideo) {
      // Render HTML5 video player for direct video files
      return (
        <video
          ref={videoRef}
          className="w-full aspect-video"
          src={module.video_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          Your browser does not support the video tag.
        </video>
      );
    } else {
      // Render iframe for HeyGen and other webpage-based videos
      return (
        <iframe
          ref={iframeRef}
          className="w-full aspect-video"
          src={module.video_url}
          onLoad={handleIframeLoad}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={module.title}
        />
      );
    }
  };

  const renderVideoControls = () => {
    if (!isDirectVideo) {
      // For iframe videos, show simplified info
      return (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="text-white text-sm">
              Video hosted externally - use player controls above
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
              >
                <Maximize className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Original controls for direct video files
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPause}
              className="text-white hover:bg-white/20"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVolumeToggle}
              className="text-white hover:bg-white/20"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            
            <div className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-white text-sm">
              <ClosedCaptioning className="w-4 h-4" />
              <Switch 
                checked={showCaptions}
                onCheckedChange={setShowCaptions}
              />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFullscreen}
              className="text-white hover:bg-white/20"
            >
              <Maximize className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-2">
          <div className="w-full bg-white/20 rounded-full h-1">
            <div 
              className="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-6">
      {/* Video Player */}
      <Card>
        <CardContent className="p-0">
          <div className="relative bg-black rounded-t-lg overflow-hidden">
            {renderVideoPlayer()}
            {renderVideoControls()}
          </div>
        </CardContent>
      </Card>

      {/* Module Info and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <CardTitle>{module.title}</CardTitle>
                {completed && <Badge variant="secondary">Completed</Badge>}
              </div>
              <p className="text-gray-600">{module.description}</p>
            </div>
            
            <Button onClick={handleMarkComplete} disabled={completed}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {completed ? 'Completed' : 'Mark Complete'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Module Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Module Transcript</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {module.transcript}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}