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
import type { User, AuthChangeEvent } from '@supabase/supabase-js';

type ActiveView = 'dashboard' | 'learning' | 'validator' | 'admin';

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const lastAdminCheckUserIdRef = useRef<string | null>(null);
  const adminCheckPromiseRef = useRef<Promise<boolean> | null>(null);
  const adminStatusRef = useRef(false);

  useEffect(() => {
    adminStatusRef.current = isAdmin;
  }, [isAdmin]);

  const checkAdminStatus = useCallback(
    async (
      userId: string | null | undefined,
      options: { force?: boolean } = {}
    ): Promise<boolean> => {
      const { force = false } = options;

      if (!userId) {
        setIsAdmin(false);
        adminStatusRef.current = false;
        lastAdminCheckUserIdRef.current = null;
        return false;
      }

      if (!force && lastAdminCheckUserIdRef.current === userId && !adminCheckPromiseRef.current) {
        return adminStatusRef.current;
      }

      if (adminCheckPromiseRef.current) {
        return adminCheckPromiseRef.current;
      }

      const promise = (async () => {
        try {
          const adminStatus = await isUserAdmin(userId);
          setIsAdmin(adminStatus);
          adminStatusRef.current = adminStatus;
          lastAdminCheckUserIdRef.current = userId;
          return adminStatus;
        } catch (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
          adminStatusRef.current = false;
          lastAdminCheckUserIdRef.current = userId;
          return false;
        } finally {
          adminCheckPromiseRef.current = null;
        }
      })();

      adminCheckPromiseRef.current = promise;
      return promise;
    },
    []
  );

  useEffect(() => {
    let isActive = true;

    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          void checkAdminStatus(currentUser.id, { force: true });
        } else {
          setIsAdmin(false);
          adminStatusRef.current = false;
          lastAdminCheckUserIdRef.current = null;
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (isActive) {
          setUser(null);
          setIsAdmin(false);
          adminStatusRef.current = false;
          lastAdminCheckUserIdRef.current = null;
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const adminCheckEvents: AuthChangeEvent[] = ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'];

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isActive) {
        return;
      }

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser && adminCheckEvents.includes(event)) {
        if (event === 'SIGNED_IN') {
          updateProfile(
            currentUser.id,
            {
              last_sign_in_at: new Date().toISOString(),
            },
            { fallbackUser: currentUser }
          ).catch((error) => {
            console.error('Error updating last sign in time:', error);
          });
        }

        const shouldForceCheck = event === 'SIGNED_IN' || event === 'USER_UPDATED';
        await checkAdminStatus(currentUser.id, { force: shouldForceCheck });
      }

      if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
        adminStatusRef.current = false;
        lastAdminCheckUserIdRef.current = null;
        adminCheckPromiseRef.current = null;
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
      adminCheckPromiseRef.current = null;
    };
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header activeView={activeView} user={user} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{renderActiveView()}</main>
      </div>
    </div>
  );
}
