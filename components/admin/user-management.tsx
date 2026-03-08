'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Shield, 
  Key, 
  Smartphone,
  RefreshCw,
  AlertTriangle,
  Search,
  Filter,
  UserPlus,
  CheckCircle,
  XCircle,
  Calendar,
  Mail
} from 'lucide-react';
import { getProfiles, updateProfile, resetUserMFA, resetUserPassword, enforceSingleSession } from '@/lib/database';
import type { Profile } from '@/lib/supabase';

interface UserManagementProps {
  onStatsChange?: () => void;
}

export function UserManagement({ onStatsChange }: UserManagementProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

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

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const profiles = await getProfiles();
      setUsers(profiles);
      setSuccess('Users loaded successfully');
      
      // Notify parent component about stats change
      if (onStatsChange) {
        onStatsChange();
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onStatsChange]);

  const filterUsers = useCallback(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(user => user.is_active === isActive);
    }

    setFilteredUsers(filtered);
  }, [roleFilter, searchTerm, statusFilter, users]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      setActionLoading(`toggle-${userId}`);
      await updateProfile(userId, { is_active: !currentStatus });
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, is_active: !currentStatus }
          : user
      ));
      setSuccess(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      
      // Notify parent component about stats change
      if (onStatsChange) {
        onStatsChange();
      }
    } catch (err) {
      console.error('Error updating user status:', err);
      setError('Failed to update user status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      setActionLoading(`role-${userId}`);
      await updateProfile(userId, { role: newRole });
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, role: newRole }
          : user
      ));
      setSuccess(`User role updated to ${newRole} successfully`);
      
      // Notify parent component about stats change
      if (onStatsChange) {
        onStatsChange();
      }
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('Failed to update user role.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetMFA = async (userId: string) => {
    try {
      setActionLoading(`mfa-${userId}`);
      const result = await resetUserMFA(userId);
      if (result.success) {
        setSuccess('MFA reset successfully');
      } else {
        setError(result.message || 'MFA reset failed');
      }
    } catch (err) {
      console.error('Error resetting MFA:', err);
      setError('Failed to reset MFA');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      setActionLoading(`password-${userId}`);
      const result = await resetUserPassword(userId);
      if (result.success) {
        setSuccess('Password reset email sent');
      } else {
        setError(result.message || 'Password reset failed');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      setError('Failed to reset password');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnforceSingleSession = async (userId: string) => {
    try {
      setActionLoading(`session-${userId}`);
      const result = await enforceSingleSession(userId);
      if (result.success) {
        setSuccess('Single session enforced');
      } else {
        setError(result.message || 'Session enforcement failed');
      }
    } catch (err) {
      console.error('Error enforcing single session:', err);
      setError('Failed to enforce single session');
    } finally {
      setActionLoading(null);
    }
  };

  const UserLoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="flex space-x-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8" />
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
            <h3 className="text-lg font-semibold">User Management</h3>
            <p className="text-sm text-gray-600">Manage user accounts and permissions</p>
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <UserLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">User Management</h3>
          <p className="text-sm text-gray-600">Manage user accounts and permissions</p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={loadUsers} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={(value: 'all' | 'user' | 'admin') => setRoleFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {filteredUsers.length} of {users.length} users
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Active: {users.filter(u => u.is_active).length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Inactive: {users.filter(u => !u.is_active).length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Shield className="w-3 h-3 text-blue-600" />
                <span>Admins: {users.filter(u => u.role === 'admin').length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}
      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    user.role === 'admin' ? 'bg-purple-100' : 'bg-blue-100'
                  }`}>
                    {user.role === 'admin' ? (
                      <Shield className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Users className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {user.full_name || 'No Name'}
                      </h4>
                      <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                        {user.role}
                      </Badge>
                      <Badge variant={user.is_active ? 'secondary' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-600 mb-1">
                      <Mail className="w-3 h-3" />
                      <span>{user.email}</span>
                    </div>
                    {user.last_sign_in_at && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        <span>Last login: {new Date(user.last_sign_in_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Active Status Toggle */}
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm text-gray-600">Active</Label>
                    <Switch
                      checked={user.is_active}
                      onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                      disabled={actionLoading === `toggle-${user.id}`}
                    />
                  </div>
                  
                  {/* Role Toggle */}
                  <Button
                    variant={user.role === 'admin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin')}
                    disabled={actionLoading === `role-${user.id}`}
                  >
                    {actionLoading === `role-${user.id}` ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1"></div>
                    ) : (
                      <Shield className="w-4 h-4 mr-1" />
                    )}
                    {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                  </Button>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetMFA(user.id)}
                      disabled={actionLoading === `mfa-${user.id}`}
                      title="Reset MFA"
                    >
                      {actionLoading === `mfa-${user.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                      <Smartphone className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(user.id)}
                      disabled={actionLoading === `password-${user.id}`}
                      title="Reset Password"
                    >
                      {actionLoading === `password-${user.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                      <Key className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEnforceSingleSession(user.id)}
                      disabled={actionLoading === `session-${user.id}`}
                      title="Enforce Single Session"
                    >
                      {actionLoading === `session-${user.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                      <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredUsers.length === 0 && users.length > 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No users match the current filters</p>
              <Button 
                className="mt-4" 
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
        
        {users.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No users found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}