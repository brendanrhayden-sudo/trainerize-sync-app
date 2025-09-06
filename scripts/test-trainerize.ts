#!/usr/bin/env tsx

import { config } from 'dotenv'
import { trainerizeClient } from '../src/lib/trainerize-client'

// Load environment variables
config({ path: '.env.local' })

async function testConnection() {
  console.log('🔍 Testing Trainerize API connection...')
  
  try {
    const isValid = await trainerizeClient.validateConnection()
    
    if (isValid) {
      console.log('✅ Trainerize connection successful')
      return true
    } else {
      console.log('❌ Trainerize connection failed')
      return false
    }
  } catch (error) {
    console.error('❌ Connection error:', error instanceof Error ? error.message : error)
    return false
  }
}

async function testTrainingPlanDiscovery() {
  console.log('\n🔍 Testing training plan discovery...')
  
  try {
    const groupId = parseInt(process.env.TRAINERIZE_GROUP_ID || '0')
    
    if (!groupId) {
      console.log('⚠️  No group ID configured, skipping plan discovery')
      return []
    }

    console.log(`Looking for training plans for group ${groupId}...`)
    
    const plans = await trainerizeClient.getTrainingPlans(groupId)
    
    if (plans && plans.length > 0) {
      console.log(`✅ Found ${plans.length} training plans`)
      
      // Try to get workout definitions from first plan
      const firstPlan = plans[0]
      if (firstPlan.id) {
        console.log(`\n📋 Getting workouts from plan: ${firstPlan.name || firstPlan.id}`)
        const workouts = await trainerizeClient.getWorkoutDefinitions(firstPlan.id)
        console.log(`   Found ${workouts.length} workouts`)
        
        // Show first few workouts
        workouts.slice(0, 3).forEach((workout, index) => {
          console.log(`   ${index + 1}. ${workout.name || workout.title || `Workout ${workout.id}`}`)
        })
      }
      
      return plans
    } else {
      console.log('📭 No training plans found')
      return []
    }
  } catch (error) {
    console.error('❌ Training plan discovery failed:', error instanceof Error ? error.message : error)
    return []
  }
}

async function testExerciseDiscovery() {
  console.log('\n🔍 Testing exercise discovery...')
  
  try {
    const groupId = parseInt(process.env.TRAINERIZE_GROUP_ID || '0')
    
    if (!groupId) {
      console.log('⚠️  No group ID configured, using default discovery')
      return []
    }

    console.log('Discovering exercises from training plans...')
    
    const exercises = await trainerizeClient.discoverExercisesFromPlans([groupId])
    
    if (exercises.length > 0) {
      console.log(`✅ Discovered ${exercises.length} unique exercises`)
      
      // Show sample exercises
      console.log('\n📚 Sample exercises found:')
      exercises.slice(0, 5).forEach((exercise, index) => {
        console.log(`   ${index + 1}. ${exercise.name} (ID: ${exercise.id})`)
        if (exercise.category) console.log(`      Category: ${exercise.category}`)
        if (exercise.muscle_groups?.length) console.log(`      Muscles: ${exercise.muscle_groups.join(', ')}`)
      })
      
      // Show statistics
      const categories = new Set(exercises.map(e => e.category).filter(Boolean))
      const muscleGroups = new Set(exercises.flatMap(e => e.muscle_groups || []))
      
      console.log('\n📊 Exercise Statistics:')
      console.log(`   Total exercises: ${exercises.length}`)
      console.log(`   Unique categories: ${categories.size}`)
      console.log(`   Muscle groups covered: ${muscleGroups.size}`)
      
      if (categories.size > 0) {
        console.log(`   Categories: ${Array.from(categories).join(', ')}`)
      }
      
      return exercises
    } else {
      console.log('📭 No exercises found')
      return []
    }
  } catch (error) {
    console.error('❌ Exercise discovery failed:', error instanceof Error ? error.message : error)
    return []
  }
}

