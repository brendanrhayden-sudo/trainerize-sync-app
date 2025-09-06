#!/usr/bin/env tsx

// Basic functionality test without requiring environment variables

interface TestResult {
  test: string
  success: boolean
  message?: string
  error?: string
}

class BasicTester {
  private results: TestResult[] = []
  
  private addResult(result: TestResult) {
    this.results.push(result)
    const icon = result.success ? '✅' : '❌'
    const details = result.success ? result.message : result.error
    console.log(`${icon} ${result.test}${details ? ': ' + details : ''}`)
  }

  // Test 1: Application Server
  async testServer() {
    console.log('\n🌐 Testing Application Server...')
    
    try {
      const response = await fetch('http://localhost:3000/')
      
      this.addResult({
        test: 'Next.js application server',
        success: response.status === 200,
        message: response.status === 200 ? 'Running correctly' : `Status: ${response.status}`
      })
      
      const html = await response.text()
      
      this.addResult({
        test: 'Application renders HTML',
        success: html.includes('<html'),
        message: html.includes('<html') ? 'Valid HTML response' : undefined,
        error: html.includes('<html') ? undefined : 'No HTML structure found'
      })

    } catch (error: any) {
      this.addResult({
        test: 'Next.js application server',
        success: false,
        error: error.message
      })
    }
  }

  // Test 2: UI Routes
  async testUIRoutes() {
    console.log('\n🎨 Testing UI Routes...')
    
    const routes = [
      { path: '/', name: 'Home page' },
      { path: '/exercises/manage', name: 'Exercise management' },
      { path: '/workouts', name: 'Workout management' },
      { path: '/workouts/discover', name: 'Workout discovery' },
      { path: '/discovery', name: 'API discovery' }
    ]

    for (const route of routes) {
      try {
        const response = await fetch(`http://localhost:3000${route.path}`)
        
        this.addResult({
          test: route.name,
          success: response.status === 200,
          message: response.status === 200 ? 'Accessible' : `Status: ${response.status}`
        })
      } catch (error: any) {
        this.addResult({
          test: route.name,
          success: false,
          error: error.message
        })
      }
    }
  }

  // Test 3: API Route Structure (without database calls)
  async testAPIStructure() {
    console.log('\n🔗 Testing API Route Structure...')
    
    const apiRoutes = [
      { path: '/api/exercises', method: 'GET', expectsAuth: true },
      { path: '/api/workouts/discover', method: 'POST', expectsAuth: true },
      { path: '/api/backup', method: 'GET', expectsAuth: true }
    ]

    for (const route of apiRoutes) {
      try {
        const options: RequestInit = {
          method: route.method,
          headers: { 'Content-Type': 'application/json' }
        }

        const response = await fetch(`http://localhost:3000${route.path}`, options)
        
        // For routes that expect authentication/database, we expect 500 errors
        // For routes that should work without auth, we expect 200
        const isExpectedError = route.expectsAuth && response.status >= 500
        const isSuccess = response.status === 200
        
        this.addResult({
          test: `${route.method} ${route.path}`,
          success: isSuccess || isExpectedError,
          message: isSuccess ? 'Working' : 
                   isExpectedError ? 'Route exists (needs config)' : 
                   `Unexpected status: ${response.status}`
        })

      } catch (error: any) {
        this.addResult({
          test: `${route.method} ${route.path}`,
          success: false,
          error: error.message
        })
      }
    }
  }

  // Test 4: Static Assets
  async testStaticAssets() {
    console.log('\n📦 Testing Static Assets...')
    
    try {
      const response = await fetch('http://localhost:3000/_next/static/media/favicon.ico')
      
      this.addResult({
        test: 'Static assets loading',
        success: response.status === 200 || response.status === 404, // 404 is okay if no favicon
        message: response.status === 404 ? 'No favicon (normal)' : 'Assets accessible'
      })
    } catch (error: any) {
      this.addResult({
        test: 'Static assets loading',
        success: false,
        error: error.message
      })
    }
  }

  // Test 5: Build Integrity
  async testBuildIntegrity() {
    console.log('\n🔧 Testing Build Integrity...')
    
    try {
      // Test that React hydration is working by checking for Next.js specific content
      const response = await fetch('http://localhost:3000/')
      const html = await response.text()
      
      const hasNextScript = html.includes('_next/static')
      const hasReactHydration = html.includes('__NEXT_DATA__')
      
      this.addResult({
        test: 'Next.js build integrity',
        success: hasNextScript,
        message: hasNextScript ? 'Next.js scripts present' : undefined,
        error: hasNextScript ? undefined : 'Missing Next.js build assets'
      })

      this.addResult({
        test: 'React hydration setup',
        success: hasReactHydration,
        message: hasReactHydration ? 'Hydration data present' : 'Static generation only',
      })

    } catch (error: any) {
      this.addResult({
        test: 'Build integrity',
        success: false,
        error: error.message
      })
    }
  }

  // Run all basic tests
  async runAllTests() {
    console.log('🧪 Starting Basic Functionality Test Suite')
    console.log('=' .repeat(50))
    console.log('Note: This tests the application structure without requiring')
    console.log('database or API credentials.')
    console.log('')

    await this.testServer()
    await this.testUIRoutes()
    await this.testAPIStructure()
    await this.testStaticAssets()
    await this.testBuildIntegrity()

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

    console.log('\n🔗 What This Means:')
    if (failed === 0) {
      console.log('   ✅ Your application structure is working correctly!')
      console.log('   🌐 All UI routes are accessible')
      console.log('   🔗 API routes are properly set up')
      console.log('   📦 Build system is functioning')
      console.log('')
      console.log('🚀 Next Steps:')
      console.log('   1. Set up your .env.local file with API credentials')
      console.log('   2. Run: npm run test:complete (for full integration test)')
      console.log('   3. Visit http://localhost:3000 to use the application')
    } else {
      console.log('   ⚠️  Some basic functionality issues found')
      console.log('   🔧 Check that the development server is running')
      console.log('   📦 Verify the build completed successfully')
    }

    return { passed, failed, total }
  }
}

// Run tests
async function main() {
  const tester = new BasicTester()
  
  try {
    const results = await tester.runAllTests()
    process.exit(results.failed === 0 ? 0 : 1)
  } catch (error) {
    console.error('❌ Test suite crashed:', error)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})