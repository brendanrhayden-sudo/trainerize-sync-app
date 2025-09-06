'use client'

import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PaginationState } from '@/types'

interface ExercisesPaginationProps {
  pagination: PaginationState
  total: number
  totalPages: number
  onPaginationChange: (pagination: Partial<PaginationState>) => void
}

export function ExercisesPagination({ 
  pagination, 
  total, 
  totalPages, 
  onPaginationChange 
}: ExercisesPaginationProps) {
  const { pageIndex, pageSize } = pagination
  const currentPage = pageIndex + 1
  
  const startItem = pageIndex * pageSize + 1
  const endItem = Math.min((pageIndex + 1) * pageSize, total)

  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex < totalPages - 1

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              onPaginationChange({
                pageSize: Number(value),
                pageIndex: 0,
              })
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {currentPage} of {Math.max(totalPages, 1)}
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {startItem} to {endItem} of {total} results
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => onPaginationChange({ pageIndex: 0 })}
          disabled={!canPreviousPage}
        >
          <span className="sr-only">Go to first page</span>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => onPaginationChange({ pageIndex: pageIndex - 1 })}
          disabled={!canPreviousPage}
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => onPaginationChange({ pageIndex: pageIndex + 1 })}
          disabled={!canNextPage}
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="hidden h-8 w-8 p-0 lg:flex"
          onClick={() => onPaginationChange({ pageIndex: totalPages - 1 })}
          disabled={!canNextPage}
        >
          <span className="sr-only">Go to last page</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}