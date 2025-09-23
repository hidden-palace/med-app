'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  Settings, 
  Save,
  Upload,
  Download
} from 'lucide-react';

interface StateMapping {
  state: string;
  region: string;
  rulesVersion: string;
  lastUpdated: Date;
}

export function ValidatorSettings() {
  const [stateMappings, setStateMappings] = useState<StateMapping[]>([
    { state: 'California', region: 'West', rulesVersion: 'v2.1', lastUpdated: new Date('2024-02-01') },
    { state: 'Texas', region: 'Southwest', rulesVersion: 'v2.0', lastUpdated: new Date('2024-01-15') },
    { state: 'New York', region: 'Northeast', rulesVersion: 'v2.1', lastUpdated: new Date('2024-02-01') },
    { state: 'Florida', region: 'Southeast', rulesVersion: 'v1.9', lastUpdated: new Date('2024-01-01') },
    { state: 'Illinois', region: 'Midwest', rulesVersion: 'v2.0', lastUpdated: new Date('2024-01-20') }
  ]);

  const regions = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'Northwest'];

  const handleUpdateMapping = (state: string, newRegion: string) => {
    setStateMappings(mappings =>
      mappings.map(mapping =>
        mapping.state === state
          ? { ...mapping, region: newRegion, lastUpdated: new Date() }
          : mapping
      )
    );
  };

  const validationHistory = [
    { date: '2024-02-15', validations: 89, successRate: 94, avgTime: '2.3s' },
    { date: '2024-02-14', validations: 76, successRate: 96, avgTime: '2.1s' },
    { date: '2024-02-13', validations: 92, successRate: 93, avgTime: '2.4s' },
    { date: '2024-02-12', validations: 68, successRate: 97, avgTime: '2.0s' },
    { date: '2024-02-11', validations: 81, successRate: 95, avgTime: '2.2s' }
  ];

  return (
    <div className="space-y-6">
      {/* State-Region Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>State to Region Mapping</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-medium text-sm text-gray-600 pb-2 border-b">
              <span>State</span>
              <span>Region</span>
              <span>Rules Version</span>
              <span>Last Updated</span>
            </div>
            
            {stateMappings.map((mapping) => (
              <div key={mapping.state} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <span className="font-medium">{mapping.state}</span>
                
                <Select
                  value={mapping.region}
                  onValueChange={(value) => handleUpdateMapping(mapping.state, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Badge variant="outline">{mapping.rulesVersion}</Badge>
                
                <span className="text-sm text-gray-500">
                  {mapping.lastUpdated.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex space-x-2">
            <Button>
              <Save className="w-4 h-4 mr-2" />
              Save Mappings
            </Button>
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Upload Rules
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Validation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-green-600" />
            <span>Validation Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max File Size (MB)
              </label>
              <Input type="number" defaultValue="10" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Validation Timeout (seconds)
              </label>
              <Input type="number" defaultValue="30" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supported File Types
              </label>
              <Input defaultValue="PDF, DOCX, DOC" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LLM Model
              </label>
              <Select defaultValue="gpt-4">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-3.5">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude">Claude-3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Validation History */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Validation History</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 font-medium text-sm text-gray-600 pb-2 border-b">
              <span>Date</span>
              <span>Validations</span>
              <span>Success Rate</span>
              <span>Avg Time</span>
            </div>
            
            {validationHistory.map((record, index) => (
              <div key={index} className="grid grid-cols-4 gap-4 text-sm">
                <span>{record.date}</span>
                <span>{record.validations}</span>
                <span className="text-green-600">{record.successRate}%</span>
                <span>{record.avgTime}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}