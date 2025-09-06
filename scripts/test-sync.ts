#!/usr/bin/env tsx

import { config } from 'dotenv'
import { syncService } from '../src/lib/sync-service'
import { schemaInspector } from '../src/lib/schema-inspector'
import { supabaseAdmin } from '../src/lib/supabase'

// Load environment variables
config({ path: '.env.local' })

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...')
  
  try {
    // Test connection by trying to access exercises table
    const { error } = await supabaseAdmin
      .from('exercises')
      .select('count')
      .limit(1)

    if (error) {
      console.log('⚠️  Could not access exercises table:', error.message)
      return false
    }

    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

async function inspectSchema() {
  console.log('\n🔍 Inspecting database schema...')
  
  try {
    const schemaInfo = await schemaInspector.inspectExercisesTable()
    
    if (!schemaInfo.hasTable) {
      console.log('❌ Exercises table not found')
      console.log('📝 You need to create the exercises table first')
      return false
    }

    console.log('✅ Exercises table found')
    console.log('📊 Columns:', Object.keys(schemaInfo.columns).join(', '))
    console.log('🔗 Relationships:', schemaInfo.relationships.length)
    console.log('🗺️  Column mapping:', schemaInfo.suggestedMapping)

    return true
  } catch (error) {
    console.error('❌ Schema inspection failed:', error)
    return false
  }
}

async function testSyncPreview() {
  console.log('\n🔍 Testing sync preview (dry run)...')
  
  try {
    await syncService.initialize()
    console.log('✅ Sync service initialized')

    const preview = await syncService.previewSync()
    
    console.log('📊 Sync Preview Results:')
    console.log(`   Total Trainerize exercises: ${preview.total_trainerize_exercises}`)
    console.log(`   Operations planned:`)
    console.log(`     - Create: ${preview.summary.to_create}`)
    console.log(`     - Update: ${preview.summary.to_update}`)
    console.log(`     - Skip: ${preview.summary.to_skip}`)
    console.log(`     - Conflicts: ${preview.summary.conflicts}`)

    if (preview.conflicts.length > 0) {
      console.log('\n⚠️  Conflicts found:')
      preview.conflicts.forEach((conflict, index) => {
        console.log(`   ${index + 1}. ${conflict.reason || 'Unknown conflict'}`)
        if (conflict.conflicts) {
          conflict.conflicts.forEach(c => console.log(`      - ${c}`))
        }
      })
    }

    return true
  } catch (error) {
    console.error('❌ Sync preview failed:', error)
    return false
  }
}

async function showExistingData() {
  console.log('\n🔍 Showing existing exercises...')
  
  try {
    const { data, error } = await supabaseAdmin
      .from('exercises')
      .select('*')
      .limit(5)

    if (error) {
      console.error('❌ Could not fetch existing exercises:', error.message)
      return false
    }

    if (!data || data.length === 0) {
      console.log('📭 No existing exercises found')
    } else {
      console.log(`📚 Found ${data.length} existing exercises (showing first 5):`)
      data.forEach((exercise, index) => {
        const name = exercise.name || 'Unnamed'
        const id = exercise.id
        const trainerizeId = exercise.trainerize_id || 'No Trainerize ID'
        console.log(`   ${index + 1}. ${name} (ID: ${id}, Trainerize: ${trainerizeId})`)
      })
    }

    return true
  } catch (error) {
    console.error('❌ Error fetching exercises:', error)
    return false
  }
}

async function testSyncLogs() {
  console.log('\n🔍 Checking sync logs...')
  
  try {
    const { data, error } = await supabaseAdmin
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5)

    if (error) {
      console.log('⚠️  Could not fetch sync logs (table may not exist):', error.message)
      return false
    }

    if (!data || data.length === 0) {
      console.log('📭 No sync logs found')
    } else {
      console.log(`📜 Recent sync logs (${data.length}):`)
      data.forEach((log, index) => {
        const status = log.status || 'unknown'
        const type = log.sync_type || 'unknown'
        const date = new Date(log.started_at).toLocaleString()
        console.log(`   ${index + 1}. ${type} sync - ${status} (${date})`)
      })
    }

    return true
  } catch (error) {
    console.error('❌ Error checking sync logs:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Trainerize Sync Test Suite')
  console.log('=' .repeat(40))

  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Schema Inspection', fn: inspectSchema },
    { name: 'Existing Data', fn: showExistingData },
    { name: 'Sync Logs', fn: testSyncLogs },
    { name: 'Sync Preview', fn: testSyncPreview }
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      const result = await test.fn()
      if (result) {
        passed++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`❌ ${test.name} crashed:`, error)
      failed++
    }
  }

  console.log('\n📊 Test Results:')
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Your sync setup looks good.')
    console.log('💡 Next steps:')
    console.log('   1. Run: npm run dev')
    console.log('   2. Visit: http://localhost:3000')
    console.log('   3. Test the sync preview in the UI')
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.')
    console.log('💡 Make sure your Supabase database is properly set up.')
  }

  process.exit(failed === 0 ? 0 : 1)
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error)
  process.exit(1)
})

// Run the tests
main().catch(error => {
  console.error('❌ Test suite crashed:', error)
  process.exit(1)
})