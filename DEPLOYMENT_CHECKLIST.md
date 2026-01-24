# Phase 6 & 7 - Deployment Checklist ✅

## Pre-Deployment Verification

### Application Build
- ✅ Production build succeeds
- ✅ No compilation errors
- ✅ All 3820 modules transformed
- ✅ Output: `dist/` folder ready
- ✅ Build time: 5.36 seconds

### Code Integration
- ✅ EventPage.jsx fully integrated
- ✅ Navbar.jsx enhanced with theme customizer
- ✅ All 10 new components imported and used
- ✅ All 4 new utilities integrated
- ✅ Dependencies installed (npm install)

### Component Status
- ✅ TimelineView - Ready
- ✅ CsvManager - Ready
- ✅ EventCloneDialog - Ready
- ✅ AnnouncementsFeed - Ready
- ✅ ThemeBuilder - Ready & Fixed Grid issues
- ✅ EventStatusManager - Ready
- ✅ EventAnalytics - Ready & Fixed Grid issues
- ✅ MetadataTemplateBuilder - Ready
- ✅ PdfExportDialog - Ready

---

## Deployment Steps

### Phase 1: Database Setup (Day 1)

#### Step 1.1: Backup Current Database
```bash
# Via Supabase Dashboard:
1. Go to Settings > Database
2. Click "Backup" (if available)
3. Download backup as insurance
```

#### Step 1.2: Apply Migration 17 (Rounds, Tasks, Event Status)
```sql
-- Copy from: supabase/migrations/17_rounds_tasks_event_status.sql
-- Paste into: Supabase Dashboard > SQL Editor
-- Expected: 0 errors, 11 new objects created
```

**Verify:**
- [ ] `rounds` table exists
- [ ] `tasks` table exists
- [ ] `task_scores` table exists
- [ ] `events.status` column added
- [ ] `events.timeline` column added
- [ ] 6 RLS policies created
- [ ] Realtime enabled

#### Step 1.3: Apply Migration 18 (Themes, Roles, Metadata, Announcements)
```sql
-- Copy from: supabase/migrations/18_themes_roles_metadata_announcements.sql
-- Paste into: Supabase Dashboard > SQL Editor
-- Expected: 0 errors, 8 new objects created
```

**Verify:**
- [ ] `themes` table exists
- [ ] `custom_roles` table exists
- [ ] `metadata_templates` table exists
- [ ] `announcements` table exists
- [ ] `event_analytics` table exists
- [ ] `profiles.custom_role_id` column added
- [ ] `teams.poc_user_id` column added
- [ ] `teams.description` column added
- [ ] 8 RLS policies created
- [ ] Realtime enabled

#### Step 1.4: Apply Migration 19 (Clone Event Function)
```sql
-- Copy from: supabase/migrations/19_clone_event_function.sql
-- Paste into: Supabase Dashboard > SQL Editor
-- Expected: 0 errors, 1 function created
```

**Verify:**
- [ ] `clone_event()` function exists
- [ ] Function signature correct: `clone_event(uuid, text, bool, bool, bool, bool) returns uuid`

---

### Phase 2: Local Testing (Day 2)

#### Step 2.1: Test Event Status Workflow
1. Create test event
2. Click new "Status Manager" dropdown in header
3. Verify status transitions:
   - [ ] draft → registration_open
   - [ ] registration_open → registration_closed
   - [ ] registration_closed → live
   - [ ] live → completed
   - [ ] completed → archived
4. Verify restriction messages appear
5. Check event_audit table for entries

#### Step 2.2: Test CSV Import/Export
1. Open event
2. Click "CSV Manager" button
3. Export teams to CSV
   - [ ] Download successful
   - [ ] File format correct
4. Import teams from CSV
   - [ ] Paste sample CSV
   - [ ] Preview shows correct parsing
   - [ ] Import button works
   - [ ] New teams appear in list

#### Step 2.3: Test Event Cloning
1. Open event
2. Click "Clone Event" button
3. Dialog appears with:
   - [ ] New event name field
   - [ ] Checkbox for teams
   - [ ] Checkbox for judges
   - [ ] Checkbox for matches
   - [ ] Checkbox for polls
