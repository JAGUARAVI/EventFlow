import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate leaderboard PDF
 */
export function generateLeaderboardPDF(eventName, teams) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text('Event Leaderboard', 14, 15);
  doc.setFontSize(11);
  doc.text(`Event: ${eventName}`, 14, 25);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);

  // Table
  const tableData = teams.map((team, idx) => [
    idx + 1,
    team.name,
    team.score || 0,
    team.description || '',
  ]);

  doc.autoTable({
    startY: 40,
    head: [['Rank', 'Team Name', 'Score', 'Description']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 15 },
      1: { cellWidth: 60 },
      2: { halign: 'center', cellWidth: 30 },
      3: { cellWidth: 45 },
    },
  });

  return doc;
}

/**
 * Generate match results PDF
 */
export function generateMatchesPDF(eventName, matches, teamMap) {
  const doc = new jsPDF('l'); // landscape

  // Header
  doc.setFontSize(18);
  doc.text('Match Results', 14, 15);
  doc.setFontSize(11);
  doc.text(`Event: ${eventName}`, 14, 25);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);

  // Group by round
  const byRound = {};
  matches.forEach((m) => {
    const round = m.round || 0;
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push(m);
  });

  let yPosition = 40;

  Object.keys(byRound)
    .sort((a, b) => a - b)
    .forEach((round) => {
      const roundMatches = byRound[round];

      doc.setFontSize(12);
      doc.text(`Round ${round}`, 14, yPosition);
      yPosition += 8;

      const tableData = roundMatches.map((m) => [
        m.position || '',
        teamMap[m.team_a_id] || 'TBD',
        m.team_a_score !== undefined ? m.team_a_score : '-',
        m.team_b_score !== undefined ? m.team_b_score : '-',
        teamMap[m.team_b_id] || 'TBD',
        teamMap[m.winner_id] || '-',
        m.status,
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['#', 'Team A', 'Score', 'Score', 'Team B', 'Winner', 'Status']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 35 },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'center', cellWidth: 15 },
          4: { cellWidth: 35 },
          5: { cellWidth: 30 },
          6: { halign: 'center', cellWidth: 20 },
        },
      });

      yPosition = doc.lastAutoTable.finalY + 12;

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 15;
      }
    });

  return doc;
}

/**
 * Generate poll results PDF
 */
export function generatePollsPDF(eventName, polls, votes) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text('Poll Results', 14, 15);
  doc.setFontSize(11);
  doc.text(`Event: ${eventName}`, 14, 25);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);

  let yPosition = 40;

  polls.forEach((poll, pollIdx) => {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 15;
    }

    doc.setFontSize(12);
    doc.text(`${pollIdx + 1}. ${poll.question}`, 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.text(`Type: ${poll.poll_type} | Status: ${poll.status}`, 14, yPosition);
    yPosition += 6;

    // Count votes per option
    const optionVotes = {};
    const pollVotes = votes.filter((v) => v.poll_id === poll.id);

    poll.options?.forEach((opt) => {
      optionVotes[opt.id] = {
        label: opt.label,
        count: pollVotes.filter((v) => v.option_id === opt.id).length,
        points: opt.points,
      };
    });

    const totalVotes = pollVotes.length;

    const tableData = Object.values(optionVotes).map((opt) => [
      opt.label,
      opt.count,
      totalVotes > 0 ? `${Math.round((opt.count / totalVotes) * 100)}%` : '0%',
      opt.points,
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [['Option', 'Votes', 'Percentage', 'Points']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 20 },
      },
    });

    yPosition = doc.lastAutoTable.finalY + 10;
  });

  return doc;
}

/**
 * Generate event summary PDF
 */
export function generateEventSummaryPDF(event, teams, matches, polls) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text(event.name, 14, 15);

  doc.setFontSize(11);
  let yPosition = 30;

  const summary = [
    ['Description', event.description || 'N/A'],
    ['Status', event.status],
    ['Visibility', event.visibility],
    ['Types', (event.types || []).join(', ')],
    ['Teams', teams?.length || 0],
    ['Matches', matches?.length || 0],
    ['Completed Matches', matches?.filter((m) => m.status === 'completed').length || 0],
    ['Polls', polls?.length || 0],
    ['Created', new Date(event.created_at).toLocaleDateString()],
    ['Last Updated', new Date(event.updated_at).toLocaleDateString()],
  ];

  const tableData = summary.map((row) => [row[0], String(row[1])]);

  doc.autoTable({
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 100 },
    },
  });

  return doc;
}

/**
 * Save PDF to file
 */
export function savePDF(doc, filename) {
  doc.save(filename);
}
