'use client';

import { useState, useEffect, useCallback } from 'react';
import { NoteUpload } from './note-upload';
import { ValidationResults } from './validation-results';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, FileCheck, Clock, AlertTriangle } from 'lucide-react';
import { createValidationRecord, getValidationHistory, addRecentActivity, uploadValidationFile } from '@/lib/database';
import { sendToN8N } from '@/lib/n8n-client';
import { supabase } from '@/lib/supabase';
import type { ValidationHistory } from '@/lib/supabase';

interface NoteValidatorProps {
  userId: string | null;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const STATE_TO_REGION: Record<string, string> = {
  'California': 'West',
  'Oregon': 'West',
  'Washington': 'West',
  'Nevada': 'West',
  'Arizona': 'Southwest',
  'Texas': 'Southwest',
  'New Mexico': 'Southwest',
  'Colorado': 'Southwest',
  'Florida': 'Southeast',
  'Georgia': 'Southeast',
  'North Carolina': 'Southeast',
  'South Carolina': 'Southeast',
  'Virginia': 'Southeast',
  'Tennessee': 'Southeast',
  'Kentucky': 'Southeast',
  'Alabama': 'Southeast',
  'Mississippi': 'Southeast',
  'Louisiana': 'Southeast',
  'Arkansas': 'Southeast',
  'Illinois': 'Midwest',
  'Indiana': 'Midwest',
  'Iowa': 'Midwest',
  'Kansas': 'Midwest',
  'Michigan': 'Midwest',
  'Minnesota': 'Midwest',
  'Missouri': 'Midwest',
  'Nebraska': 'Midwest',
  'North Dakota': 'Midwest',
  'Ohio': 'Midwest',
  'South Dakota': 'Midwest',
  'Wisconsin': 'Midwest',
  'New York': 'Northeast',
  'Pennsylvania': 'Northeast',
  'New Jersey': 'Northeast',
  'Connecticut': 'Northeast',
  'Massachusetts': 'Northeast',
  'Rhode Island': 'Northeast',
  'Vermont': 'Northeast',
  'New Hampshire': 'Northeast',
  'Maine': 'Northeast',
  'Maryland': 'Northeast',
  'Delaware': 'Northeast',
  'West Virginia': 'Northeast'
};

export function NoteValidator({ userId }: NoteValidatorProps) {
  const [selectedState, setSelectedState] = useState<string>('');
  const [validationResults, setValidationResults] = useState<ValidationHistory | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [recentValidations, setRecentValidations] = useState<ValidationHistory[]>([]);
  
  const loadRecentValidations = useCallback(async () => {
    try {
      // Skip loading if no authenticated user
      if (!userId) {
        // Set mock data for demo
        setRecentValidations([
          {
            id: '1',
            user_id: 'demo',
            file_name: 'patient_note_001.pdf',
            file_type: 'application/pdf',
            state: 'California',
            region: 'West',
            status: 'completed',
            result_summary: 'Validation completed successfully',
            result_details: { score: 92, sections: [], warnings: [] },
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        ]);
        return;
      }

      const history = await getValidationHistory(userId, 5);
      setRecentValidations(history);
    } catch (error) {
      console.error('Error loading validation history:', error);
    }
  }, [userId]);

  useEffect(() => {
    loadRecentValidations();
  }, [loadRecentValidations]);

  const handleFileUpload = async (file: File, textContent?: string) => {
    if (!selectedState) {
      alert('Please select a state first');
      return;
    }

    if (!userId) {
      alert('Demo mode: File validation is not available without authentication');
      return;
    }

    setIsValidating(true);
    console.log('Starting file upload process...', {
      fileName: file.name,
      fileType: file.type,
      selectedState,
      hasTextContent: !!textContent
    });
    
    try {
      const region = getRegionForState(selectedState);
      
      let uploadedFileUrl: string | undefined;
      let content: string;
      
      // Handle file upload vs text content
      if (file && !textContent) {
        // File was uploaded - upload to Supabase Storage first
        console.log('Uploading file to Supabase Storage...');
        uploadedFileUrl = await uploadValidationFile(userId, file, file.name);
        console.log('File uploaded successfully:', uploadedFileUrl);
        content = 'FILE_UPLOAD_URL_PROVIDED';
      } else {
        // Text was pasted directly
        console.log('Using pasted text content');
        content = textContent || '';
      }
      
      // Create validation record in database
      console.log('Creating validation record in database...');
      const validationRecord = await createValidationRecord(
        userId,
        file.name,
        file.type,
        selectedState,
        region,
        uploadedFileUrl
      );
      console.log('Validation record created:', validationRecord.id);
      
      // Send to N8N for processing
      console.log('Sending to N8N for processing...');
      const n8nResponse = await sendToN8N({
        validationId: validationRecord.id,
        fileName: file.name,
        fileType: file.type,
        content,
        state: selectedState,
        region,
        userId,
        fileUrl: uploadedFileUrl
      });
      console.log('N8N response received:', n8nResponse);
      
      // Add to recent activity
      console.log('Adding to recent activity...');
      await addRecentActivity(
        userId,
        'note_validated',
        file.name,
        `Validation started for ${selectedState}`
      );
      
      // Poll for results (in real app, use webhooks)
      console.log('Starting polling for results...');
      pollForResults(validationRecord.id);
      
    } catch (error) {
      console.error('Error starting validation:', error);
      setIsValidating(false);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert(`Error starting validation: ${errorMessage}. Please check the console for more details.`);
    }
  };
  
  const pollForResults = async (validationId: string) => {
    const maxAttempts = 30; // Poll for up to 5 minutes (30 attempts * 10 seconds)
    let attempts = 0;
    
    const poll = async () => {
      try {
        attempts++;
        
        // Fetch the validation record from Supabase
        const { data: validationRecord, error } = await supabase
          .from('validation_history')
          .select('*')
          .eq('id', validationId)
          .single();
        
        if (error) {
          console.error('Error fetching validation record:', error);
          setIsValidating(false);
          return;
        }
        
        // Check if validation is complete
        if (validationRecord.status === 'completed' || validationRecord.status === 'failed') {
          setValidationResults(validationRecord);
          setIsValidating(false);
          loadRecentValidations();
          return;
        }
        
        // Continue polling if still processing and haven't exceeded max attempts
        if (validationRecord.status === 'processing' && attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else if (attempts >= maxAttempts) {
          // Timeout - validation is taking too long
          console.warn('Validation polling timeout');
          setIsValidating(false);
        }
        
      } catch (error) {
        console.error('Error polling for results:', error);
        setIsValidating(false);
      }
    };
    
    // Start polling after a short delay
    setTimeout(poll, 5000);
  };

  const getRegionForState = (state: string): string => {
    return STATE_TO_REGION[state] || 'Unknown';
  };


  return (
    <div className="space-y-6">
      {/* State Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>State Selection</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select State for Validation
              </label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a state..." />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedState && (
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                <div className="text-sm font-medium text-blue-900">Selected Region</div>
                <div className="text-blue-700 mt-1">{getRegionForState(selectedState)}</div>
                <div className="text-xs text-blue-600 mt-2 hidden sm:block">
                  Validation rules will be applied based on {selectedState} regulations
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <NoteUpload 
        onFileUpload={handleFileUpload}
        isValidating={isValidating}
        disabled={!selectedState}
      />

      {/* Validation Results */}
      {validationResults && (
        <ValidationResults result={validationResults} />
      )}

      {/* Recent Validations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <span>Recent Validations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentValidations.map((validation) => (
              <div 
                key={validation.id} 
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setValidationResults(validation)}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {validation.status === 'completed' ? (
                      <FileCheck className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    )}
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-900">{validation.file_name}</div>
                    <div className="text-sm text-gray-500">
                      {validation.state} • {new Date(validation.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant={validation.status === 'completed' ? 'secondary' : 'outline'}>
                    {validation.status === 'completed' ? 'Completed' : validation.status}
                  </Badge>
                  {validation.status === 'completed' && (
                    <span className="text-xs text-gray-400">Click to view</span>
                  )}
                </div>
              </div>
            ))}
          
            {recentValidations.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No validation history yet</p>
                <p className="text-sm">Upload a note to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}