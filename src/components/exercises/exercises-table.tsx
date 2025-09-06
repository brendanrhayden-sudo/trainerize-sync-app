'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { 
  ChevronDown, 
  ChevronUp, 
  MoreHorizontal, 
  Trash2, 
  Edit2,
  Eye,
  RefreshCw,
  Play,
  Pause
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Exercise } from '@/types'

interface ExercisesTableProps {
  exercises: Exercise[]
  loading: boolean
  onDelete: (id: string) => void
  onBulkOperation: (operation: string, ids: string[]) => void
}

export function ExercisesTable({ exercises, loading, onDelete, onBulkOperation }: ExercisesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns: ColumnDef<Exercise>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Name
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('name')}</div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const category = row.getValue('category') as string
        return category ? (
          <Badge variant="secondary">{category}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: 'muscle_groups',
      header: 'Muscle Groups',
      cell: ({ row }) => {
        const muscleGroups = row.getValue('muscle_groups') as string[]
        return muscleGroups?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {muscleGroups.slice(0, 2).map((group) => (
              <Badge key={group} variant="outline" className="text-xs">
                {group}
              </Badge>
            ))}
            {muscleGroups.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{muscleGroups.length - 2}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: 'difficulty_level',
      header: 'Difficulty',
      cell: ({ row }) => {
        const difficulty = row.getValue('difficulty_level') as string
        const colors = {
          beginner: 'bg-green-100 text-green-800',
          intermediate: 'bg-yellow-100 text-yellow-800',
          advanced: 'bg-red-100 text-red-800',
        }
        
        return difficulty ? (
          <Badge className={colors[difficulty as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
            {difficulty}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: 'sync_status',
      header: 'Sync Status',
      cell: ({ row }) => {
        const status = row.getValue('sync_status') as string
        const colors = {
          synced: 'bg-green-100 text-green-800',
          pending: 'bg-yellow-100 text-yellow-800',
          error: 'bg-red-100 text-red-800',
          deleted: 'bg-gray-100 text-gray-800',
        }
        
        return (
          <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Active',
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean
        return (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2"
          >
            Updated
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue('updated_at'))
        return <div className="text-sm text-muted-foreground">{date.toLocaleDateString()}</div>
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const exercise = row.original
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkOperation('sync', [exercise.id])}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onBulkOperation(exercise.is_active ? 'deactivate' : 'activate', [exercise.id])}
              >
                {exercise.is_active ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(exercise.id)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: exercises,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedIds = selectedRows.map(row => row.original.id)

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} of {table.getFilteredRowModel().rows.length} row(s) selected
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkOperation('activate', selectedIds)}
            >
              <Play className="mr-1 h-3 w-3" />
              Activate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkOperation('deactivate', selectedIds)}
            >
              <Pause className="mr-1 h-3 w-3" />
              Deactivate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkOperation('sync', selectedIds)}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Sync
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkOperation('delete', selectedIds)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No exercises found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}