4. Clone with various combinations
5. Verify new event created with correct data
6. Check team scores reset to 0
7. Verify team ID mapping preserved

#### Step 2.4: Test Theme Customization
1. Click **Palette icon** in navbar
2. Theme modal opens
3. Test color picker:
   - [ ] Color inputs work
   - [ ] Hex color picker works
   - [ ] Preview updates in real-time
4. Change colors and click "Apply Theme"
5. Verify colors persist after page refresh
6. Test "Reset to Default"
7. Check localStorage has color data

#### Step 2.5: Test PDF Export
1. Open event with teams and matches
2. Click "PDF Export" button
3. Dialog shows options:
   - [ ] Leaderboard
   - [ ] Bracket (matches)
   - [ ] Polls
   - [ ] Event Summary
4. Generate each PDF type
   - [ ] Download completes
   - [ ] Files are readable
   - [ ] Data is accurate
5. Performance test: Generate PDF with 100+ matches (should take <5 sec)

#### Step 2.6: Test Announcements Feed
1. Open event
2. Go to "Announcements" tab
3. Create new announcement (if canManage):
   - [ ] Markdown rendering works
   - [ ] Avatar shows creator
   - [ ] Timestamp displays
4. Pin/unpin announcement
5. Real-time subscription test:
   - [ ] Open same event in 2 tabs
   - [ ] Create announcement in tab 1
   - [ ] Verify appears in tab 2 within 1 second

#### Step 2.7: Test Timeline View
1. Open event
2. Go to "Timeline" tab
3. Verify displays:
   - [ ] Rounds with status indicators
   - [ ] Match progression
   - [ ] Score history
   - [ ] Real-time updates

#### Step 2.8: Test Analytics Dashboard
1. Open event with activity
2. Go to "Analytics" tab
3. Verify metrics display:
   - [ ] Match progress (X/Y completed)
   - [ ] Poll participation (vote count)
   - [ ] Score updates (count)
   - [ ] Competitive intensity (%)
4. Real-time subscription test:
   - [ ] Open analytics in 2 tabs
   - [ ] Complete a match in tab 1
   - [ ] Verify analytics updates in tab 2

#### Step 2.9: Test Team Metadata
1. Open event
2. Go to "Team Metadata" tab
3. Create metadata template:
   - [ ] Add text field
   - [ ] Add number field
   - [ ] Add select field with options
   - [ ] Mark field as required
4. Save template
5. Create new team
6. Verify metadata fields appear in team form
7. Enter data and save
8. Verify data persists

#### Step 2.10: Test Dark Mode
1. Click dark mode toggle in navbar
2. Verify theme switches (should include theme colors)
3. Refresh page
4. Verify dark mode preference persists

---

### Phase 3: Staging Deployment (Day 3)

#### Step 3.1: Deploy Code to Staging
```bash
# Build
npm run build

# Deploy dist/ folder to staging environment
# (Vercel, Netlify, or custom hosting)
# URL: https://staging.designbattles.com (example)
```

#### Step 3.2: Update Staging Environment Variables
Ensure staging Supabase project is connected:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

#### Step 3.3: QA Testing on Staging
- [ ] Run all tests from Phase 2 again on staging
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test on mobile devices
- [ ] Verify network requests (F12 > Network)
- [ ] Check for console errors (F12 > Console)
- [ ] Test with 10+ concurrent users (if possible)

#### Step 3.4: Performance Testing
- [ ] CSV import with 1000 teams (measure time)
- [ ] PDF generation with 500 matches (should be <10 sec)
- [ ] Analytics with 100 matches + 100 polls (measure memory)
- [ ] Real-time subscriptions (verify no memory leaks)

#### Step 3.5: Security Testing
- [ ] Verify RLS policies:
  - [ ] Non-admin cannot change event status
  - [ ] Non-creator cannot clone event
  - [ ] Non-judge cannot edit matches when live
  - [ ] Non-creator cannot see private announcements
