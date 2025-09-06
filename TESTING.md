# Testing Guide for Trainerize Sync App

## Quick Start Testing

### 1. **Environment Check**
Make sure you have your `.env.local` file configured:
```bash
# Copy the example and add your credentials
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `TRAINERIZE_API_BASE_URL` - Usually `https://api.trainerize.com`
- `TRAINERIZE_GROUP_ID` - Your Trainerize group ID
- `TRAINERIZE_API_TOKEN` - Your Trainerize API token

### 2. **Run Automated Tests**
```bash
# Run the comprehensive test suite
npm run test:sync

# Or run the new complete system test
npx tsx scripts/test-complete-system.ts
```

### 3. **Manual UI Testing**

#### **Basic Navigation**
1. Visit `http://localhost:3000`
2. Check that the dashboard loads
3. Navigate to each major section:
   - `/exercises/manage` - Exercise management
   - `/workouts` - Workout management
   - `/workouts/discover` - Workout discovery
   - `/discovery` - API discovery tool

#### **Exercise Management Testing**
1. Go to `/exercises/manage`
2. **Search & Filter:**
   - Use the search box to find exercises
   - Filter by sync status
   - Test pagination if you have many exercises

3. **Add Single Exercise:**
   - Click "Add Exercise" (if available)
   - Or test via API directly

4. **Bulk Operations:**
   - Select multiple exercises
   - Try bulk sync to Trainerize
   - Check progress indicators

#### **Workout Management Testing**
1. Go to `/workouts`
2. **View Workouts:**
   - See list of existing workouts
   - Check sync status indicators
   - Filter by workout type

3. **Create Workout:**
   - Try creating a new workout
   - Add exercises from library
   - Set reps/sets/rest times
   - Save and sync

#### **Discovery Tools Testing**
1. Go to `/workouts/discover`
2. **Run Discovery:**
   - Click "Start Discovery"
   - Watch real-time logs
   - Check results and analysis

3. **Test Specific Templates:**
   - Enter a template ID
   - Run detailed analysis
   - Check decoded exercise information

## API Testing with cURL

### **Test Exercise Addition**
```bash
# Add single exercise
curl -X POST http://localhost:3000/api/exercises/add \
  -H "Content-Type: application/json" \
  -d '{
    "exerciseData": {
      "name": "Test Push-up",
      "description": "Basic push-up exercise",
      "muscle_groups": ["chest", "triceps"],
      "equipment": ["bodyweight"]
    },
    "addToTrainerize": true
  }'
```

### **Test Workout Addition**
```bash
# Add workout
curl -X POST http://localhost:3000/api/workouts/add \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mine",
    "workoutDef": {
      "name": "Test Upper Body",
      "type": "workoutRegular",
      "exercises": [
        {
          "def": {
            "name": "Push-ups",
            "sets": 3,
            "target": "10-15 reps",
            "restTime": 60
          }
        }
      ]
    }
  }'
```

### **Test Discovery**
```bash
# Run workout discovery
curl -X POST http://localhost:3000/api/workouts/discover

# Test specific workout template
curl -X POST http://localhost:3000/api/workouts/test \
  -H "Content-Type: application/json" \
  -d '{"templateId": "12345"}'
```

### **Test Data Backup**
```bash
# Export backup
curl http://localhost:3000/api/backup?format=json
```

## Database Testing

### **Check Tables**
Run these queries in your Supabase SQL editor:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Count records
SELECT 'exercises' as table_name, COUNT(*) as count FROM exercises
UNION ALL
SELECT 'workout_templates', COUNT(*) FROM workout_templates  
UNION ALL
SELECT 'sync_logs', COUNT(*) FROM sync_logs;

-- Check recent sync logs
SELECT * FROM sync_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## Integration Testing Scenarios

### **Scenario 1: First-Time Setup**
1. Empty database → Sync from Trainerize
2. Check that exercises populate
3. Verify sync logs are created

### **Scenario 2: Bidirectional Sync**
1. Add exercise in Supabase
2. Sync to Trainerize
3. Modify in Trainerize
4. Sync back to Supabase
5. Check for conflicts

### **Scenario 3: Bulk Operations**
1. Select 10+ exercises
2. Bulk sync to Trainerize
3. Monitor progress
4. Check success/failure rates

### **Scenario 4: Error Handling**
1. Disconnect internet during sync
2. Use invalid API credentials
3. Try syncing malformed data
4. Check error messages and recovery

## Performance Testing

### **Load Testing**
```bash
# Test with many requests
for i in {1..10}; do
  curl http://localhost:3000/api/exercises &
done
```

### **Large Data Sets**
1. Sync 100+ exercises
2. Monitor memory usage
3. Check response times
4. Verify rate limiting

## Troubleshooting Common Issues

### **Database Connection Issues**
- Check Supabase credentials
- Verify service role permissions
- Test connection manually

### **Trainerize API Issues**
- Verify API token is valid
- Check group ID matches your account
- Test API endpoints with Postman

### **Build Issues**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript
npm run build
```

### **Environment Issues**
- Ensure `.env.local` is in root directory
- Check variable names match exactly
- Restart dev server after changes

## Success Criteria

✅ **All automated tests pass**
✅ **UI loads without errors**
✅ **Database connections work**
✅ **Trainerize API responds**
✅ **Exercise sync completes**
✅ **Workout management functions**
✅ **Discovery tools analyze data**
✅ **Error handling works gracefully**

## Next Steps After Testing

1. **Deploy to staging environment**
2. **Set up monitoring and alerts**
3. **Create user documentation**
4. **Set up automated testing pipeline**
5. **Plan production deployment**