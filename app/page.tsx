'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Dashboard } from '@/components/dashboard/dashboard';
import { LearningModule } from '@/components/learning/learning-module';
import { NoteValidator } from '@/components/validator/note-validator';
import { AdminPanel } from '@/components/admin/admin-panel';
import { AuthForm } from '@/components/auth/auth-form';
import { supabase } from '@/lib/supabase';
import { isUserAdmin, updateProfile } from '@/lib/database';
import type { User } from '@supabase/supabase-js';

type ActiveView = 'dashboard' | 'learning' | 'validator' | 'admin';

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdminCheck, setLoadingAdminCheck] = useState(false);
  const lastAdminCheckUserIdRef = useRef<string | null>(null);
  const adminCheckInFlightRef = useRef(false);

  const checkAdminStatus = useCallback(async (userId: string, { force = false }: { force?: boolean } = {}) => {
    if (!userId) {
      return;
    }

    if (!force && lastAdminCheckUserIdRef.current === userId) {
      return;
    }

    if (adminCheckInFlightRef.current) {
      return;
    }

    adminCheckInFlightRef.current = true;
    setLoadingAdminCheck(true);

    try {
      const adminStatus = await isUserAdmin(userId);
      setIsAdmin(adminStatus);
      lastAdminCheckUserIdRef.current = userId;
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      adminCheckInFlightRef.current = false;
      setLoadingAdminCheck(false);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Check admin status if user is authenticated
        if (currentUser) {
          await checkAdminStatus(currentUser.id, { force: true });
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Check admin status when user signs in
        if (currentUser && event === 'SIGNED_IN') {
          // Update last sign in time in profiles table, but don't block UI on it
          updateProfile(currentUser.id, {
            last_sign_in_at: new Date().toISOString()
          }).catch((error) => {
            console.error('Error updating last sign in time:', error);
          });

          await checkAdminStatus(currentUser.id, { force: true });
        } else if (event === 'SIGNED_OUT') {
          setIsAdmin(false);
          lastAdminCheckUserIdRef.current = null;
          adminCheckInFlightRef.current = false;
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [checkAdminStatus]);

  const handleNavigateToLearning = () => {
    setActiveView('learning');
  };
  
  const renderActiveView = () => {
    const userId = user?.id || null;
    
    switch (activeView) {
      case 'dashboard':
        return <Dashboard userId={userId} onNavigateToLearning={handleNavigateToLearning} />;
      case 'learning':
        return <LearningModule userId={userId} />;
      case 'validator':
        return <NoteValidator userId={userId} />;
      case 'admin':
        // Check if user is admin before rendering admin panel
        if (!isAdmin) {
          return (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
                <p className="text-gray-600">You don&apos;t have permission to access the admin panel.</p>
                <p className="text-sm text-gray-500 mt-2">Please contact an administrator if you believe this is an error.</p>
              </div>
            </div>
          );
        }
        return <AdminPanel userId={userId} />;
      default:
        return <Dashboard userId={userId} onNavigateToLearning={handleNavigateToLearning} />;
    }
  };

  // Show loading spinner while determining auth state
  if (loading || loadingAdminCheck) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {loading ? 'Loading...' : 'Checking permissions...'}
          </p>
        </div>
      </div>
    );
  }

  // Show auth form if user is not authenticated
  if (!user) {
    return <AuthForm />;
  }

  // Show main application if user is authenticated
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar 
        activeView={activeView} 
        onViewChange={setActiveView}
        isAdmin={isAdmin}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header activeView={activeView} user={user} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
