import { Question } from '../types';
import { parseQuestionsCsv, CsvImportValidationResult } from './csv';

/**
 * Extracts plain text from a Word (.docx / .doc) ArrayBuffer
 */
export async function extractTextFromWord(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/**
 * Extracts text from all pages of a PDF ArrayBuffer using pdfjs-dist
 */
export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const [pdfjsLib, pdfWorkerMod] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.mjs?url')
  ]);
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerMod.default;
  } catch (e) {
    console.warn('PDF Worker assignment notice:', e);
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items.map((item: any) => item.str || '');
    fullText += pageStrings.join(' ') + '\n\n';
  }

  return fullText;
}

/**
 * Converts Excel (.xlsx / .xls) ArrayBuffer to CSV format
 */
export async function convertExcelToCsv(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return '';
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}

/**
 * Parses freeform question blocks extracted from Word or PDF documents
 */
export function parseQuestionsFromDocumentText(rawText: string): CsvImportValidationResult {
  // If the document content is table-formatted or CSV-like, try CSV parser first
  if (rawText.includes(',') && /question/i.test(rawText) && (/option/i.test(rawText) || /answer/i.test(rawText))) {
    const csvResult = parseQuestionsCsv(rawText);
    if (csvResult.validQuestions.length > 0) {
      return csvResult;
    }
  }

  const validQuestions: Question[] = [];
  const errors: { row: number; error: string; rawText: string }[] = [];

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (rawLines.length === 0) {
    return {
      validQuestions: [],
      errors: [{ row: 1, error: 'Document contains no readable text.', rawText: '' }]
    };
  }

  // Regex identifying start of a new question
  const isQuestionStart = (line: string): boolean => {
    return /^(?:question\s*\d*[:.]?|q\d+[:.]?|\d+[\.\)\:\-]\s+)/i.test(line);
  };

  const questionBlocks: string[][] = [];
  let currentBlock: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (isQuestionStart(line)) {
      if (currentBlock.length > 0) {
        questionBlocks.push(currentBlock);
      }
      currentBlock = [line];
    } else {
      if (currentBlock.length === 0) {
        currentBlock.push(line);
      } else {
        currentBlock.push(line);
      }
    }
  }
  if (currentBlock.length > 0) {
    questionBlocks.push(currentBlock);
  }

  // Option prefix pattern: A), A., (A), [A], a), a., Option A:, etc.
  const optionRegex = /^(?:[\*\-]?\s*)(?:[a-fA-F][\.\)\:\-]|(?:\([a-fA-F]\))|(?:\[[a-fA-F]\])|(?:option\s+[a-fA-F][:.]?))\s*(.*)/i;
  // Answer pattern
  const answerRegex = /^(?:correct\s*(?:answer)?|answer|ans|key)\s*[:=\-]?\s*(.*)/i;
  // Metadata patterns
  const expRegex = /^(?:explanation|hint|rationale|note)\s*[:=\-]?\s*(.*)/i;
  const catRegex = /^(?:category|dept|department|stage)\s*[:=\-]?\s*(.*)/i;
  const stageDescRegex = /^(?:what this group does|group role|stage description|department role)\s*[:=\-]?\s*(.*)/i;
  const scenarioRegex = /^(?:customer scenario|scenario)\s*[:=\-]?\s*(.*)/i;
  const ptsRegex = /^(?:points?|pts?|score)\s*[:=\-]?\s*(\d+)/i;
  // Score suffix pattern on choices: " – Score: 20", " - Score: 5", " (Score: 20)", "(20 pts)", "[5 pts]"
  const scoreSuffixRegex = /(?:[–—\-:]\s*(?:score|points?|pts?)\s*[:=]?\s*(\d+)|\(\s*(?:score\s*[:=]?\s*)?(\d+)\s*(?:pts?|points?)?\s*\)|\[\s*(?:score\s*[:=]?\s*)?(\d+)\s*(?:pts?|points?)?\s*\])\s*$/i;

  questionBlocks.forEach((blockLines, blockIdx) => {
    const blockNum = blockIdx + 1;
    let questionText = '';
    let stageDescription = '';
    const options: string[] = [];
    const optionScores: Record<string, number> = {};
    let detectedCorrectAnswer: string | null = null;
    let explanation = '';
    let category = 'General';
    let points = 20;

    // First line has the question title/prompt
    const firstLine = blockLines[0];
    questionText = firstLine.replace(/^(?:question\s*\d*[:.]?|q\d+[:.]?|\d+[\.\)\:\-]\s*)/i, '').trim();

    for (let li = 1; li < blockLines.length; li++) {
      const line = blockLines[li];

      if (stageDescRegex.test(line)) {
        const match = line.match(stageDescRegex);
        if (match && match[1]) stageDescription = match[1].trim();
      } else if (scenarioRegex.test(line)) {
        const match = line.match(scenarioRegex);
        if (match && match[1]) {
          questionText = match[1].trim();
        }
      } else if (answerRegex.test(line)) {
        const match = line.match(answerRegex);
        if (match && match[1]) {
          detectedCorrectAnswer = match[1].trim();
        }
      } else if (expRegex.test(line)) {
        const match = line.match(expRegex);
        if (match && match[1]) explanation = match[1].trim();
      } else if (catRegex.test(line)) {
        const match = line.match(catRegex);
        if (match && match[1]) {
          const rawCat = match[1].trim();
          // Extract stage name like "Stage 1: Marketing" -> "Marketing"
          const cleanCat = rawCat.replace(/^stage\s*\d*\s*[:.]?\s*/i, '').trim();
          category = cleanCat || rawCat;
        }
      } else if (ptsRegex.test(line)) {
        const match = line.match(ptsRegex);
        if (match && match[1]) points = parseInt(match[1], 10) || 20;
      } else if (optionRegex.test(line)) {
        const isMarkedAsterisk = line.startsWith('*') || /\(\s*correct\s*\)/i.test(line) || /\[x\]/i.test(line);
        const match = line.match(optionRegex);
        let rawOptText = match && match[1]
          ? match[1].replace(/\(\s*correct\s*\)/i, '').replace(/\[x\]/i, '').trim()
          : line.trim();

        // Check for tiered score suffix: " – Score: 20", " - Score: 5", "(20 pts)"
        let parsedOptScore: number | null = null;
        const scoreMatch = rawOptText.match(scoreSuffixRegex);
        if (scoreMatch) {
          const scoreStr = scoreMatch[1] || scoreMatch[2] || scoreMatch[3];
          if (scoreStr !== undefined) {
            parsedOptScore = parseInt(scoreStr, 10);
          }
          rawOptText = rawOptText.replace(scoreSuffixRegex, '').trim();
        }

        if (rawOptText) {
          options.push(rawOptText);
          if (parsedOptScore !== null && !isNaN(parsedOptScore)) {
            optionScores[rawOptText] = parsedOptScore;
          }
          if (isMarkedAsterisk) {
            detectedCorrectAnswer = rawOptText;
          }
        }
      } else {
        if (options.length === 0) {
          // If first line was stage header, this line might be question text
          if (/^stage\s*\d*\s*[:.]?/i.test(questionText) && !stageDescription) {
            const stageMatch = questionText.match(/^stage\s*\d*\s*[:.]?\s*(.*)/i);
            if (stageMatch && stageMatch[1]) category = stageMatch[1].trim();
            questionText = line;
          } else {
            questionText += (questionText ? ' ' : '') + line;
          }
        } else {
          options[options.length - 1] += ' ' + line;
        }
      }
    }

    if (!questionText || questionText.trim().length === 0) {
      errors.push({
        row: blockNum,
        error: `Question ${blockNum}: question text is empty.`,
        rawText: blockLines.slice(0, 2).join(' ')
      });
      return;
    }

    if (options.length < 2) {
      errors.push({
        row: blockNum,
        error: `Question ${blockNum}: requires at least 2 answer choices (found ${options.length}).`,
        rawText: questionText.slice(0, 60)
      });
      return;
    }

    // If options had scores, set the highest scoring option as the correct answer and max points
    const scoreEntries = Object.entries(optionScores);
    if (scoreEntries.length > 0) {
      let maxScore = -Infinity;
      let bestChoice = '';
      for (const [opt, s] of scoreEntries) {
        if (s > maxScore) {
          maxScore = s;
          bestChoice = opt;
        }
      }
      if (maxScore > -Infinity && bestChoice) {
        detectedCorrectAnswer = bestChoice;
        points = maxScore;
      }
    }

    // Resolve correct answer
    let finalCorrectAnswer = '';
    if (detectedCorrectAnswer) {
      const letterMatch = detectedCorrectAnswer.match(/^[a-fA-F]$|^option\s*([a-fA-F])$/i);
      if (letterMatch) {
        const letter = (letterMatch[1] || letterMatch[0]).toUpperCase();
        const letterIndex = letter.charCodeAt(0) - 65; // 'A' -> 0
        if (letterIndex >= 0 && letterIndex < options.length) {
          finalCorrectAnswer = options[letterIndex];
        }
      } else {
        const matched = options.find(o => o.toLowerCase() === detectedCorrectAnswer!.toLowerCase());
        if (matched) {
          finalCorrectAnswer = matched;
        } else {
          const partial = options.find(o =>
            o.toLowerCase().includes(detectedCorrectAnswer!.toLowerCase()) ||
            detectedCorrectAnswer!.toLowerCase().includes(o.toLowerCase())
          );
          if (partial) finalCorrectAnswer = partial;
        }
      }
    }

    // Default to first option if not explicitly specified
    if (!finalCorrectAnswer) {
      finalCorrectAnswer = options[0];
    }

    // If document choices did not contain explicit score suffixes, default to tiered 20, 15, 10, 5 scoring
    if (Object.keys(optionScores).length === 0 && options.length >= 2) {
      optionScores[finalCorrectAnswer] = 20;
      const otherOpts = options.filter(o => o !== finalCorrectAnswer);
      const remainingTiers = [15, 10, 5];
      otherOpts.forEach((opt, idx) => {
        optionScores[opt] = remainingTiers[idx] !== undefined ? remainingTiers[idx] : 5;
      });
      points = 20;
    }

    // Detect standard department category from text if 'General'
    if (category === 'General') {
      const lower = questionText.toLowerCase();
      if (/marketing|lead|brand|mql/i.test(lower)) category = 'Marketing';
      else if (/presales|proof|poc|technical/i.test(lower)) category = 'PreSales';
      else if (/proposal|margin|sla|pricing|contract/i.test(lower)) category = 'Proposals';
      else if (/guardian|compliance|soc|iso|customer success/i.test(lower)) category = 'Guardian';
      else if (/digital|api|adoption|webhook|integration/i.test(lower)) category = 'Digital';
    }

    validQuestions.push({
      id: `q-doc-${Date.now()}-${blockNum}-${Math.random().toString(36).substr(2, 5)}`,
      text: questionText,
      options,
      optionScores: Object.keys(optionScores).length > 0 ? optionScores : undefined,
      stageDescription: stageDescription || undefined,
      correctAnswer: finalCorrectAnswer,
      explanation,
      category,
      points,
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  return { validQuestions, errors };
}

/**
 * Universal file importer supporting CSV, Excel (.xlsx, .xls), Word (.docx, .doc), and PDF (.pdf)
 */
export async function parseUniversalQuestionFile(file: File): Promise<CsvImportValidationResult> {
  const fileName = file.name.toLowerCase();

  // 1. Excel files
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const csvText = await convertExcelToCsv(buffer);
    const csvResult = parseQuestionsCsv(csvText);
    if (csvResult.validQuestions.length > 0) {
      return csvResult;
    }
    // Fallback: document text parser
    return parseQuestionsFromDocumentText(csvText);
  }

  // 2. Word documents
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    const buffer = await file.arrayBuffer();
    const text = await extractTextFromWord(buffer);
    return parseQuestionsFromDocumentText(text);
  }

  // 3. PDF documents
  if (fileName.endsWith('.pdf')) {
    const buffer = await file.arrayBuffer();
    const text = await extractTextFromPdf(buffer);
    return parseQuestionsFromDocumentText(text);
  }

  // 4. Default: Plain text, CSV, TSV
  const text = await file.text();
  const csvResult = parseQuestionsCsv(text);
  if (csvResult.validQuestions.length > 0) {
    return csvResult;
  }
  return parseQuestionsFromDocumentText(text);
}
