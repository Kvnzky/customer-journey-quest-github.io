import { Question, GameSettings } from '../types';
import { DEFAULT_CATEGORIES } from '../data/defaultQuestions';

/**
 * Canonical Customer Journey Department Sequence:
 * 1. Marketing
 * 2. PreSales
 * 3. Proposals
 * 4. Guardian
 * 5. Digital
 */
export const CUSTOMER_JOURNEY_STAGES: readonly string[] = [
  'Marketing',
  'PreSales',
  'Proposals',
  'Guardian',
  'Digital'
];

/**
 * Normalizes and matches any category string to one of the canonical stages or configured stages.
 */
export function matchJourneyStage(
  category: string | undefined | null,
  availableStages: readonly string[] = CUSTOMER_JOURNEY_STAGES
): string {
  if (!category) return availableStages[0] || 'Marketing';
  const clean = category.trim().toLowerCase().replace(/[\s\-_]/g, '');

  if (clean === 'marketing' || clean === 'mkt' || clean === 'market') return 'Marketing';
  if (clean === 'presales' || clean === 'presale' || clean === 'pre-sales' || clean === 'preselling') return 'PreSales';
  if (clean === 'proposals' || clean === 'proposal' || clean === 'props' || clean === 'bids') return 'Proposals';
  if (clean === 'guardian' || clean === 'guard' || clean === 'cs' || clean === 'customersuccess') return 'Guardian';
  if (clean === 'digital' || clean === 'dig' || clean === 'digitaltransformation') return 'Digital';

  // Check in availableStages
  const matched = availableStages.find(
    s => s.trim().toLowerCase().replace(/[\s\-_]/g, '') === clean
  );
  if (matched) return matched;

  return category.trim();
}

/**
 * Returns the list of categories ordered strictly by the Customer Journey flow:
 * Marketing -> PreSales -> Proposals -> Guardian -> Digital -> (any custom categories)
 */
export function getJourneyOrderedCategories(configuredCategories?: string[]): string[] {
  const result: string[] = [...CUSTOMER_JOURNEY_STAGES];

  if (configuredCategories && Array.isArray(configuredCategories)) {
    for (const cat of configuredCategories) {
      const canonical = matchJourneyStage(cat);
      if (!result.includes(canonical) && !result.includes(cat.trim())) {
        result.push(cat.trim());
      }
    }
  }

  return result;
}

/**
 * Computes a numeric sort rank for a category:
 * Marketing = 0, PreSales = 1, Proposals = 2, Guardian = 3, Digital = 4, custom = 5+
 */
export function getJourneyStageRank(category: string, orderedStages?: string[]): number {
  const stages = orderedStages || getJourneyOrderedCategories();
  const canonical = matchJourneyStage(category, stages);
  const idx = stages.findIndex(s => s.toLowerCase() === canonical.toLowerCase());
  return idx >= 0 ? idx : stages.length;
}

/**
 * Groups questions into buckets by their canonical journey stage.
 */
export function groupQuestionsByStage(
  questions: Question[],
  orderedStages: string[]
): Map<string, Question[]> {
  const map = new Map<string, Question[]>();
  for (const stage of orderedStages) {
    map.set(stage, []);
  }

  for (const q of questions) {
    const stage = matchJourneyStage(q.category, orderedStages);
    if (!map.has(stage)) {
      map.set(stage, []);
    }
    map.get(stage)!.push(q);
  }

  return map;
}

/**
 * Selects and sequences questions for a game session strictly according to
 * the Customer Journey department order:
 * 1. Marketing
 * 2. PreSales
 * 3. Proposals
 * 4. Guardian
 * 5. Digital
 * (followed by any extra stages if present).
 *
 * Within each category, questions can be randomly selected or shuffled,
 * but the stage progression NEVER deviates from the Customer Journey sequence.
 */
export function selectJourneyQuestions(
  allPublished: Question[],
  settings: GameSettings
): Question[] {
  if (!allPublished || allPublished.length === 0) return [];

  const targetTotal = Math.min(allPublished.length, settings.questionsPerGame || 5);
  const orderedStages = getJourneyOrderedCategories(settings.categories || DEFAULT_CATEGORIES);
  const stageGroups = groupQuestionsByStage(allPublished, orderedStages);

  // Stages that have at least 1 question
  const activeStages = orderedStages.filter(stage => {
    const list = stageGroups.get(stage);
    return list && list.length > 0;
  });

  if (activeStages.length === 0) {
    return allPublished.slice(0, targetTotal);
  }

  // Allocate quotas round-robin across active stages in journey order
  const quotas = new Map<string, number>();
  for (const stage of activeStages) {
    quotas.set(stage, 0);
  }

  let remaining = targetTotal;
  let round = 0;
  while (remaining > 0) {
    let allocatedThisRound = false;
    for (let i = 0; i < activeStages.length && remaining > 0; i++) {
      const stage = activeStages[(round + i) % activeStages.length];
      const available = stageGroups.get(stage)!.length;
      const current = quotas.get(stage) || 0;
      if (current < available) {
        quotas.set(stage, current + 1);
        remaining--;
        allocatedThisRound = true;
      }
    }
    if (!allocatedThisRound) {
      break; // All stages reached max available questions
    }
    round = (round + 1) % activeStages.length;
  }

  // Build the final question sequence strictly stage-by-stage
  const selected: Question[] = [];

  for (const stage of activeStages) {
    const countNeeded = quotas.get(stage) || 0;
    if (countNeeded <= 0) continue;

    const pool = [...(stageGroups.get(stage) || [])];
    let pickedForStage: Question[] = [];

    if (settings.randomSelection || settings.shuffleQuestions) {
      // Randomly pick countNeeded from this stage's pool without replacement
      for (let i = 0; i < countNeeded && pool.length > 0; i++) {
        const randIdx = Math.floor(Math.random() * pool.length);
        pickedForStage.push(pool.splice(randIdx, 1)[0]);
      }
    } else {
      // Deterministically pick the first countNeeded
      pickedForStage = pool.slice(0, countNeeded);
    }

    if (settings.shuffleQuestions && pickedForStage.length > 1) {
      // Shuffle questions WITHIN this stage only (never breaks stage order!)
      for (let i = pickedForStage.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pickedForStage[i], pickedForStage[j]] = [pickedForStage[j], pickedForStage[i]];
      }
    }

    selected.push(...pickedForStage);
  }

  // Fallback: in case there's any deficit, fill with remaining published questions
  if (selected.length < targetTotal) {
    const usedIds = new Set(selected.map(q => q.id));
    const leftovers = allPublished.filter(q => !usedIds.has(q.id));
    for (const extra of leftovers) {
      if (selected.length >= targetTotal) break;
      selected.push(extra);
    }
    // Re-sort to guarantee journey stage ordering
    selected.sort((a, b) => getJourneyStageRank(a.category, orderedStages) - getJourneyStageRank(b.category, orderedStages));
  }

  return selected;
}
