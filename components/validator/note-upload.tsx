'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Loader2
} from 'lucide-react';

interface NoteUploadProps {
  onSubmitText: (textContent: string) => Promise<void>;
  isValidating: boolean;
}

export function NoteUpload({ onSubmitText, isValidating }: NoteUploadProps) {
  const [textContent, setTextContent] = useState('');

  const handleTextSubmit = async () => {
    if (!textContent.trim()) {
      alert('Please enter text content to validate.');
      return;
    }
    
    await onSubmitText(textContent);
  };

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Paste Clinical Note Text</span>
          </CardTitle>
          <p className="text-sm text-gray-500">
            Most strict criteria (Texas) applied to every submission.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste Clinical Note Text
            </label>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste your clinical note content here..."
              rows={10}
            />
          </div>
          
          <Button 
            onClick={handleTextSubmit}
            disabled={isValidating || !textContent.trim()}
            className="w-full"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              'Validate Text'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
