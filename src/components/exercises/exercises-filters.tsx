'use client'

import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { FilterState } from '@/types'

interface ExercisesFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: Partial<FilterState>) => void
  onReset: () => void
}

const categories = [
  'Cardio',
  'Strength',
  'Flexibility',
  'Balance',
  'Core',
  'Upper Body',
  'Lower Body',
  'Full Body'
]

const muscleGroups = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Core',
  'Glutes',
  'Legs',
  'Calves'
]

const equipment = [
  'Bodyweight',
  'Dumbbells',
  'Barbell',
  'Resistance Bands',
  'Cable Machine',
  'Pull-up Bar',
  'Kettlebell',
  'Medicine Ball'
]

const difficultyLevels = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' }
]

const syncStatuses = [
  { value: 'synced', label: 'Synced' },
  { value: 'pending', label: 'Pending' },
  { value: 'error', label: 'Error' },
  { value: 'deleted', label: 'Deleted' }
]

export function ExercisesFilters({ filters, onFiltersChange, onReset }: ExercisesFiltersProps) {
  const activeFiltersCount = Object.values(filters).filter(value => 
    value !== null && value !== ''
  ).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search exercises..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-nowrap">
          <Select
            value={filters.category}
            onValueChange={(value) => onFiltersChange({ category: value })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.muscleGroup}
            onValueChange={(value) => onFiltersChange({ muscleGroup: value })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Muscle Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Muscle Groups</SelectItem>
              {muscleGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.equipment}
            onValueChange={(value) => onFiltersChange({ equipment: value })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Equipment</SelectItem>
              {equipment.map((eq) => (
                <SelectItem key={eq} value={eq}>
                  {eq}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.difficultyLevel}
            onValueChange={(value) => onFiltersChange({ difficultyLevel: value })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Levels</SelectItem>
              {difficultyLevels.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.syncStatus}
            onValueChange={(value) => onFiltersChange({ syncStatus: value })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Sync Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              {syncStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.isActive === null ? '' : filters.isActive.toString()}
            onValueChange={(value) => onFiltersChange({ 
              isActive: value === '' ? null : value === 'true' 
            })}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              onClick={onReset}
              className="flex items-center space-x-1"
            >
              <X className="h-4 w-4" />
              <span>Reset</span>
              <Badge variant="secondary" className="ml-1">
                {activeFiltersCount}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Filters applied: {activeFiltersCount}
        </span>
      </div>
    </div>
  )
}