'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  BookOpen, 
  FileText, 
  BarChart3, 
  Settings, 
  GraduationCap,
  Shield,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: 'dashboard' | 'learning' | 'validator' | 'admin') => void;
  isAdmin?: boolean;
}

const navigationItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    description: 'Overview and analytics'
  },
  {
    id: 'learning',
    label: 'Learning Module',
    icon: GraduationCap,
    description: 'Courses and lessons'
  },
  {
    id: 'validator',
    label: 'Note Validator',
    icon: Shield,
    description: 'Validate clinical notes'
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Settings,
    description: 'Manage content and settings'
  }
];

// Desktop Sidebar Component
function DesktopSidebar({ activeView, onViewChange, isAdmin }: SidebarProps) {
  return (
    <div className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">MedLearn</h1>
            <p className="text-xs text-gray-500">Learning Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.filter(item => item.id !== 'admin' || isAdmin).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "w-full justify-start h-auto p-3 text-left",
                isActive && "bg-blue-600 text-white hover:bg-blue-700",
                !isActive && "text-gray-700 hover:bg-gray-100"
              )}
              onClick={() => onViewChange(item.id as any)}
            >
              <div className="flex items-start space-x-3">
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.label}</div>
                  <div className={cn(
                    "text-xs mt-0.5",
                    isActive ? "text-blue-100" : "text-gray-500"
                  )}>
                    {item.description}
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}

// Mobile Sidebar Component
function MobileSidebar({ activeView, onViewChange, isAdmin }: SidebarProps) {
  const [open, setOpen] = useState(false);

  const handleViewChange = (view: 'dashboard' | 'learning' | 'validator' | 'admin') => {
    onViewChange(view);
    setOpen(false); // Close sidebar after selection
  };

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="w-5 h-5" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
            </SheetHeader>
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">MedLearn</h1>
                    <p className="text-xs text-gray-500">Learning Platform</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {navigationItems.filter(item => item.id !== 'admin' || isAdmin).map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start h-auto p-3 text-left",
                      isActive && "bg-blue-600 text-white hover:bg-blue-700",
                      !isActive && "text-gray-700 hover:bg-gray-100"
                    )}
                    onClick={() => handleViewChange(item.id as any)}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className={cn(
                          "text-xs mt-0.5",
                          isActive ? "text-blue-100" : "text-gray-500"
                        )}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 text-center">
                Version 1.0.0
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function Sidebar({ activeView, onViewChange, isAdmin }: SidebarProps) {
  return (
    <>
      <DesktopSidebar activeView={activeView} onViewChange={onViewChange} isAdmin={isAdmin} />
      <MobileSidebar activeView={activeView} onViewChange={onViewChange} isAdmin={isAdmin} />
    </>
  );
}