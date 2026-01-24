/**
 * Bracket generation utilities for single-elimination, round-robin, and Swiss formats.
 */

/**
 * Generate matches for a specific round in a multi-round tournament
 * @param {string} eventId
 * @param {string} bracketType - 'single_elim' | 'round_robin' | 'swiss'
 * @param {number} roundNumber - Round index (0, 1, 2, ...)
 * @param {Array} teams - Team objects
 * @param {Array} existingMatches - All matches from previous rounds (for Swiss/RR)
 * @returns {Array} Match objects for this round
 */
export function generateMatchesForRound(eventId, bracketType, roundNumber, teams, existingMatches = []) {
  switch (bracketType) {
    case 'single_elim':
      return generateSingleElimination(eventId, teams);
    case 'round_robin':
      return generateRoundRobin(eventId, teams);
    case 'swiss':
      return generateSwiss(eventId, teams, roundNumber, existingMatches);
    default:
      return [];
  }
}

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
 * Generate Swiss system bracket: pair teams with similar records.
 * Implementation:
 * - Round 1: seed by leaderboard score, use snake pairing (1st vs mid, 2nd vs mid+1, etc.)
 * - Subsequent rounds: pair by record (wins), then by SOS (strength of schedule)
 * 
 * @param {string} eventId - Event UUID
 * @param {Array} teams - Team objects with id and score
 * @param {number} roundNumber - Which round to generate (0 = Round 1, 1 = Round 2, etc.)
 * @param {Array} existingMatches - All matches completed so far (for record lookup)
 * @returns {Array} Match objects for this round
 */
export function generateSwiss(eventId, teams, roundNumber = 0, existingMatches = []) {
  if (!teams || teams.length < 2) return [];

  const matches = [];
  let position = 0;

  if (roundNumber === 0) {
    // Round 1: seed by score, use snake seeding
    const sorted = [...teams].sort((a, b) => (b.score || 0) - (a.score || 0));
    const mid = Math.ceil(sorted.length / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid).reverse();

    for (let i = 0; i < first.length; i++) {
      const match = {
        event_id: eventId,
        bracket_type: 'swiss',
        round: roundNumber,
        position: position++,
        team_a_id: first[i].id,
        team_b_id: second[i]?.id || null,
        next_match_id: null,
        next_match_slot: null,
        status: 'pending',
      };
      matches.push(match);
    }
  } else {
    // Subsequent rounds: pair by record and strength of schedule (SOS)
    const records = computeSwissRecords(teams, existingMatches);
    const paired = swissRoundPairing(teams, records, existingMatches);

    for (const pair of paired) {
      const match = {
        event_id: eventId,
        bracket_type: 'swiss',
        round: roundNumber,
        position: position++,
        team_a_id: pair.a,
        team_b_id: pair.b,
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
 * Compute Swiss records (wins/losses/SOS) for each team
 */
function computeSwissRecords(teams, existingMatches) {
  const records = {};
  teams.forEach((t) => {
    records[t.id] = { wins: 0, losses: 0, sos: 0, opponents: new Set() };
  });

  existingMatches.forEach((match) => {
    if (!match.team_a_id || !match.team_b_id || match.status !== 'completed') return;

    records[match.team_a_id].opponents.add(match.team_b_id);
    records[match.team_b_id].opponents.add(match.team_a_id);

    if (match.winner_id === match.team_a_id) {
      records[match.team_a_id].wins += 1;
      records[match.team_b_id].losses += 1;
    } else if (match.winner_id === match.team_b_id) {
      records[match.team_b_id].wins += 1;
      records[match.team_a_id].losses += 1;
    }
  });

  // Compute SOS (sum of opponent wins)
  existingMatches.forEach((match) => {
    if (!match.team_a_id || !match.team_b_id) return;
    records[match.team_a_id].sos += records[match.team_b_id].wins;
    records[match.team_b_id].sos += records[match.team_a_id].wins;
  });

  return records;
}

/**
 * Swiss round pairing: match teams with same record, avoid rematches
 */
function swissRoundPairing(teams, records, existingMatches) {
  const paired = [];
  const used = new Set();

  // Sort teams by (wins DESC, sos DESC)
  const sorted = [...teams].sort((a, b) => {
    const aWins = records[a.id].wins;
    const bWins = records[b.id].wins;
    if (aWins !== bWins) return bWins - aWins;
    return records[b.id].sos - records[a.id].sos;
  });

  // Greedy pairing: match highest vs next available
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;

    const teamA = sorted[i];
    let teamB = null;

    // Find best match: same record, hasn't played yet
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      if (records[teamA.id].wins !== records[sorted[j].id].wins) break; // different records
      if (records[teamA.id].opponents.has(sorted[j].id)) continue; // already played
      teamB = sorted[j];
      break;
    }

    // If no same-record pairing, match with next available (different record OK)
    if (!teamB) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(sorted[j].id)) continue;
        if (records[teamA.id].opponents.has(sorted[j].id)) continue;
        teamB = sorted[j];
        break;
      }
    }

    if (teamB) {
      paired.push({ a: teamA.id, b: teamB.id });
      used.add(teamA.id);
      used.add(teamB.id);
    } else if (!used.has(teamA.id)) {
      // Bye
      paired.push({ a: teamA.id, b: null });
      used.add(teamA.id);
    }
  }

  return paired;
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
