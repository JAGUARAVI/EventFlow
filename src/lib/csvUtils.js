/**
 * CSV import/export utilities for events, teams, and results
 */

/**
 * Export teams to CSV format
 * @param {Array} teams - Team objects with id, name, score, metadata, etc.
 * @param {string} format - 'simple' (name, score) or 'detailed' (includes metadata)
 * @returns {string} CSV content
 */
export function exportTeamsToCSV(teams, format = 'simple') {
  if (!teams || teams.length === 0) {
    return '';
  }

  let headers = [];
  let rows = [];

  if (format === 'simple') {
    headers = ['Team Name', 'Score', 'Description'];
    rows = teams.map((t) => [
      escapeCSV(t.name),
      t.score || 0,
      escapeCSV(t.description || ''),
    ]);
  } else if (format === 'detailed') {
    headers = ['Team Name', 'Score', 'Description', 'POC User ID', 'Metadata'];
    rows = teams.map((t) => [
      escapeCSV(t.name),
      t.score || 0,
      escapeCSV(t.description || ''),
      t.poc_user_id || '',
      escapeCSV(JSON.stringify(t.metadata || {})),
    ]);
  }

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csv;
}

/**
 * Export event summary to CSV
 */
export function exportEventToCSV(event) {
  const rows = [
    ['Event Name', event.name],
    ['Description', event.description],
    ['Status', event.status],
    ['Visibility', event.visibility],
    ['Types', (event.types || []).join('; ')],
    ['Created By', event.created_by],
    ['Created At', event.created_at],
  ];

  return rows.map((r) => `${r[0]},${escapeCSV(r[1] || '')}`).join('\n');
}

/**
 * Export match results (bracket) to CSV
 */
