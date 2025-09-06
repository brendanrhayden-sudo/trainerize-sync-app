# Trainerize Sync App

A Next.js 14 application built with TypeScript for syncing data between Trainerize API and Supabase. Features a comprehensive exercise management dashboard with real-time sync capabilities, advanced filtering, bulk operations, and modern UI components.

## Features

- **🔄 Real-time Sync**: Sync exercises between Trainerize and Supabase
- **📊 Dashboard**: Comprehensive exercise management interface
- **🔍 Advanced Filtering**: Search, filter, and sort exercises
- **⚡ Bulk Operations**: Perform operations on multiple exercises
- **📱 Responsive Design**: Mobile-first responsive UI
- **🎨 Modern UI**: Built with Tailwind CSS and Shadcn/ui
- **🔧 TypeScript**: Full type safety throughout the application
- **⚠️ Error Handling**: Comprehensive error handling and loading states

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Shadcn/ui
- **Database**: Supabase
- **API Integration**: Trainerize API v03
- **State Management**: React hooks
- **Data Tables**: TanStack Table
- **Notifications**: Sonner

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase project
- Trainerize API credentials

## Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure your environment variables in `.env.local`**
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Trainerize API
   TRAINERIZE_API_URL=https://api.trainerize.com/v03
   TRAINERIZE_GROUP_ID=your_group_id
   TRAINERIZE_API_TOKEN=your_api_token

   # App Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret
   ```

## Database Setup

### Supabase Schema

Create the following tables in your Supabase database:

```sql
-- Exercises table
CREATE TABLE exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainerize_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  muscle_groups TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  instructions TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error', 'deleted')),
  metadata JSONB
);

-- Sync logs table
CREATE TABLE sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  status TEXT DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB
);
```

## Development

**Start the development server**
```bash
npm run dev
```

**Open [http://localhost:3000](http://localhost:3000) in your browser**

## API Endpoints

### Exercises
- `GET /api/exercises` - List exercises with filtering and pagination
- `GET /api/exercises/[id]` - Get specific exercise
- `PUT /api/exercises/[id]` - Update exercise
- `DELETE /api/exercises/[id]` - Delete exercise
- `POST /api/exercises/bulk` - Bulk operations

### Sync
- `POST /api/sync` - Start sync process from Trainerize

## Usage

### Dashboard Features

1. **Exercise Management** - View, search, filter, and manage exercises
2. **Sync Functionality** - Manual sync from Trainerize API with status updates
3. **Bulk Operations** - Perform operations on multiple exercises
4. **Advanced Filtering** - Search and filter by multiple criteria

### Trainerize API Integration

The app integrates with Trainerize API v03 using Basic Authentication for:
- User management
- Training plans and workouts
- Calendar events
- Body statistics
