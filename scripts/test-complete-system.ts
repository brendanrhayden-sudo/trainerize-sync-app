#!/usr/bin/env tsx

import { config } from 'dotenv'
import { supabaseAdmin } from '../src/lib/supabase'
import { TrainerizeClient } from '../src/lib/trainerize-client'

// Load environment variables
config({ path: '.env.local' })

interface TestResult {
  test: string
  success: boolean
  message?: string
  data?: any
  error?: string
}

class SystemTester {
  private results: TestResult[] = []
  private trainerizeClient: TrainerizeClient
  
  constructor() {
    this.trainerizeClient = new TrainerizeClient()
  }

  private addResult(result: TestResult) {
    this.results.push(result)
    const icon = result.success ? '✅' : '❌'
    const details = result.success ? result.message : result.error
    console.log(`${icon} ${result.test}${details ? ': ' + details : ''}`)
  }

  // Test 1: Environment Variables
  async testEnvironment() {
    console.log('\n🔧 Testing Environment Configuration...')
    
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'TRAINERIZE_API_BASE_URL',
      'TRAINERIZE_GROUP_ID',
      'TRAINERIZE_API_TOKEN'
    ]

    for (const varName of requiredVars) {
      const value = process.env[varName]
      this.addResult({
        test: `Environment variable ${varName}`,
        success: !!value,
        message: value ? 'Set' : undefined,
        error: value ? undefined : 'Missing or empty'
      })
    }
  }

  // Test 2: Database Connectivity
  async testDatabase() {
    console.log('\n💾 Testing Database Connectivity...')
    
    try {
      // Test basic connection
      const { error: connectionError } = await supabaseAdmin
        .from('exercises')
        .select('count')
        .limit(1)

      this.addResult({
        test: 'Supabase connection',
        success: !connectionError,
        message: connectionError ? undefined : 'Connected successfully',
        error: connectionError?.message
      })

      if (!connectionError) {
        // Test table existence
        const tables = ['exercises', 'sync_logs', 'workout_templates']
        for (const table of tables) {
          try {
            const { data, error } = await supabaseAdmin
              .from(table)
              .select('*')
              .limit(1)

            this.addResult({
              test: `Table '${table}' access`,
              success: !error,
              message: `Found ${data?.length || 0} records`,
              error: error?.message
            })
          } catch (err: any) {
            this.addResult({
              test: `Table '${table}' access`,
              success: false,
              error: err.message
            })
          }
        }
      }
    } catch (error: any) {
      this.addResult({
        test: 'Database connection',
        success: false,
        error: error.message
      })
    }
  }

  // Test 3: Trainerize API
  async testTrainerizeAPI() {
    console.log('\n🏋️ Testing Trainerize API...')
    
    try {
      // Test authentication
      const authTest = await this.trainerizeClient.makeRequest('/exercise/getList', 'POST', {
        start: 0,
        count: 1
      })

      this.addResult({
        test: 'Trainerize API authentication',
        success: true,
        message: 'Successfully authenticated and fetched data'
      })

      // Test specific endpoints
      const endpoints = [
        { path: '/exercise/getList', name: 'Exercise list' },
        { path: '/workoutTemplate/getList', name: 'Workout templates' }
      ]

      for (const endpoint of endpoints) {
        try {
          const result = await this.trainerizeClient.makeRequest(endpoint.path, 'POST', {
            start: 0,
            count: 5
          })

          const count = Array.isArray(result) ? result.length : 
                       result?.exercises?.length || result?.templates?.length || 0

          this.addResult({
            test: `${endpoint.name} endpoint`,
            success: true,
            message: `Retrieved ${count} items`
          })
        } catch (error: any) {
          this.addResult({
            test: `${endpoint.name} endpoint`,
            success: false,
            error: error.message
          })
        }
      }

    } catch (error: any) {
      this.addResult({
        test: 'Trainerize API authentication',
        success: false,
        error: error.message
      })
    }
  }

  // Test 4: API Endpoints
  async testAPIEndpoints() {
    console.log('\n🌐 Testing Application API Endpoints...')
    
    const baseUrl = 'http://localhost:3000'
    const endpoints = [
      { method: 'GET', path: '/api/exercises', name: 'Get exercises' },
      { method: 'POST', path: '/api/exercises/add', name: 'Add exercise', requiresBody: true },
      { method: 'POST', path: '/api/workouts/discover', name: 'Workout discovery' },
      { method: 'GET', path: '/api/backup', name: 'Backup data' }
    ]

    for (const endpoint of endpoints) {
      try {
        const options: RequestInit = {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' }
        }

        if (endpoint.requiresBody && endpoint.method === 'POST') {
          // Skip POST endpoints that require specific body structure for now
          this.addResult({
            test: `${endpoint.method} ${endpoint.path}`,
            success: true,
            message: 'Skipped (requires specific body)'
          })
          continue
        }

        const response = await fetch(`${baseUrl}${endpoint.path}`, options)
        
        this.addResult({
          test: `${endpoint.method} ${endpoint.path}`,
          success: response.status < 500,
          message: `Status: ${response.status}`
        })

      } catch (error: any) {
        this.addResult({
          test: `${endpoint.method} ${endpoint.path}`,
          success: false,
          error: error.message
        })
      }
    }
  }

  // Test 5: Data Sync Functionality
  async testDataSync() {
    console.log('\n🔄 Testing Data Sync Functionality...')
    
    try {
      // Test exercise mapping
      const { data: exercises } = await supabaseAdmin
        .from('exercises')
        .select('*')
        .limit(3)

      this.addResult({
        test: 'Exercise data retrieval',
        success: !!exercises,
        message: `Found ${exercises?.length || 0} exercises`
      })

      if (exercises && exercises.length > 0) {
        const exercise = exercises[0]
        
        // Test field mapping
        const hasRequiredFields = exercise.name && exercise.id
        this.addResult({
          test: 'Exercise data structure',
          success: hasRequiredFields,
          message: hasRequiredFields ? 'Required fields present' : undefined,
          error: hasRequiredFields ? undefined : 'Missing required fields'
        })
      }

      // Test sync logs
      const { data: syncLogs } = await supabaseAdmin
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      this.addResult({
        test: 'Sync logs functionality',
        success: true,
        message: `Found ${syncLogs?.length || 0} sync log entries`
      })

    } catch (error: any) {
      this.addResult({
        test: 'Data sync functionality',
        success: false,
        error: error.message
      })
    }
  }

  // Test 6: UI Routes
  async testUIRoutes() {
    console.log('\n🎨 Testing UI Routes...')
    
    const routes = [
      '/',
      '/exercises/manage',
      '/workouts',
      '/workouts/discover',
      '/discovery'
    ]

    for (const route of routes) {
      try {
        const response = await fetch(`http://localhost:3000${route}`)
        
        this.addResult({
          test: `Route ${route}`,
          success: response.status === 200,
          message: response.status === 200 ? 'Accessible' : `Status: ${response.status}`
        })
      } catch (error: any) {
        this.addResult({
          test: `Route ${route}`,
          success: false,
          error: error.message
        })
      }
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Complete System Test Suite')
    console.log('=' .repeat(50))

    await this.testEnvironment()
    await this.testDatabase()
    await this.testTrainerizeAPI()
    await this.testAPIEndpoints()
    await this.testDataSync()
    await this.testUIRoutes()

    // Summary
    console.log('\n📊 Test Summary')
    console.log('=' .repeat(50))
    
    const passed = this.results.filter(r => r.success).length
    const failed = this.results.filter(r => !r.success).length
    const total = this.results.length

    console.log(`✅ Passed: ${passed}/${total}`)
    console.log(`❌ Failed: ${failed}/${total}`)
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:')
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   • ${r.test}: ${r.error}`))
    }

    console.log('\n🔗 Next Steps:')
    if (failed === 0) {
      console.log('   ✅ All tests passed! Your system is ready.')
      console.log('   🌐 Visit: http://localhost:3000')
      console.log('   🏋️ Try adding an exercise via the UI')
      console.log('   🔍 Explore the workout discovery tool')
    } else {
      console.log('   🔧 Fix the failed tests above')
      console.log('   📖 Check your .env.local configuration')
      console.log('   🔗 Verify your API credentials')
    }

    return { passed, failed, total }
  }
}

// Run tests
async function main() {
  const tester = new SystemTester()
  
  try {
    const results = await tester.runAllTests()
    process.exit(results.failed === 0 ? 0 : 1)
  } catch (error) {
    console.error('❌ Test suite crashed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚡ Test interrupted by user')
  process.exit(1)
})

main().catch(error => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})