export function exportMatchesToCSV(matches, teamMap = {}) {
  if (!matches || matches.length === 0) {
    return '';
  }

  const headers = ['Round', 'Match #', 'Team A', 'Score A', 'Team B', 'Score B', 'Winner', 'Status'];
  const rows = matches.map((m) => [
    m.round || 0,
    m.position || 0,
    escapeCSV(teamMap[m.team_a_id] || m.team_a_id || ''),
    m.team_a_score || '',
    escapeCSV(teamMap[m.team_b_id] || m.team_b_id || ''),
    m.team_b_score || '',
    escapeCSV(teamMap[m.winner_id] || m.winner_id || ''),
    m.status,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csv;
}

/**
 * Export poll results to CSV
 */
export function exportPollsToCSV(polls, votes = []) {
  if (!polls || polls.length === 0) {
    return '';
  }

  const lines = [];

  polls.forEach((poll) => {
    lines.push(`Poll: ${escapeCSV(poll.question)}`);
    lines.push(`Type: ${poll.poll_type}`);
    lines.push(`Status: ${poll.status}`);

    const pollVotes = votes.filter((v) => v.poll_id === poll.id);
    const optionCounts = {};

    poll.options?.forEach((opt) => {
      optionCounts[opt.id] = { label: opt.label, count: 0, points: opt.points };
    });

    pollVotes.forEach((v) => {
      if (optionCounts[v.option_id]) {
        optionCounts[v.option_id].count += 1;
      }
    });

    lines.push('Option,Votes,Points');
    Object.values(optionCounts).forEach((opt) => {
      lines.push(`${escapeCSV(opt.label)},${opt.count},${opt.points}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Advanced export for polls including statistical analysis
 * - For each poll: totals, per-option counts & percentages
 * - For numeric polls (vote_to_points): mean, median, stddev, min, max
 * - Entropy of distribution as a measure of dispersion
 * - Raw votes listing and simple time-bucketed counts (per-minute)
 */
export function exportPollsAnalysisToCSV(polls, votes = []) {
  if (!polls || polls.length === 0) return "";

  const lines = [];

  const safe = (v) => (v === null || v === undefined ? "" : v);

  // helper stats
  const numericStats = (arr) => {
    const n = arr.length;
    if (n === 0) return { count: 0 };
    const nums = arr.map(Number).filter((x) => !Number.isNaN(x));
    const count = nums.length;
    const mean = nums.reduce((s, x) => s + x, 0) / count;
    const sorted = nums.slice().sort((a, b) => a - b);
    const median = count % 2 === 1 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const variance = nums.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / count;
    const stddev = Math.sqrt(variance);
    // mode (may be multiple, return most frequent)
    const freq = {};
    nums.forEach((x) => (freq[x] = (freq[x] || 0) + 1));
    let mode = null;
    let modeCount = 0;
    Object.keys(freq).forEach((k) => {
      if (freq[k] > modeCount) {
        modeCount = freq[k];
        mode = Number(k);
      }
    });
    return { count, mean, median, stddev, variance, min, max, mode };
  };

  const shannonEntropy = (counts) => {
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    if (total === 0) return 0;
    let e = 0;
    Object.values(counts).forEach((c) => {
      if (c <= 0) return;
      const p = c / total;
      e -= p * Math.log2(p);
    });
    return e;
  };

  polls.forEach((poll) => {
    lines.push(`Poll:,${escapeCSV(poll.question || '')}`);
    lines.push(`Poll ID:,${poll.id}`);
    lines.push(`Type:,${poll.poll_type || ''}`);
    lines.push(`Status:,${poll.status || ''}`);
    lines.push(`Created At:,${poll.created_at || ''}`);

    const pollVotes = votes.filter((v) => v.poll_id === poll.id);

    // prepare option map
    const optionMap = {};
    poll.options?.forEach((opt) => {
      optionMap[opt.id] = { label: opt.label, points: opt.points || 0, count: 0 };
    });

    // collect numeric values for numeric polls
    const numericValuesByOption = {};
    pollVotes.forEach((v) => {
      if (!optionMap[v.option_id]) return;
      optionMap[v.option_id].count = (optionMap[v.option_id].count || 0) + 1;
      if (poll.poll_type === 'vote_to_points' && v.value !== undefined) {
        numericValuesByOption[v.option_id] = numericValuesByOption[v.option_id] || [];
        numericValuesByOption[v.option_id].push(Number(v.value));
      }
    });

    const totalVotes = pollVotes.length;

    lines.push(`Total Votes:,${totalVotes}`);
    lines.push('');

    // Option summary
    lines.push('Option,Count,Percentage,Points');
    Object.values(optionMap).forEach((o) => {
      const pct = totalVotes > 0 ? ((o.count / totalVotes) * 100).toFixed(2) + '%' : '0%';
      lines.push(`${escapeCSV(o.label)},${o.count},${pct},${safe(o.points)}`);
    });

    // Entropy as distribution metric
    const countsForEntropy = {};
    Object.values(optionMap).forEach((o) => (countsForEntropy[o.label] = o.count));
    lines.push(`Entropy (bits),${shannonEntropy(countsForEntropy).toFixed(4)}`);

    // Numeric analysis for vote_to_points
    if (poll.poll_type === 'vote_to_points') {
      lines.push('');
      lines.push('Option,Count,Mean,Median,StdDev,Min,Max,Mode');
      Object.entries(optionMap).forEach(([optId, o]) => {
        const nums = numericValuesByOption[optId] || [];
        const s = numericStats(nums);
        lines.push(`${escapeCSV(o.label)},${s.count || 0},${safe(s.mean?.toFixed?.(3) ?? '')},${safe(s.median ?? '')},${safe(s.stddev?.toFixed?.(3) ?? '')},${safe(s.min ?? '')},${safe(s.max ?? '')},${safe(s.mode ?? '')}`);
      });
    }

    // Time-bucket simple analysis: votes per minute (ISO minute)
    if (pollVotes.length > 0) {
      const perMinute = {};
      pollVotes.forEach((v) => {
        const t = v.created_at ? new Date(v.created_at) : null;
        if (!t) return;
        const key = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2,'0')}-${String(t.getUTCDate()).padStart(2,'0')} ${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`;
        perMinute[key] = (perMinute[key] || 0) + 1;
      });

      lines.push('');
      lines.push('Time Bucket (UTC minute),Votes');
      Object.keys(perMinute).sort().forEach((k) => lines.push(`${k},${perMinute[k]}`));
    }

    // Raw vote dump
    lines.push('');
    lines.push('Raw Votes:');
    lines.push('Vote ID,User ID,Option ID,Option Label,Value,Created At');
    pollVotes.forEach((v) => {
      const opt = optionMap[v.option_id] || { label: '' };
      lines.push(`${v.id || ''},${v.user_id || ''},${v.option_id || ''},${escapeCSV(opt.label || '')},${safe(v.value)},${v.created_at || ''}`);
    });

    // Separator between polls
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Import teams from CSV
 * Expects columns: Team Name, Score (optional), Description (optional)
 * @param {string} csvContent - Raw CSV text
 * @returns {Array} Array of team objects ready for insertion
 */
export function importTeamsFromCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Find column indices
  const nameIdx = headers.findIndex((h) => h.toLowerCase().includes('name'));
  const scoreIdx = headers.findIndex((h) => h.toLowerCase().includes('score'));
  const descIdx = headers.findIndex((h) => h.toLowerCase().includes('description'));

  if (nameIdx === -1) {
    throw new Error('CSV must have a "Team Name" column');
  }

  const teams = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values[nameIdx] || values[nameIdx].trim() === '') continue;

    teams.push({
      name: values[nameIdx].trim(),
      score: scoreIdx !== -1 && values[scoreIdx] ? parseFloat(values[scoreIdx]) : 0,
      description: descIdx !== -1 ? (values[descIdx] || '').trim() : '',
      metadata: {},
    });
  }

  return teams;
}

/**
 * Import teams with custom metadata from CSV
 * Expects first 3 columns: Team Name, Score, Description, then custom metadata fields
 * @param {string} csvContent
 * @param {Array} metadataFields - Field definitions [{name, type}, ...]
 * @returns {Array}
 */
export function importTeamsWithMetadataFromCSV(csvContent, metadataFields = []) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const nameIdx = headers.findIndex((h) => h.toLowerCase().includes('name'));
  if (nameIdx === -1) throw new Error('CSV must have a "Team Name" column');

  const scoreIdx = headers.findIndex((h) => h.toLowerCase().includes('score'));
  const descIdx = headers.findIndex((h) => h.toLowerCase().includes('description'));

  // Map remaining columns to metadata fields
  const metadataIndices = {};
  metadataFields.forEach((field) => {
    const idx = headers.findIndex((h) => h.toLowerCase() === field.name.toLowerCase());
    if (idx !== -1) metadataIndices[field.name] = idx;
  });

  const teams = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values[nameIdx] || values[nameIdx].trim() === '') continue;

    const metadata = {};
    Object.entries(metadataIndices).forEach(([fieldName, idx]) => {
      metadata[fieldName] = values[idx] || '';
    });

    teams.push({
      name: values[nameIdx].trim(),
      score: scoreIdx !== -1 && values[scoreIdx] ? parseFloat(values[scoreIdx]) : 0,
      description: descIdx !== -1 ? (values[descIdx] || '').trim() : '',
      metadata,
    });
  }

  return teams;
}

/**
 * Parse a CSV line, handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Escape a value for CSV (wrap in quotes if needed)
 */
function escapeCSV(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