async function testCalendarData() {
  console.log('\n🔍 Testing calendar data retrieval...')
  
  try {
    const groupId = parseInt(process.env.TRAINERIZE_GROUP_ID || '0')
    
    if (!groupId) {
      console.log('⚠️  No group ID configured, skipping calendar test')
      return []
    }

    // Get recent calendar data (last 30 days)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]
    
    console.log(`Checking calendar from ${startDate} to ${endDate}...`)
    
    const calendarData = await trainerizeClient.getCalendarData(groupId, startDate, endDate)
    
    if (calendarData.length > 0) {
      console.log(`✅ Found ${calendarData.length} calendar entries`)
      
      // Show first few entries
      calendarData.slice(0, 3).forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.title || entry.name || entry.type || 'Calendar entry'}`)
        if (entry.date) console.log(`      Date: ${entry.date}`)
      })
      
      return calendarData
    } else {
      console.log('📭 No calendar data found')
      return []
    }
  } catch (error) {
    console.error('❌ Calendar data retrieval failed:', error instanceof Error ? error.message : error)
    return []
  }
}

async function testClientStats() {
  console.log('\n🔍 Testing client statistics...')
  
  try {
    const stats = await trainerizeClient.getStats()
    
    console.log('📊 Client Stats:')
    console.log(`   Connection valid: ${stats.connectionValid ? '✅' : '❌'}`)
    console.log(`   Rate limit delay: ${stats.rateLimitDelay}ms`)
    console.log(`   Last request: ${stats.lastRequestTime > 0 ? new Date(stats.lastRequestTime).toLocaleTimeString() : 'Never'}`)
    
    return stats
  } catch (error) {
    console.error('❌ Stats retrieval failed:', error instanceof Error ? error.message : error)
    return null
  }
}

async function main() {
  console.log('🚀 Trainerize Client Test Suite')
  console.log('=' .repeat(50))
  
  // Check environment variables
  const requiredEnvVars = ['TRAINERIZE_GROUP_ID', 'TRAINERIZE_API_TOKEN']
  const missing = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:')
    missing.forEach(varName => console.log(`   - ${varName}`))
    console.log('\n💡 Make sure to set these in your .env.local file')
    process.exit(1)
  }
  
  console.log('✅ Environment variables configured')
  console.log(`   Group ID: ${process.env.TRAINERIZE_GROUP_ID}`)
  console.log(`   API Token: ${'*'.repeat(Math.min(8, process.env.TRAINERIZE_API_TOKEN?.length || 0))}...`)

  const tests = [
    { name: 'Connection Test', fn: testConnection },
    { name: 'Client Stats', fn: testClientStats },
    { name: 'Training Plans', fn: testTrainingPlanDiscovery },
    { name: 'Exercise Discovery', fn: testExerciseDiscovery },
    { name: 'Calendar Data', fn: testCalendarData }
  ]

  let passed = 0
  let failed = 0
  const results: any[] = []

  for (const test of tests) {
    try {
      console.log(`\n${'='.repeat(20)} ${test.name} ${'='.repeat(20)}`)
      const result = await test.fn()
      
      if (result !== false && result !== null) {
        passed++
        results.push({ test: test.name, status: 'passed', data: result })
      } else if (result === false) {
        failed++
        results.push({ test: test.name, status: 'failed' })
      } else {
        passed++
        results.push({ test: test.name, status: 'passed' })
      }
    } catch (error) {
      console.error(`❌ ${test.name} crashed:`, error instanceof Error ? error.message : error)
      failed++
      results.push({ test: test.name, status: 'crashed', error })
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Test Results Summary:')
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Your Trainerize integration is working.')
    
    // Show summary of discovered data
    const exerciseTest = results.find(r => r.test === 'Exercise Discovery')
    if (exerciseTest?.data?.length > 0) {
      console.log('\n💡 Next steps:')
      console.log('   1. Run: npm run dev')
      console.log('   2. Visit: http://localhost:3000/discovery')
      console.log('   3. Start exercise discovery from the UI')
      console.log(`   4. You should find ${exerciseTest.data.length} exercises`)
    }
  } else {
    console.log('\n⚠️  Some tests failed. Please check:')
    console.log('   1. Your Trainerize API credentials')
    console.log('   2. Your network connection')
    console.log('   3. Trainerize API availability')
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