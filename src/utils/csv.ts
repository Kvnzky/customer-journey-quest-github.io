import { Question, GameSession, LeaderboardItem } from '../types';

/**
 * Escapes a cell value for CSV output
 */
export function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Robust CSV line parser handling quotes, commas, and multiline values
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuote = false;

  const chars = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !insideQuote) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Export Questions to CSV string
 */
export function exportQuestionsToCsv(questions: Question[]): string {
  const headers = [
    'Question ID',
    'Question Text',
    'Stage Context',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Answer',
    'Explanation',
    'Category',
    'Points',
    'Status'
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  questions.forEach(q => {
    const formatOptWithScore = (opt?: string) => {
      if (!opt) return '';
      if (q.optionScores && q.optionScores[opt] !== undefined) {
        return `${opt} – Score: ${q.optionScores[opt]}`;
      }
      return opt;
    };

    const row = [
      q.id,
      q.text,
      q.stageDescription || '',
      formatOptWithScore(q.options[0]),
      formatOptWithScore(q.options[1]),
      formatOptWithScore(q.options[2]),
      formatOptWithScore(q.options[3]),
      q.correctAnswer,
      q.explanation || '',
      q.category || 'General',
      q.points || 20,
      q.status || 'published'
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });

  return lines.join('\n');
}

export interface CsvImportValidationResult {
  validQuestions: Question[];
  errors: { row: number; error: string; rawText: string }[];
}

/**
 * Parse and validate Question CSV
 */
export function parseQuestionsCsv(csvText: string): CsvImportValidationResult {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return {
      validQuestions: [],
      errors: [{ row: 1, error: 'CSV file is empty or missing data rows.', rawText: '' }]
    };
  }

  const validQuestions: Question[] = [];
  const errors: { row: number; error: string; rawText: string }[] = [];

  // Determine headers
  const headerRow = rows[0].map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
  const idIdx = headerRow.findIndex(h => h.includes('id'));
  const textIdx = headerRow.findIndex(h => h.includes('question') || h.includes('text') || h.includes('prompt'));
  const optAIdx = headerRow.findIndex(h => h.includes('optiona') || h.includes('opt1') || h === 'a');
  const optBIdx = headerRow.findIndex(h => h.includes('optionb') || h.includes('opt2') || h === 'b');
  const optCIdx = headerRow.findIndex(h => h.includes('optionc') || h.includes('opt3') || h === 'c');
  const optDIdx = headerRow.findIndex(h => h.includes('optiond') || h.includes('opt4') || h === 'd');
  const correctIdx = headerRow.findIndex(h => h.includes('correct') || h.includes('answer'));
  const expIdx = headerRow.findIndex(h => h.includes('explanation') || h.includes('hint'));
  const catIdx = headerRow.findIndex(h => h.includes('category') || h.includes('dept'));
  const ptsIdx = headerRow.findIndex(h => h.includes('point') || h.includes('score'));
  const statusIdx = headerRow.findIndex(h => h.includes('status'));

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const rawPreview = row.slice(0, 3).join(' | ');

    const text = textIdx >= 0 ? row[textIdx] : row[1];
    if (!text || text.trim().length === 0) {
      errors.push({ row: rowNum, error: 'Question text is empty.', rawText: rawPreview });
      continue;
    }

    const options: string[] = [];
    const optionScores: Record<string, number> = {};
    const scoreSuffixRegex = /(?:[–—\-:]\s*(?:score|points?|pts?)\s*[:=]?\s*(\d+)|\(\s*(?:score\s*[:=]?\s*)?(\d+)\s*(?:pts?|points?)?\s*\)|\[\s*(?:score\s*[:=]?\s*)?(\d+)\s*(?:pts?|points?)?\s*\])\s*$/i;

    const rawOpts = [
      optAIdx >= 0 ? row[optAIdx] : row[2],
      optBIdx >= 0 ? row[optBIdx] : row[3],
      optCIdx >= 0 ? row[optCIdx] : row[4],
      optDIdx >= 0 ? row[optDIdx] : row[5]
    ];

    rawOpts.forEach(raw => {
      if (!raw || !raw.trim()) return;
      let optText = raw.trim();
      const scoreMatch = optText.match(scoreSuffixRegex);
      if (scoreMatch) {
        const sc = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3], 10);
        optText = optText.replace(scoreSuffixRegex, '').trim();
        if (!isNaN(sc)) {
          optionScores[optText] = sc;
        }
      }
      options.push(optText);
    });

    if (options.length < 2) {
      errors.push({ row: rowNum, error: 'Question requires at least two answer options.', rawText: rawPreview });
      continue;
    }

    let correctAnswer = correctIdx >= 0 ? row[correctIdx]?.trim() : row[6]?.trim();

    // If options have scores and no correct answer specified, default to highest scoring option
    if (!correctAnswer && Object.keys(optionScores).length > 0) {
      let maxScore = -Infinity;
      let best = '';
      for (const [o, s] of Object.entries(optionScores)) {
        if (s > maxScore) {
          maxScore = s;
          best = o;
        }
      }
      if (best) correctAnswer = best;
    }

    if (!correctAnswer) {
      errors.push({ row: rowNum, error: 'Correct answer is missing.', rawText: rawPreview });
      continue;
    }

    // Clean score suffix from correct answer if present
    correctAnswer = correctAnswer.replace(scoreSuffixRegex, '').trim();

    // Support referencing by letter A, B, C, D
    const upper = correctAnswer.toUpperCase();
    if (upper === 'A' && options[0]) correctAnswer = options[0];
    else if (upper === 'B' && options[1]) correctAnswer = options[1];
    else if (upper === 'C' && options[2]) correctAnswer = options[2];
    else if (upper === 'D' && options[3]) correctAnswer = options[3];

    // Verify correct answer is in options
    const matchFound = options.some(opt => opt.toLowerCase() === correctAnswer.toLowerCase());
    if (!matchFound) {
      errors.push({
        row: rowNum,
        error: `Correct answer "${correctAnswer}" is not among the options.`,
        rawText: rawPreview
      });
      continue;
    }

    // If CSV choices did not contain explicit score suffixes, default to tiered 20, 15, 10, 5 scoring
    if (Object.keys(optionScores).length === 0 && options.length >= 2) {
      optionScores[correctAnswer] = 20;
      const otherOpts = options.filter(o => o.toLowerCase() !== correctAnswer.toLowerCase());
      const remainingTiers = [15, 10, 5];
      otherOpts.forEach((opt, idx) => {
        optionScores[opt] = remainingTiers[idx] !== undefined ? remainingTiers[idx] : 5;
      });
    }

    const category = (catIdx >= 0 && row[catIdx]) ? row[catIdx].trim() : 'General';
    const explanation = (expIdx >= 0 && row[expIdx]) ? row[expIdx].trim() : '';
    const pointsNum = (ptsIdx >= 0 && row[ptsIdx]) ? parseInt(row[ptsIdx], 10) : 20;
    const maxOptionScore = Object.values(optionScores).length > 0 ? Math.max(...Object.values(optionScores)) : 20;
    const points = isNaN(pointsNum) || pointsNum < 1 ? maxOptionScore : pointsNum;
    const rawStatus = (statusIdx >= 0 && row[statusIdx]) ? row[statusIdx].toLowerCase().trim() : 'published';
    const status: 'published' | 'draft' | 'disabled' = 
      rawStatus === 'draft' ? 'draft' : (rawStatus === 'disabled' || rawStatus === 'inactive' ? 'disabled' : 'published');
    const id = (idIdx >= 0 && row[idIdx]?.trim()) ? row[idIdx].trim() : `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    validQuestions.push({
      id,
      text: text.trim(),
      options,
      optionScores: Object.keys(optionScores).length > 0 ? optionScores : undefined,
      correctAnswer,
      explanation,
      category,
      points,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return { validQuestions, errors };
}

/**
 * Export Leaderboard to CSV
 */
export function exportLeaderboardToCsv(entries: LeaderboardItem[]): string {
  const headers = [
    'Rank',
    'Player Name',
    'Score',
    'Correct Answers',
    'Total Questions',
    'Duration (Seconds)',
    'Status',
    'Game Over Reason',
    'Date Played'
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  entries.forEach(item => {
    const row = [
      item.isSharedRank ? `T-${item.rank}` : item.rank,
      item.playerName,
      item.score,
      item.correctCount,
      item.totalQuestions,
      item.durationSeconds,
      item.status,
      item.gameOverReason,
      new Date(item.createdAt).toLocaleString()
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });

  return lines.join('\n');
}

/**
 * Export All Game Sessions to CSV
 */
export function exportSessionsToCsv(sessions: GameSession[]): string {
  const headers = [
    'Session ID',
    'Player Name',
    'Score',
    'Correct Answers',
    'Incorrect Answers',
    'Questions Completed',
    'Total Questions',
    'Duration (Seconds)',
    'Status',
    'Game Over Reason',
    'Date Played'
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  sessions.forEach(s => {
    const row = [
      s.id,
      s.playerName,
      s.score,
      s.correctCount,
      s.incorrectCount,
      s.completedCount,
      s.totalQuestions,
      s.durationSeconds,
      s.status,
      s.gameOverReason,
      new Date(s.createdAt).toLocaleString()
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });

  return lines.join('\n');
}

/**
 * Trigger browser file download
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
