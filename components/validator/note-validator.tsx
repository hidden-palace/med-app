'use client';

import { useState, useEffect, useCallback } from 'react';
import { NoteUpload } from './note-upload';
import { ValidationResults } from './validation-results';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileCheck, Clock, AlertTriangle, Ruler, Calculator } from 'lucide-react';
import {
  createValidationRecord,
  getValidationHistory,
  addRecentActivity,
  updateValidationResult,
} from '@/lib/database';
import { sendToN8N, sendToN8NSize } from '@/lib/n8n-client';
import { supabase } from '@/lib/supabase';
import type { ValidationHistory } from '@/lib/supabase';

interface NoteValidatorProps {
  userId: string | null;
}

const TEXAS_STATE = 'Texas';
const TEXAS_REGION = 'Texas LCD';
const DEFAULT_NOTE_NAME = 'clinical-note.txt';
const DEFAULT_NOTE_TYPE = 'text/plain';
const TEXAS_LCD_PROMPT =
  'Is this compliant based on Texas wound care skin substitute LCD?';


export function NoteValidator({ userId }: NoteValidatorProps) {
  const [validationResults, setValidationResults] = useState<ValidationHistory | null>(null);
  const [isNoteValidating, setIsNoteValidating] = useState(false);
  const [isSizeValidating, setIsSizeValidating] = useState(false);
  const [recentValidations, setRecentValidations] = useState<ValidationHistory[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sizeInputs, setSizeInputs] = useState({
    week1: { length: '', width: '', depth: '' },
    week2: { length: '', width: '', depth: '' },
  });


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
    setIsNoteValidating(true);

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
      pollForResults(validationRecord.id, () => setIsNoteValidating(false));
    } catch (error) {
      console.error('Error starting validation:', error);
      setIsNoteValidating(false);
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

  const pollForResults = async (validationId: string, onDone?: () => void) => {
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
          onDone?.();
          setErrorMessage('Unable to retrieve validation results.');
          return;
        }

        if (validationRecord.status === 'completed' || validationRecord.status === 'failed') {
          setValidationResults(validationRecord);
          onDone?.();
          await loadRecentValidations();
          return;
        }

        if (validationRecord.status === 'processing' && attempts < maxAttempts) {
          setTimeout(poll, 10000);
        } else if (attempts >= maxAttempts) {
          console.warn('Validation polling timeout');
          onDone?.();
          setErrorMessage('Validation is taking longer than expected. Please try again later.');
        }
      } catch (error) {
        console.error('Error polling for results:', error);
        onDone?.();
        setErrorMessage('Error while checking validation status.');
      }
    };

    setTimeout(poll, 5000);
  };

  const parseMeasurement = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
  };

  const handleSizeValidation = async () => {
    if (!userId) {
      setErrorMessage('You need to sign in before validating wound size changes.');
      return;
    }

    const l1 = parseMeasurement(sizeInputs.week1.length);
    const w1 = parseMeasurement(sizeInputs.week1.width);
    const d1 = parseMeasurement(sizeInputs.week1.depth);
    const l2 = parseMeasurement(sizeInputs.week2.length);
    const w2 = parseMeasurement(sizeInputs.week2.width);
    const d2 = parseMeasurement(sizeInputs.week2.depth);

    const hasInvalid =
      [l1, w1, d1, l2, w2, d2].some((value) => Number.isNaN(value)) ||
      [
        sizeInputs.week1.length,
        sizeInputs.week1.width,
        sizeInputs.week1.depth,
        sizeInputs.week2.length,
        sizeInputs.week2.width,
        sizeInputs.week2.depth,
      ].some((value) => value.trim().length === 0);

    if (hasInvalid) {
      setErrorMessage('Please enter numeric measurements for both weeks (L x W x D).');
      return;
    }

    if (l1 <= 0 || w1 <= 0) {
      setErrorMessage('Week 1 length and width must be greater than 0 to calculate change.');
      return;
    }

    setErrorMessage(null);
    setIsSizeValidating(true);

    const week1Area = l1 * w1;
    const week2Area = l2 * w2;
    const percentChange = ((week2Area - week1Area) / week1Area) * 100;

    const summaryContent = [
      `Week 1 (cm): L ${l1} x W ${w1} x D ${d1}`,
      `Week 2 (cm): L ${l2} x W ${w2} x D ${d2}`,
      'Calculate percentage area change.',
    ].join('\n');

    let validationRecord: ValidationHistory | null = null;

    try {
      validationRecord = await createValidationRecord(
        userId,
        'wound-size-change.json',
        'application/json',
        'N/A',
        'Size Calculator'
      );
      console.log('Wound size validation record created:', validationRecord.id);

      await sendToN8NSize({
        validationId: validationRecord.id,
        fileName: 'wound-size-change.json',
        fileType: 'application/json',
        content: summaryContent,
        state: 'N/A',
        region: 'Size Calculator',
        userId,
        metadata: {
          measurements: {
            week1: { length: l1, width: w1, depth: d1 },
            week2: { length: l2, width: w2, depth: d2 },
          },
          calculated: {
            week1Area,
            week2Area,
            percentChange,
          },
        },
      });

      await addRecentActivity(
        userId,
        'note_validated',
        'Wound size change calculator',
        'Validation started using wound size calculator'
      );

      pollForResults(validationRecord.id, () => setIsSizeValidating(false));
    } catch (error) {
      console.error('Error starting wound size validation:', error);
      setIsSizeValidating(false);
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';

      if (validationRecord) {
        try {
          const failedRecord = await updateValidationResult(
            validationRecord.id,
            'failed',
            'Wound size validation failed to start.',
            { error: message }
          );

          if (failedRecord) {
            setValidationResults(failedRecord);
          }
        } catch (updateError) {
          console.error('Error marking wound size validation as failed:', updateError);
        }
      }

      setErrorMessage(`Error starting wound size validation: ${message}`);
      await loadRecentValidations();
    }
  };

  const canSubmitSize = [
    sizeInputs.week1.length,
    sizeInputs.week1.width,
    sizeInputs.week1.depth,
    sizeInputs.week2.length,
    sizeInputs.week2.width,
    sizeInputs.week2.depth,
  ].every((value) => value.trim().length > 0);

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
        isValidating={isNoteValidating}
      />

      {/* Wound Size Change Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <span>Change in Wound Size Calculator</span>
          </CardTitle>
          <p className="text-sm text-gray-500">
            Enter measurements from two different weeks (L x W x D) in centimeters. Most strict
            criteria (Texas) applied to every submission.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Ruler className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-800">Week 1 Measurements</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="week1-length">Length (cm)</Label>
                  <Input
                    id="week1-length"
                    type="number"
                    min="0"
                    step="0.1"
                    value={sizeInputs.week1.length}
                    onChange={(e) =>
                      setSizeInputs((prev) => ({
                        ...prev,
                        week1: { ...prev.week1, length: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="week1-width">Width (cm)</Label>
                  <Input
                    id="week1-width"
                    type="number"
                    min="0"
                    step="0.1"
                    value={sizeInputs.week1.width}
                    onChange={(e) =>
                      setSizeInputs((prev) => ({
                        ...prev,
                        week1: { ...prev.week1, width: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="week1-depth">Depth (cm)</Label>
                  <Input
                    id="week1-depth"
                    type="number"
                    min="0"
                    step="0.1"
                    value={sizeInputs.week1.depth}
                    onChange={(e) =>
                      setSizeInputs((prev) => ({
                        ...prev,
                        week1: { ...prev.week1, depth: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Ruler className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-gray-800">Week 2 Measurements</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="week2-length">Length (cm)</Label>
                  <Input
                    id="week2-length"
                    type="number"
                    min="0"
                    step="0.1"
                    value={sizeInputs.week2.length}
                    onChange={(e) =>
                      setSizeInputs((prev) => ({
                        ...prev,
                        week2: { ...prev.week2, length: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="week2-width">Width (cm)</Label>
                  <Input
                    id="week2-width"
                    type="number"
                    min="0"
                    step="0.1"
                    value={sizeInputs.week2.width}
                    onChange={(e) =>
                      setSizeInputs((prev) => ({
                        ...prev,
                        week2: { ...prev.week2, width: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="week2-depth">Depth (cm)</Label>
                  <Input
                    id="week2-depth"
                    type="number"
                    min="0"
                    step="0.1"
                    value={sizeInputs.week2.depth}
                    onChange={(e) =>
                      setSizeInputs((prev) => ({
                        ...prev,
                        week2: { ...prev.week2, depth: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSizeValidation} disabled={isSizeValidating || !canSubmitSize}>
              {isSizeValidating ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Calculating...
                </>
              ) : (
                'Validate Wound Size Change'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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

