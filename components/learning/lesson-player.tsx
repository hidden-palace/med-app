'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, Volume2, Maximize, Captions as ClosedCaptioning, CheckCircle, FileText, Image as ImageIcon } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  transcript: string;
  duration: string;
  completed: boolean;
  images: string[];
}

interface LessonPlayerProps {
  lesson: Lesson;
}

export function LessonPlayer({ lesson }: LessonPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const handleMarkComplete = () => {
    // Handle lesson completion
    console.log('Marking lesson as complete:', lesson.id);
  };

  return (
    <div className="space-y-6">
      {/* Video Player */}
      <Card>
        <CardContent className="p-0">
          <div className="relative bg-black rounded-t-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full aspect-video"
              poster={lesson.images[0]}
              onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
            >
              <source src={lesson.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            {/* Video Controls Overlay */}
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
                    className="text-white hover:bg-white/20"
                  >
                    <Volume2 className="w-5 h-5" />
                  </Button>
                  
                  <div className="text-white text-sm">
                    {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {lesson.duration}
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
                    className="text-white hover:bg-white/20"
                  >
                    <Maximize className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lesson Info and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <CardTitle>{lesson.title}</CardTitle>
                {lesson.completed && <Badge variant="secondary">Completed</Badge>}
              </div>
              <p className="text-gray-600">{lesson.description}</p>
            </div>
            
            <Button onClick={handleMarkComplete} disabled={lesson.completed}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {lesson.completed ? 'Completed' : 'Mark Complete'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Lesson Content Tabs */}
      <Tabs defaultValue="transcript" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transcript" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Transcript</span>
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4" />
            <span>Materials</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Lesson Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 leading-relaxed">{lesson.transcript}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <CardTitle>Course Materials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lesson.images.map((image, index) => (
                  <div key={index} className="relative group h-48 overflow-hidden rounded-lg">
                    <Image
                      src={image}
                      alt={`Course material ${index + 1}`}
                      fill
                      className="object-cover group-hover:opacity-80 transition-opacity"
                      loading="lazy"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="secondary" size="sm">
                        View Full Size
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}