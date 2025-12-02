'use client';

import { useState, useEffect, useCallback } from 'react';
import { NoteUpload } from './note-upload';
import { ValidationResults } from './validation-results';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Clock, AlertTriangle } from 'lucide-react';
import { createValidationRecord, getValidationHistory, addRecentActivity, updateValidationResult } from '@/lib/database';
import { sendToN8N } from '@/lib/n8n-client';
import { supabase } from '@/lib/supabase';
import type { ValidationHistory } from '@/lib/supabase';

interface NoteValidatorProps {
  userId: string | null;
}

const TEXAS_STATE = 'Texas';
const TEXAS_REGION = 'Texas LCD';
const DEFAULT_NOTE_NAME = 'clinical-note.txt';
const DEFAULT_NOTE_TYPE = 'text/plain';
const TEXAS_LCD_PROMPT = 'Is this compliant based on Texas wound care skin substitute LCD?';


export function NoteValidator({ userId }: NoteValidatorProps) {
  const [validationResults, setValidationResults] = useState<ValidationHistory | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [recentValidations, setRecentValidations] = useState<ValidationHistory[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const loadRecentValidations = useCallback(async () => {
    try {
      if (!userId) {
        setErrorMessage(null);
        setRecentValidations([
          {
            id: '1',
            user_id: 'demo',
            file_name: 'patient_note_001.txt',
            file_type: 'text/plain',
            state: TEXAS_STATE,
            region: TEXAS_REGION,
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
      setErrorMessage(null);
    } catch (error) {
      console.error('Error loading validation history:', error);
      setErrorMessage('Unable to load validation history.');
    }
  }, [userId]);

  useEffect(() => {
    loadRecentValidations();
  }, [loadRecentValidations]);

  const handleTextValidation = async (textContent: string) => {
    const noteContent = textContent.trim();

    if (!noteContent) {
      setErrorMessage('Please paste the clinical note text before validating.');
      return;
    }

    if (!userId) {
      setErrorMessage('You need to sign in before validating notes.');
      return;
    }

    setErrorMessage(null);
    setIsValidating(true);

    let validationRecord: ValidationHistory | null = null;
    const fileName = DEFAULT_NOTE_NAME;
    const fileType = DEFAULT_NOTE_TYPE;

    try {
      validationRecord = await createValidationRecord(
        userId,
        fileName,
        fileType,
        TEXAS_STATE,
        TEXAS_REGION
      );
      console.log('Validation record created:', validationRecord.id);

      console.log('Sending to N8N for processing with Texas LCD prompt...');
      const n8nResponse = await sendToN8N({
        validationId: validationRecord.id,
        fileName,
        fileType,
        content: noteContent,
        state: TEXAS_STATE,
        region: TEXAS_REGION,
        userId,
        prompt: TEXAS_LCD_PROMPT
      });
      console.log('N8N response received:', n8nResponse);

      console.log('Adding to recent activity...');
      await addRecentActivity(
        userId,
        'note_validated',
        fileName,
        'Validation started using Texas LCD criteria'
      );

      console.log('Starting polling for results...');
      pollForResults(validationRecord.id);
    } catch (error) {
      console.error('Error starting validation:', error);
      setIsValidating(false);
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';

      if (validationRecord) {
        try {
          const failedRecord = await updateValidationResult(
            validationRecord.id,
            'failed',
            'Validation failed to start.',
            { error: message }
          );

          if (failedRecord) {
            setValidationResults(failedRecord);
          }
        } catch (updateError) {
          console.error('Error marking validation as failed:', updateError);
        }
      }

      setErrorMessage(`Error starting validation: ${message}`);
      await loadRecentValidations();
    }
  };

  const pollForResults = async (validationId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;

        const { data: validationRecord, error } = await supabase
          .from('validation_history')
          .select('*')
          .eq('id', validationId)
          .single();

        if (error) {
          console.error('Error fetching validation record:', error);
          setIsValidating(false);
          setErrorMessage('Unable to retrieve validation results.');
          return;
        }

        if (validationRecord.status === 'completed' || validationRecord.status === 'failed') {
          setValidationResults(validationRecord);
          setIsValidating(false);
          await loadRecentValidations();
          return;
        }

        if (validationRecord.status === 'processing' && attempts < maxAttempts) {
          setTimeout(poll, 10000);
        } else if (attempts >= maxAttempts) {
          console.warn('Validation polling timeout');
          setIsValidating(false);
          setErrorMessage('Validation is taking longer than expected. Please try again later.');
        }
      } catch (error) {
        console.error('Error polling for results:', error);
        setIsValidating(false);
        setErrorMessage('Error while checking validation status.');
      }
    };

    setTimeout(poll, 5000);
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  )}

      {/* Note Submission */}
      <NoteUpload
        onSubmitText={handleTextValidation}
        isValidating={isValidating}
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
                      {validation.state} - {new Date(validation.created_at).toLocaleDateString()}
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

