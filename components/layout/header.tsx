'use client';

import { Button } from '@/components/ui/button';
import { Bell, User, Search, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface HeaderProps {
  activeView: string;
  user?: SupabaseUser | null;
  onMobileMenuClick?: () => void;
}

const viewTitles = {
  dashboard: 'Dashboard',
  learning: 'Learning Module',
  validator: 'Note Validator',
  admin: 'Administration'
};

export function Header({ activeView, user, onMobileMenuClick }: HeaderProps) {
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Mobile menu button - will be handled by Sidebar component */}
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
            {viewTitles[activeView as keyof typeof viewTitles]}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">
            {activeView === 'dashboard' && 'Monitor your learning progress and system overview'}
            {activeView === 'learning' && 'Access courses, lessons, and track your progress'}
            {activeView === 'validator' && 'Validate clinical notes for compliance'}
            {activeView === 'admin' && 'Manage courses, lessons, and system settings'}
          </p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search..."
              className="pl-10 w-32 sm:w-48 md:w-64"
            />
          </div>
          
          <Button variant="outline" size="icon" className="hidden sm:flex">
            <Bell className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon">
              <User className="w-4 h-4" />
            </Button>
            
            <Button variant="outline" size="icon" onClick={handleLogout} title="Sign Out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}