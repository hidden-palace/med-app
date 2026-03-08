'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  File as FileIcon, 
  Loader2,
  CheckCircle 
} from 'lucide-react';

interface NoteUploadProps {
  onFileUpload: (file: File, textContent?: string) => Promise<void>;
  isValidating: boolean;
  disabled: boolean;
}

export function NoteUpload({ onFileUpload, isValidating, disabled }: NoteUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF or DOCX file.');
      return;
    }
    
    setUploadedFile(file);
  };

  const handleTextSubmit = async () => {
    if (!textContent.trim()) {
      alert('Please enter text content to validate.');
      return;
    }
    
    // Create a mock file from text content
    const blob = new Blob([textContent], { type: 'text/plain' });
    const file = new File([blob], 'pasted-text.txt', { type: 'text/plain' });
    
    await onFileUpload(file, textContent);
  };

  const handleFileSubmit = async () => {
    if (!uploadedFile) {
      alert('Please select a file first.');
      return;
    }
    
    await onFileUpload(uploadedFile);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="w-5 h-5 text-blue-600" />
          <span>Upload Clinical Note</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <FileIcon className="w-4 h-4" />
              <span>Upload File</span>
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Paste Text</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={disabled}
              />
              
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    Drop your file here, or click to browse
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Supports PDF, DOCX files up to 10MB
                  </p>
                </div>
                
                {uploadedFile && (
                  <div className="flex items-center justify-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">{uploadedFile.name}</span>
                  </div>
                )}
              </div>
            </div>
            
            {uploadedFile && (
              <Button 
                onClick={handleFileSubmit}
                disabled={isValidating || disabled}
                className="w-full"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate File'
                )}
              </Button>
            )}
          </TabsContent>
          
          <TabsContent value="text" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste Clinical Note Text
              </label>
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste your clinical note content here..."
                rows={8}
                disabled={disabled}
              />
            </div>
            
            <Button 
              onClick={handleTextSubmit}
              disabled={isValidating || disabled || !textContent.trim()}
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}