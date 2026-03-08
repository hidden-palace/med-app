'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Download, 
  Trash2, 
  Archive,
  Eye,
  RefreshCw,
  AlertTriangle,
  User,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { getAllValidationHistory, deleteValidationRecord, archiveValidationRecord } from '@/lib/database';
import { ValidationResults } from '@/components/validator/validation-results';
import type { ValidationHistory, Profile } from '@/lib/supabase';

type ValidationWithUser = ValidationHistory & { 
  profiles: Pick<Profile, 'full_name' | 'email'> | null 
};

interface ReportsOverviewProps {
  onStatsChange?: () => void;
}

export function ReportsOverview({ onStatsChange }: ReportsOverviewProps) {
  const [validations, setValidations] = useState<ValidationWithUser[]>([]);
  const [filteredValidations, setFilteredValidations] = useState<ValidationWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedValidation, setSelectedValidation] = useState<ValidationHistory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed' | 'archived'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

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

  const loadValidations = useCallback(async (shouldNotify = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllValidationHistory(50);
      setValidations(data);
      setSuccess('Validation reports loaded successfully');

      // Notify parent component about stats change
      if (shouldNotify && onStatsChange) {
        onStatsChange();
      }
    } catch (err) {
      console.error('Error loading validations:', err);
      setError('Failed to load validation reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onStatsChange]);

  const filterValidations = useCallback(() => {
    let filtered = validations;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(validation =>
        validation.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        validation.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
        validation.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        validation.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(validation => validation.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(validation => 
        new Date(validation.created_at) >= filterDate
      );
    }

    setFilteredValidations(filtered);
  }, [dateFilter, searchTerm, statusFilter, validations]);

  useEffect(() => {
    loadValidations(false);
  }, [loadValidations]);

  useEffect(() => {
    filterValidations();
  }, [filterValidations]);

  const handleDownloadReport = (validation: ValidationHistory) => {
    // Generate and download PDF report
    const reportContent = generateReportContent(validation);
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-report-${validation.file_name.replace(/\.[^/.]+$/, '')}-${new Date(validation.created_at).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('Report downloaded successfully');
  };

  const generateReportContent = (validation: ValidationHistory): string => {
    const date = new Date(validation.created_at).toLocaleString();
    const overallScore = validation.overall_score || 0;
    const lcdResults = validation.lcd_results || [];
    const recommendations = validation.recommendations || [];
    
    return `
CLINICAL NOTE VALIDATION REPORT
===============================

File: ${validation.file_name}
State/Region: ${validation.state} / ${validation.region}
Validation Date: ${date}
Overall Score: ${overallScore}%
Status: ${validation.status.toUpperCase()}

SUMMARY
-------
${validation.result_summary || validation.compliance_summary || 'Validation completed'}

${Array.isArray(lcdResults) && lcdResults.length > 0 ? `
LCD COMPLIANCE RESULTS
----------------------
${lcdResults.map((lcd: any) => `
LCD ${lcd.lcd || 'Unknown'}: ${(lcd.status || 'unknown').toUpperCase()}
Score: ${lcd.score || 'N/A'}%
Details: ${lcd.details || 'No details available'}
${lcd.missing_elements && lcd.missing_elements.length > 0 ? 
  `Missing Elements: ${lcd.missing_elements.join(', ')}` : ''}
`).join('\n')}
` : ''}

${Array.isArray(recommendations) && recommendations.length > 0 ? `
RECOMMENDATIONS
---------------
${recommendations.map((rec: any, index: number) => `
${index + 1}. ${rec.suggestion || rec.description || rec}
   Category: ${rec.category || 'General'}
   Priority: ${rec.priority || 'Medium'}
`).join('\n')}
` : ''}

---
Report generated by MedLearn Platform
${new Date().toLocaleString()}
    `.trim();
  };

  const handleDeleteValidation = async (validationId: string) => {
    if (!confirm('Are you sure you want to delete this validation report? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(`delete-${validationId}`);
      await deleteValidationRecord(validationId);
      
      // Remove from local state
      setValidations(validations.filter(v => v.id !== validationId));
      setSuccess('Validation report deleted successfully');
      if (onStatsChange) {
        onStatsChange();
      }
    } catch (err) {
      console.error('Error deleting validation:', err);
      setError('Failed to delete validation report.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchiveValidation = async (validationId: string) => {
    try {
      setActionLoading(`archive-${validationId}`);
      await archiveValidationRecord(validationId);
      
      // Update local state
      setValidations(validations.map(v =>
        v.id === validationId
          ? { ...v, status: 'archived' as const }
          : v
      ));
      setSuccess('Validation report archived successfully');
      if (onStatsChange) {
        onStatsChange();
      }
    } catch (err) {
      console.error('Error archiving validation:', err);
      setError('Failed to archive validation report.');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-gray-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const ReportsLoadingSkeleton = () => (
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
                  <Skeleton className="h-3 w-24" />
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
            <h3 className="text-lg font-semibold">Validation Reports</h3>
            <p className="text-sm text-gray-600">View and manage all validation history</p>
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <ReportsLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Validation Reports</h3>
          <p className="text-sm text-gray-600">View and manage all validation history</p>
        </div>
        
        <Button onClick={() => loadValidations(true)} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold">{validations.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {validations.filter(v => v.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600">
                  {validations.filter(v => v.status === 'processing').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {validations.length > 0 
                    ? Math.round((validations.filter(v => v.status === 'completed').length / validations.length) * 100)
                    : 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by filename, state, or user..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {filteredValidations.length} of {validations.length} reports
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
      {/* Validation Reports List */}
      <div className="space-y-4">
        {filteredValidations.map((validation) => (
          <Card key={validation.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    validation.status === 'completed' ? 'bg-green-100' :
                    validation.status === 'processing' ? 'bg-blue-100' :
                    validation.status === 'failed' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    {getStatusIcon(validation.status)}
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">{validation.file_name}</h4>
                      <Badge className={getStatusColor(validation.status)}>
                        {validation.status}
                      </Badge>
                      {validation.overall_score && (
                        <Badge variant="outline" className={
                          validation.overall_score >= 90 ? 'text-green-600 border-green-200' :
                          validation.overall_score >= 70 ? 'text-orange-600 border-orange-200' :
                          'text-red-600 border-red-200'
                        }>
                          Score: {validation.overall_score}%
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>
                          {validation.profiles?.full_name || validation.profiles?.email || 'Unknown User'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span>{validation.state}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(validation.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {validation.result_summary && (
                      <p className="text-sm text-gray-500 mt-1 truncate max-w-md">
                        {validation.result_summary}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* View Details */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedValidation(validation)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Validation Report Details</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[70vh]">
                        {selectedValidation && (
                        <ValidationResults result={selectedValidation} />
                        )}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Download Report */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadReport(validation)}
                    title="Download Report"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                  
                  {/* Archive */}
                  {validation.status !== 'archived' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveValidation(validation.id)}
                      disabled={actionLoading === `archive-${validation.id}`}
                      title="Archive Report"
                    >
                      {actionLoading === `archive-${validation.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1"></div>
                      ) : (
                      <Archive className="w-4 h-4 mr-1" />
                      )}
                      Archive
                    </Button>
                  )}
                  
                  {/* Delete */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteValidation(validation.id)}
                    disabled={actionLoading === `delete-${validation.id}`}
                    className="text-red-600 hover:text-red-700"
                    title="Delete Report"
                  >
                    {actionLoading === `delete-${validation.id}` ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-1"></div>
                    ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredValidations.length === 0 && validations.length > 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No reports match the current filters</p>
              <Button 
                className="mt-4" 
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setDateFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
        
        {validations.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No validation reports found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
