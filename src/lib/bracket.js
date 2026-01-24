/**
 * Bracket generation utilities for single-elimination, round-robin, and Swiss formats.
 */

/**
 * Pad array to next power of 2 with null/bye values
 */
function padToPowerOfTwo(teams) {
  let padded = [...teams];
  let length = padded.length;
  if (length === 0 || (length & (length - 1)) === 0) return padded; // already power of 2
  let target = 1;
  while (target < length) target *= 2;
  while (padded.length < target) padded.push(null);
  return padded;
}

/**
 * Generate single-elimination bracket matches.
 * Teams are seeded by order (first team is #1 seed, etc.)
 * Returns array of match objects (unsaved, ready for DB insert).
 */
export function generateSingleElimination(eventId, teams) {
  if (!teams || teams.length === 0) return [];

  const padded = padToPowerOfTwo(teams);
  const matches = [];
  let matchId = 0;
  const matchMap = {}; // map of "round_position" -> match object for seeding

  // Calculate number of rounds
  const numTeams = padded.length;
  const numRounds = Math.log2(numTeams);

  // Generate matches round by round
  for (let round = numRounds - 1; round >= 0; round--) {
    const matchesInRound = Math.pow(2, round);
    for (let pos = 0; pos < matchesInRound; pos++) {
      const match = {
        event_id: eventId,
        bracket_type: 'single_elim',
        round,
        position: pos,
        team_a_id: null,
        team_b_id: null,
        next_match_id: null,
        next_match_slot: null,
        status: 'pending',
      };

      // For first round (highest round #), seed teams
      if (round === numRounds - 1) {
        const teamIndex1 = pos * 2;
        const teamIndex2 = pos * 2 + 1;
        match.team_a_id = padded[teamIndex1]?.id || null;
        match.team_b_id = padded[teamIndex2]?.id || null;
      }

      matches.push(match);
      matchMap[`${round}_${pos}`] = match;
    }
  }

  return matches;
}

/**
 * Generate round-robin bracket: every team plays every other team once.
 * Returns array of match objects.
 */
export function generateRoundRobin(eventId, teams) {
  if (!teams || teams.length < 2) return [];

  const matches = [];
  const teamIds = teams.map((t) => t.id);

  // Generate all pairings (i, j where i < j)
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const match = {
        event_id: eventId,
        bracket_type: 'round_robin',
        round: 0, // all in same "round" (they happen in parallel or sequentially as scheduled)
        position: matches.length,
        group_id: null,
        team_a_id: teamIds[i],
        team_b_id: teamIds[j],
        next_match_id: null,
        next_match_slot: null,
        status: 'pending',
      };
      matches.push(match);
    }
  }

  return matches;
}

/**
 * Generate Swiss system bracket (simplified): pair teams with similar records.
 * This is a minimal implementation:
 * - Round 1: seed teams by initial ranking (leaderboard score), pair highest vs mid
 * - Subsequent rounds: would require tracking wins/losses and re-pairing
 * For now, returns Round 1 pairings only; subsequent rounds must be manually set up.
 */
export function generateSwiss(eventId, teams, numRounds = 3) {
  if (!teams || teams.length < 2) return [];

  const matches = [];
  const teamIds = teams.map((t) => t.id);
  let position = 0;

  // Simple seeding: sort by team ID (or could sort by current leaderboard score)
  const sorted = [...teamIds].sort();

  // Round 1: pair 1st vs mid, 2nd vs mid+1, etc. (snake seeding)
  const mid = Math.ceil(sorted.length / 2);
  const first = sorted.slice(0, mid);
  const second = sorted.slice(mid).reverse();

  for (let i = 0; i < first.length; i++) {
    const match = {
      event_id: eventId,
      bracket_type: 'swiss',
      round: 0,
      position: position++,
      group_id: '0', // group_id = round number for Swiss
      team_a_id: first[i],
      team_b_id: second[i] || null,
      next_match_id: null,
      next_match_slot: null,
      status: 'pending',
    };
    matches.push(match);
  }

  // Future rounds (1, 2, ...) would be generated after Round 1 is completed and winners are known
  // For now, coordinator manually creates them or a backend job pairs by record

  return matches;
}

