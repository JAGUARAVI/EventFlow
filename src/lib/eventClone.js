import { supabase } from './supabase';

/**
 * Clone an event with optional team, judge, match, and poll duplication
 * @param {string} sourceEventId - Event to clone
 * @param {string} newName - Name for cloned event (defaults to "Original (Copy)")
 * @param {Object} options - Cloning options
 * @returns {Promise<uuid>} ID of newly cloned event
 */
export async function cloneEvent(
  sourceEventId,
  newName = null,
  options = {
    cloneTeams: true,
    cloneJudges: true,
    cloneMatches: false,
    clonePolls: false,
  }
) {
  try {
    const { data, error } = await supabase.rpc('clone_event', {
      source_event_id: sourceEventId,
      new_name: newName,
      clone_teams: options.cloneTeams,
      clone_judges: options.cloneJudges,
      clone_matches: options.cloneMatches,
      clone_polls: options.clonePolls,
    });

    if (error) throw error;

    return data;
  } catch (err) {
    console.error('Clone event failed:', err);
    throw err;
  }
}

/**
 * Get event details for cloning preview
 */
export async function getEventForClonePreview(eventId) {
  try {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('event_id', eventId);

    if (teamsError) throw teamsError;

    const { data: judges, error: judgesError } = await supabase
      .from('event_judges')
      .select('user_id')
      .eq('event_id', eventId);

    if (judgesError) throw judgesError;

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('event_id', eventId);

    if (matchesError) throw matchesError;

    const { data: polls, error: pollsError } = await supabase
      .from('polls')
      .select('id')
      .eq('event_id', eventId);

    if (pollsError) throw pollsError;

    return {
      event,
      teamCount: teams?.length || 0,
      judgeCount: judges?.length || 0,
      matchCount: matches?.length || 0,
      pollCount: polls?.length || 0,
    };
  } catch (err) {
    console.error('Failed to fetch clone preview:', err);
    throw err;
  }
}
