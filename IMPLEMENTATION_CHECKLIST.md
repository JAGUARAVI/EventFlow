# Implementation Checklist

## Database & Setup

- [ ] Run migration 17 (rounds, tasks, event status)
- [ ] Run migration 18 (themes, roles, metadata, announcements)
- [ ] Run migration 19 (clone event function)
- [ ] Verify migrations completed: `supabase migration status`
- [ ] Install new dependencies: `npm install jspdf jspdf-autotable react-markdown`
- [ ] Update package.json with new dependencies

## Code Integration

### Context & Providers
- [ ] Update `src/context/ThemeContext.jsx` (extended with color management)
- [ ] Update `src/main.jsx` or app root to wrap with `<ThemeProvider>`

### Navigation
- [ ] Add theme toggle to Navbar (sun/moon icon)
- [ ] Add theme customizer button to Navbar (palette icon)
- [ ] Import `ThemeBuilder` component in Navbar

### EventPage Integration
- [ ] Import all new components:
  - [ ] TimelineView
  - [ ] AnnouncementsFeed
  - [ ] EventAnalytics
  - [ ] CsvManager
  - [ ] PdfExportDialog
  - [ ] EventCloneDialog
  - [ ] EventStatusManager

- [ ] Add event header with status manager:
  ```jsx
  <EventStatusManager event={event} onStatusChange={handleStatusChange} />
  ```

- [ ] Add toolbar buttons:
  - [ ] CsvManager button
  - [ ] PDF export button
  - [ ] Clone event button

- [ ] Add new tabs or sections:
  - [ ] Announcements (AnnouncementsFeed)
  - [ ] Timeline (TimelineView)
  - [ ] Analytics (EventAnalytics)

### Data Fetching
- [ ] Add fetch for `rounds` table
- [ ] Add fetch for `score_history` table
- [ ] Add subscription for `announcements` real-time
- [ ] Add subscription for `rounds` real-time
- [ ] Update existing match/team/poll fetches if needed

### User Interactions
- [ ] Test CSV import with sample data
- [ ] Test CSV export for all document types
- [ ] Test event cloning with different options
- [ ] Test theme color customization
- [ ] Test event status transitions
- [ ] Test announcement creation and markdown rendering
- [ ] Test PDF generation for leaderboard/matches/polls
- [ ] Test timeline view data population

## Optional Enhancements (Phase 6.3)

- [ ] Create Task manager UI in EventPage
- [ ] Create task assignment component
- [ ] Create task scoring form
- [ ] Aggregate leaderboard by task_scores instead of team.score

## Optional Enhancements (Phase 7.6)

- [ ] Create custom roles management UI
- [ ] Add role selector to user management
- [ ] Update RLS policies to check custom_roles
- [ ] Create permission matrix builder

## Testing

### Unit Tests
- [ ] CSV parse/export functions
- [ ] Bracket generation (Swiss pairing)
- [ ] Theme color injection
- [ ] PDF generation

### Integration Tests
- [ ] Event cloning creates correct records
- [ ] Announcements real-time updates
- [ ] Status transitions prevent invalid actions
- [ ] Analytics compute correct metrics
- [ ] Metadata templates save/load
- [ ] CSV import validation

### E2E Tests
- [ ] Create event → Clone event → Verify cloned event
- [ ] Post announcement → See in feed → Edit → Delete
- [ ] Change event status → Verify features locked
- [ ] Export CSV → Import CSV → Verify data
- [ ] Generate PDF → Open file → Verify format
- [ ] Customize theme → Refresh → Colors persist

### Permission Tests
- [ ] Non-event-creator can't clone
- [ ] Non-manager can't post announcements
- [ ] Non-manager can't change status
- [ ] Viewers can see public event announcements
- [ ] Private event announcements hidden from non-participants

## Documentation

- [ ] Create user guide for announcements feature
- [ ] Document CSV import/export format
- [ ] Document event cloning options
- [ ] Add theme customization guide
- [ ] Document event status pipeline
- [ ] Create analytics guide
- [ ] Add troubleshooting section

## Deployment

- [ ] Update database schema on production
- [ ] Deploy code changes
- [ ] Test all features in production
- [ ] Monitor performance (especially PDF generation)
- [ ] Set up analytics collection (optional)

## Post-Launch

- [ ] Gather user feedback on new features
- [ ] Monitor error logs for issues
- [ ] Optimize slow components (PDF generation, CSV parsing)
- [ ] Plan Phase 8 enhancements based on usage
- [ ] Consider implementing custom roles UI
- [ ] Consider task-based scoring UI