- [ ] Test with different user roles
- [ ] Verify audit log captures all changes

---

### Phase 4: Production Deployment (Day 4)

#### Step 4.1: Final Code Review
- [ ] All code follows project conventions
- [ ] No console errors or warnings
- [ ] No deprecated API calls
- [ ] Performance acceptable
- [ ] Security review passed

#### Step 4.2: Backup Production Database
```bash
# Via Supabase Dashboard:
1. Go to Settings > Database > Backups
2. Click "Backup" or enable auto-backups
3. Download and verify backup
```

#### Step 4.3: Deploy to Production
```bash
# Build
npm run build

# Deploy dist/ folder to production
# (Update DNS/hosting as needed)
```

#### Step 4.4: Update Production Environment
```
VITE_SUPABASE_URL=https://prod-xxx.supabase.co
VITE_SUPABASE_ANON_KEY=prod-xxx
```

#### Step 4.5: Smoke Testing on Production
- [ ] App loads without errors
- [ ] Create test event
- [ ] Test one feature from each category:
  - [ ] Status workflow
  - [ ] CSV export
  - [ ] Theme customization
  - [ ] PDF export
  - [ ] Announcement creation
- [ ] Check server logs for errors
- [ ] Monitor performance metrics

#### Step 4.6: Announce to Users
- [ ] Create release notes
- [ ] Highlight new features:
  - Event status pipeline
  - CSV import/export
  - Event cloning
  - Advanced themes
  - PDF export
  - Analytics dashboard
  - Announcements
  - Timeline view
  - Team metadata customization

---

### Phase 5: Post-Deployment (Day 5+)

#### Step 5.1: Monitor for Issues
- [ ] Check error logs daily
- [ ] Monitor database performance
- [ ] Track user feedback
- [ ] Watch for reported bugs

#### Step 5.2: Optimize if Needed
- [ ] If PDF generation slow: Consider Edge Functions
- [ ] If CSV import slow: Add progress bar
- [ ] If theme switching lag: Optimize CSS variables

#### Step 5.3: Gather User Feedback
- [ ] Survey users on new features
- [ ] Collect feature requests
- [ ] Document bugs reported
- [ ] Plan Phase 8 improvements

---

## Rollback Plan

If critical issues encountered:

### Immediate Rollback
```bash
# 1. Deploy previous version to production
cd /path/to/previous/build
npm run build
# Deploy dist/ folder

# 2. Notify users of temporary issue
# 3. Revert database migrations if necessary
```

### Database Rollback
```sql
-- Drop new tables if needed (use with caution)
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS event_analytics CASCADE;
DROP TABLE IF EXISTS metadata_templates CASCADE;
DROP TABLE IF EXISTS custom_roles CASCADE;
DROP TABLE IF EXISTS themes CASCADE;
DROP TABLE IF EXISTS task_scores CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS rounds CASCADE;
DROP FUNCTION IF EXISTS clone_event CASCADE;

-- Restore from backup via Supabase Dashboard
```

---

## Success Criteria

### All Deployment Phases Complete When:
- ✅ All migrations applied without errors
- ✅ All features tested and working
- ✅ No console errors or warnings
- ✅ Performance metrics acceptable
- ✅ RLS policies verified
- ✅ User feedback positive
- ✅ Zero critical bugs reported

---

## Timeline Estimate

- **Phase 1** (Database): 30 minutes
- **Phase 2** (Local Testing): 2-3 hours
- **Phase 3** (Staging): 2-3 hours
- **Phase 4** (Production): 1 hour
- **Phase 5** (Monitoring): Ongoing

**Total: 6-8 hours over 4-5 days**

---

## Contact

For issues during deployment:
- Check [INTEGRATION_COMPLETE.md](INTEGRATION_COMPLETE.md)
- Review [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- See [PHASE_6_7_IMPLEMENTATION.md](PHASE_6_7_IMPLEMENTATION.md) for feature docs

---

**Ready to deploy! All systems green. ✅**
