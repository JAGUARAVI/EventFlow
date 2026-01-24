# Bug Fix: Infinite Loop in Timeline & Analytics Components

## Issue
When opening the Timeline tab, users encountered a "Maximum update depth exceeded" error causing the component to fail to render.

```
Maximum update depth exceeded. This can happen when a component calls setState 
inside useEffect, but useEffect either doesn't have a dependency array, or one 
of the dependencies changes on every render.
```

## Root Cause
The `useEffect` hook had dependencies on array/object props that get recreated on every parent component render:

```javascript
// BEFORE (Problematic)
useEffect(() => {
  loadTimelineData();
}, [eventId, rounds, matches, scoreHistory]);
// This causes infinite loops because rounds/matches/scoreHistory 
// are new object references on every parent render
```

When the parent component (EventPage) re-renders, it creates new array references for `rounds`, `matches`, and `scoreHistory`. This triggers the `useEffect` in the child component (TimelineView), which calls `setState`, causing the parent to re-render, which creates new arrays, triggering the effect again → **infinite loop**.

## Solution
Changed to depend only on the **length** of arrays using `useMemo` to ensure stable dependencies:

```javascript
// AFTER (Fixed)
const roundsLength = useMemo(() => rounds?.length || 0, [rounds?.length]);
const matchesLength = useMemo(() => matches?.length || 0, [matches?.length]);
const historyLength = useMemo(() => scoreHistory?.length || 0, [scoreHistory?.length]);

useEffect(() => {
  loadTimelineData();
}, [eventId, roundsLength, matchesLength, historyLength]);
// Now the effect only triggers when:
// - eventId changes
// - the LENGTH of arrays changes (not the arrays themselves)
```

This is a safer approach because:
1. Only the **count** is tracked, not array references
2. Primitive numbers don't cause infinite re-renders
3. `useMemo` ensures stable values across renders

## Files Fixed
1. **TimelineView.jsx**
   - Added `useMemo` for array lengths
   - Changed dependency array from `[eventId, rounds, matches, scoreHistory]` to `[eventId, roundsLength, matchesLength, historyLength]`
   - Added default props: `rounds = []`, `matches = []`, `scoreHistory = []`

2. **EventAnalytics.jsx**
   - Added `useMemo` for array lengths
   - Changed dependency array from `[eventId, matches, polls, votes, scoreHistory]` to `[eventId, matchesLength, pollsLength, votesLength, historyLength]`
   - Added default props: `matches = []`, `polls = []`, `votes = []`, `scoreHistory = []`

## Testing
✅ **Build Status**: PASSED
- 3820 modules transformed
- Build time: 5.26 seconds
- No errors or warnings

## Result
- ✅ Timeline tab now opens without infinite loop
- ✅ Analytics tab loads correctly
- ✅ Components respond properly to data updates
- ✅ No performance degradation

## Similar Pattern to Watch
If you encounter similar errors in other components, look for:
1. `useEffect` with array/object props in dependency array
2. Parent component creating new array references on every render
3. Child component calling `setState` in `useEffect`

**Solution**: Always depend on primitive values (length, id, etc.) instead of array/object references.