/**
 * Compute single-elim standings from matches.
 * Returns: { teamId: { wins, losses, placement, isEliminated } }
 */
export function computeSingleElimStandings(matches, teams) {
  const standings = {};
  teams.forEach((t) => {
    standings[t.id] = { teamId: t.id, wins: 0, losses: 0, placement: null, isEliminated: false };
  });

  // Find final match (round 0, position 0 or only completed match at round 0)
  const finalMatch = matches.find((m) => m.round === 0 && m.status === 'completed');

  matches.forEach((match) => {
    if (match.status !== 'completed') return;
    if (!match.team_a_id || !match.team_b_id) return;

    if (match.winner_id === match.team_a_id) {
      standings[match.team_a_id].wins += 1;
      standings[match.team_b_id].losses += 1;
      standings[match.team_b_id].isEliminated = true;
    } else if (match.winner_id === match.team_b_id) {
      standings[match.team_b_id].wins += 1;
      standings[match.team_a_id].losses += 1;
      standings[match.team_a_id].isEliminated = true;
    }
  });

  // Set placements
  if (finalMatch && finalMatch.winner_id) {
    standings[finalMatch.winner_id].placement = 1; // 1st place
    if (finalMatch.team_a_id === finalMatch.winner_id) {
      standings[finalMatch.team_b_id].placement = 2; // 2nd place
    } else {
      standings[finalMatch.team_a_id].placement = 2;
    }
  }

  return standings;
}

/**
 * Compute round-robin standings from matches.
 * Returns: { teamId: { wins, losses, score_for, score_against, points } }
 */
export function computeRoundRobinStandings(matches, teams) {
  const standings = {};
  teams.forEach((t) => {
    standings[t.id] = {
      teamId: t.id,
      wins: 0,
      losses: 0,
      draws: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      points: 0, // wins * 3 + draws * 1
    };
  });

  matches.forEach((match) => {
    if (!match.team_a_id || !match.team_b_id) return;

    const scoreA = match.team_a_score || 0;
    const scoreB = match.team_b_score || 0;

    standings[match.team_a_id].scoreFor += scoreA;
    standings[match.team_a_id].scoreAgainst += scoreB;
    standings[match.team_b_id].scoreFor += scoreB;
    standings[match.team_b_id].scoreAgainst += scoreA;

    if (match.status === 'completed') {
      if (match.winner_id === match.team_a_id) {
        standings[match.team_a_id].wins += 1;
        standings[match.team_a_id].points += 3;
        standings[match.team_b_id].losses += 1;
      } else if (match.winner_id === match.team_b_id) {
        standings[match.team_b_id].wins += 1;
        standings[match.team_b_id].points += 3;
        standings[match.team_a_id].losses += 1;
      } else if (scoreA === scoreB) {
        standings[match.team_a_id].draws += 1;
        standings[match.team_b_id].draws += 1;
        standings[match.team_a_id].points += 1;
        standings[match.team_b_id].points += 1;
      }
    }
  });

  return standings;
}

/**
 * Compute Swiss standings from matches.
 * Returns: { teamId: { wins, losses, points, scoreDiff } }
 */
export function computeSwissStandings(matches, teams) {
  const standings = {};
  teams.forEach((t) => {
    standings[t.id] = {
      teamId: t.id,
      wins: 0,
      losses: 0,
      scoreDiff: 0,
      points: 0,
    };
  });

  matches.forEach((match) => {
    if (!match.team_a_id || !match.team_b_id) return;

    const scoreA = match.team_a_score || 0;
    const scoreB = match.team_b_score || 0;

    standings[match.team_a_id].scoreDiff += scoreA - scoreB;
    standings[match.team_b_id].scoreDiff += scoreB - scoreA;

    if (match.status === 'completed') {
      if (match.winner_id === match.team_a_id) {
        standings[match.team_a_id].wins += 1;
        standings[match.team_a_id].points += 3;
        standings[match.team_b_id].losses += 1;
      } else if (match.winner_id === match.team_b_id) {
        standings[match.team_b_id].wins += 1;
        standings[match.team_b_id].points += 3;
        standings[match.team_a_id].losses += 1;
      }
    }
  });

  return standings;
}
