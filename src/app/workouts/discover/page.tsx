'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Play, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Database,
  Zap
} from 'lucide-react';

export default function WorkoutDiscoveryPage() {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [testId, setTestId] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const startDiscovery = async () => {
    setIsDiscovering(true);
    setLogs(['🔍 Starting discovery process...']);
    setResults(null);
    
    try {
      const response = await fetch('/api/workouts/discover', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.report);
        setLogs(prev => [...prev, '✅ Discovery complete!', `📊 Found ${data.report.totalTemplates} templates`]);
      } else {
        throw new Error(data.error || 'Discovery failed');
      }
      
    } catch (error: any) {
      setLogs(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const testSpecificTemplate = async () => {
    if (!testId) return;
    
    setIsTesting(true);
    setTestResult(null);
    setLogs(prev => [...prev, `🧪 Testing template ID: ${testId}`]);
    
    try {
      const response = await fetch('/api/workouts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: testId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResult(data.results);
        setLogs(prev => [...prev, '✅ Test complete']);
      } else {
        throw new Error(data.error || 'Test failed');
      }
      
    } catch (error: any) {
      setLogs(prev => [...prev, `❌ Test failed: ${error.message}`]);
    } finally {
      setIsTesting(false);
    }
  };

  const exportFindings = () => {
    if (!results) return;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      discoveryResults: results,
      testResults: testResult
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-discovery-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setLogs(prev => [...prev, '💾 Exported findings to JSON file']);
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Workout Template Discovery</h1>
        <p className="text-muted-foreground">
          Analyze Trainerize workout templates and decode their data structures
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Discovery Controls
              </CardTitle>
              <CardDescription>
                Analyze workout templates from the Trainerize API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={startDiscovery}
                disabled={isDiscovering}
                className="w-full flex items-center gap-2"
                size="lg"
              >
                {isDiscovering ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isDiscovering ? 'Discovering...' : 'Start Discovery'}
              </Button>
              
              {isDiscovering && (
                <div className="space-y-2">
                  <Progress value={33} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    Analyzing template structures...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Test Specific Template
              </CardTitle>
              <CardDescription>
                Deep-dive analysis of a specific template ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="testId">Template ID</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="testId"
                    type="text"
                    value={testId}
                    onChange={(e) => setTestId(e.target.value)}
                    placeholder="Enter template ID"
                    className="flex-1"
                  />
                  <Button
                    onClick={testSpecificTemplate}
                    disabled={!testId || isTesting}
                    className="flex items-center gap-2"
                  >
                    {isTesting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Discovery Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-gray-500">Logs will appear here...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="mb-1">
                      [{new Date().toLocaleTimeString()}] {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Results */}
        <div className="space-y-4">
          {results && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Discovery Results
                    <Button 
                      onClick={exportFindings} 
                      size="sm" 
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {results.totalTemplates}
                      </div>
                      <div className="text-sm text-blue-800">Templates Found</div>
                    </div>
                    
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {results.structure?.commonFields?.length || 0}
                      </div>
                      <div className="text-sm text-green-800">Common Fields</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Integer Array Fields</h4>
                    <div className="space-y-2">
                      {results.structure?.integerArrayFields?.map((field: string) => (
                        <div key={field} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-mono text-sm">{field}</span>
                          <div className="flex gap-1">
                            {results.integerArrayPatterns?.[field]?.possibleMeanings?.slice(0, 2).map((meaning: string) => (
                              <Badge key={meaning} variant="secondary" className="text-xs">
                                {meaning}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Field Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto">
                    <pre className="text-xs bg-gray-50 p-3 rounded">
                      {JSON.stringify(results.structure?.fieldTypes, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
              
              {results.investigations && (
                <Card>
                  <CardHeader>
                    <CardTitle>API Investigations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(results.investigations).map(([key, investigation]: [string, any]) => (
                      <div key={key} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{key}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {investigation.conclusion}
                          </span>
                        </div>
                        {investigation.resultsFound !== undefined && (
                          <p className="text-sm">Results found: {investigation.resultsFound}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
          
          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle>Template Test Results</CardTitle>
                <CardDescription>
                  Testing template ID: {testResult.templateId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Test Summary</h4>
                  <div className="space-y-1">
                    {testResult.tests?.map((test: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {getStatusIcon(test.success)}
                        <span className={test.success ? 'text-green-700' : 'text-red-700'}>
                          {test.test}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {testResult.decodedData?.exerciseDetails && (
                  <div>
                    <h4 className="font-medium mb-2">Decoded Exercise IDs</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {testResult.decodedData.exerciseDetails.map((exercise: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                          <span>{exercise.name}</span>
                          <Badge variant="outline">ID: {exercise.id}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {testResult.errors?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      Errors
                    </h4>
                    <div className="space-y-1">
                      {testResult.errors.map((error: string, i: number) => (
                        <p key={i} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Recommendations */}
      {results?.recommendations && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Data Model</h4>
                <div className="space-y-1">
                  {Object.entries(results.recommendations.dataModel || {}).map(([key, value]: [string, any]) => (
                    <p key={key} className="text-sm">
                      <code className="bg-gray-100 px-1 rounded">{key}</code>: {value}
                    </p>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Next Steps</h4>
                <div className="space-y-1">
                  {results.recommendations.suggestions?.map((suggestion: string, i: number) => (
                    <p key={i} className="text-sm flex items-start gap-2">
                      <span className="text-blue-500 mt-1">→</span>
                      <span>{suggestion}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
            
            {results.recommendations.warnings?.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                <div className="space-y-1">
                  {results.recommendations.warnings.map((warning: string, i: number) => (
                    <p key={i} className="text-sm text-yellow-700">⚠️ {warning}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}