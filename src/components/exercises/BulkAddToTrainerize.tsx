"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"

interface BulkAddProgress {
  type: 'start' | 'progress' | 'complete' | 'error'
  current?: number
  total?: number
  exercise_name?: string
  percentage?: number
  results?: {
    successful: number
    failed: number
    skipped: number
    duplicates: number
    details?: {
      successful: Array<{ name: string; trainerize_id: string }>
      failed: Array<{ name: string; error: string }>
      skipped: Array<{ name: string; reason: string }>
      duplicates: Array<{ name: string; existing_name: string }>
    }
  }
  message?: string
}

interface BulkAddToTrainerizeProps {
  exerciseIds: string[]
  onComplete?: (results: any) => void
  skipExisting?: boolean
  checkForDuplicates?: boolean
}

export function BulkAddToTrainerize({
  exerciseIds,
  onComplete,
  skipExisting = true,
  checkForDuplicates = true
}: BulkAddToTrainerizeProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<BulkAddProgress | null>(null)
  const [results, setResults] = useState<BulkAddProgress['results'] | null>(null)

  const startBulkAdd = async () => {
    if (exerciseIds.length === 0) return

    setIsRunning(true)
    setProgress(null)
    setResults(null)

    try {
      const response = await fetch('/api/exercises/add', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exerciseIds,
          skipExisting,
          checkForDuplicates
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: BulkAddProgress = JSON.parse(line.slice(6))
              setProgress(data)

              if (data.type === 'complete' && data.results) {
                setResults(data.results)
                onComplete?.(data.results)
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Bulk add error:', error)
      setProgress({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'successful':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'duplicates':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      default:
        return null
    }
  }

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'successful':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800'
      case 'duplicates':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Add to Trainerize</CardTitle>
        <CardDescription>
          Add {exerciseIds.length} exercises to Trainerize
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={startBulkAdd}
            disabled={isRunning || exerciseIds.length === 0}
            className="flex items-center gap-2"
          >
            {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRunning ? 'Adding...' : 'Start Bulk Add'}
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Skip Existing: {skipExisting ? 'Yes' : 'No'}</Badge>
            <Badge variant="outline">Check Duplicates: {checkForDuplicates ? 'Yes' : 'No'}</Badge>
          </div>
        </div>

        {progress && (
          <div className="space-y-3">
            {progress.type === 'start' && (
              <div>
                <p className="text-sm font-medium">Starting bulk operation...</p>
                <Progress value={0} className="mt-2" />
              </div>
            )}

            {progress.type === 'progress' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium">
                    Processing: {progress.exercise_name}
                  </p>
                  <span className="text-sm text-muted-foreground">
                    {progress.current} / {progress.total} ({progress.percentage}%)
                  </span>
                </div>
                <Progress value={progress.percentage} className="mt-2" />
              </div>
            )}

            {progress.type === 'error' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm font-medium text-red-800">Error</p>
                </div>
                <p className="text-sm text-red-700 mt-1">{progress.message}</p>
              </div>
            )}

            {progress.type === 'complete' && progress.message && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <p className="text-sm font-medium text-green-800">Complete</p>
                </div>
                <p className="text-sm text-green-700 mt-1">{progress.message}</p>
              </div>
            )}
          </div>
        )}

        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon('successful')}
                  <div>
                    <p className="text-sm font-medium">Successful</p>
                    <p className="text-lg font-bold text-green-600">{results.successful}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon('failed')}
                  <div>
                    <p className="text-sm font-medium">Failed</p>
                    <p className="text-lg font-bold text-red-600">{results.failed}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon('skipped')}
                  <div>
                    <p className="text-sm font-medium">Skipped</p>
                    <p className="text-lg font-bold text-yellow-600">{results.skipped}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon('duplicates')}
                  <div>
                    <p className="text-sm font-medium">Duplicates</p>
                    <p className="text-lg font-bold text-orange-600">{results.duplicates}</p>
                  </div>
                </div>
              </Card>
            </div>

            {results.details && (
              <div className="space-y-3">
                {results.details.successful.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-800 mb-2">Successfully Added</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {results.details.successful.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded text-sm">
                          <span>{item.name}</span>
                          <Badge className={getStatusColor('successful')}>
                            ID: {item.trainerize_id}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.details.failed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-800 mb-2">Failed</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {results.details.failed.map((item, index) => (
                        <div key={index} className="p-2 bg-red-50 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.name}</span>
                            <Badge className={getStatusColor('failed')}>Failed</Badge>
                          </div>
                          <p className="text-red-600 text-xs mt-1">{item.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.details.skipped.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-2">Skipped</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {results.details.skipped.map((item, index) => (
                        <div key={index} className="p-2 bg-yellow-50 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.name}</span>
                            <Badge className={getStatusColor('skipped')}>Skipped</Badge>
                          </div>
                          <p className="text-yellow-600 text-xs mt-1">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.details.duplicates.length > 0 && (
                  <div>
                    <h4 className="font-medium text-orange-800 mb-2">Duplicates Found</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {results.details.duplicates.map((item, index) => (
                        <div key={index} className="p-2 bg-orange-50 rounded text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.name}</span>
                            <Badge className={getStatusColor('duplicates')}>Duplicate</Badge>
                          </div>
                          <p className="text-orange-600 text-xs mt-1">
                            Similar to: {item.existing_name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}