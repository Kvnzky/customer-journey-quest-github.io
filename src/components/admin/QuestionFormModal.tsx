import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { Question } from '../../types';
import { soundManager } from '../../utils/audio';

interface QuestionFormModalProps {
  initialQuestion?: Question | null;
  categories: string[];
  existingQuestions: Question[];
  onSave: (question: Question, addAnother?: boolean) => void;
  onCancel: () => void;
  onPreview: (question: Question) => void;
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  initialQuestion,
  categories,
  existingQuestions,
  onSave,
  onCancel,
  onPreview
}) => {
  const isEditing = !!initialQuestion;

  const [text, setText] = useState(initialQuestion?.text || '');
  const [stageDescription, setStageDescription] = useState(initialQuestion?.stageDescription || '');
  const [optA, setOptA] = useState(initialQuestion?.options[0] || '');
  const [optB, setOptB] = useState(initialQuestion?.options[1] || '');
  const [optC, setOptC] = useState(initialQuestion?.options[2] || '');
  const [optD, setOptD] = useState(initialQuestion?.options[3] || '');
  const [scoreA, setScoreA] = useState<number>(
    initialQuestion?.optionScores?.[initialQuestion?.options[0] || ''] ??
    (initialQuestion ? (initialQuestion.correctAnswer === initialQuestion.options[0] ? (initialQuestion.points || 20) : 0) : 20)
  );
  const [scoreB, setScoreB] = useState<number>(
    initialQuestion?.optionScores?.[initialQuestion?.options[1] || ''] ??
    (initialQuestion ? (initialQuestion.correctAnswer === initialQuestion.options[1] ? (initialQuestion.points || 20) : 0) : 15)
  );
  const [scoreC, setScoreC] = useState<number>(
    initialQuestion?.optionScores?.[initialQuestion?.options[2] || ''] ??
    (initialQuestion ? (initialQuestion.correctAnswer === initialQuestion.options[2] ? (initialQuestion.points || 20) : 0) : 10)
  );
  const [scoreD, setScoreD] = useState<number>(
    initialQuestion?.optionScores?.[initialQuestion?.options[3] || ''] ??
    (initialQuestion ? (initialQuestion.correctAnswer === initialQuestion.options[3] ? (initialQuestion.points || 20) : 0) : 5)
  );
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number>(0);
  const [explanation, setExplanation] = useState(initialQuestion?.explanation || '');
  const [category, setCategory] = useState(initialQuestion?.category || categories[0] || 'Marketing');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [points, setPoints] = useState<number>(initialQuestion?.points || 20);
  const [status, setStatus] = useState<'published' | 'draft' | 'disabled'>(
    initialQuestion?.status === 'draft' ? 'draft' : (initialQuestion?.status === 'disabled' ? 'disabled' : 'published')
  );

  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuestion) {
      // Find which option matches correct answer
      const idx = initialQuestion.options.findIndex(o => o === initialQuestion.correctAnswer);
      if (idx >= 0) setCorrectOptionIndex(idx);
    }
  }, [initialQuestion]);

  // Check for duplicate question text
  useEffect(() => {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.length > 10) {
      const duplicate = existingQuestions.find(
        q => q.id !== initialQuestion?.id && q.text.trim().toLowerCase() === trimmed
      );
      if (duplicate) {
        setDuplicateWarning(`Warning: An existing question with identical wording already exists (ID: ${duplicate.id}).`);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [text, existingQuestions, initialQuestion]);

  const validate = (): { valid: boolean; question?: Question; error?: string } => {
    if (!text.trim()) {
      return { valid: false, error: 'Question text / scenario is required.' };
    }

    if (!optA.trim() || !optB.trim()) {
      return { valid: false, error: 'At least Option A and Option B are required.' };
    }

    const options: string[] = [];
    const optionScores: Record<string, number> = {};
    if (optA.trim()) {
      options.push(optA.trim());
      optionScores[optA.trim()] = Number(scoreA) || 0;
    }
    if (optB.trim()) {
      options.push(optB.trim());
      optionScores[optB.trim()] = Number(scoreB) || 0;
    }
    if (optC.trim()) {
      options.push(optC.trim());
      optionScores[optC.trim()] = Number(scoreC) || 0;
    }
    if (optD.trim()) {
      options.push(optD.trim());
      optionScores[optD.trim()] = Number(scoreD) || 0;
    }

    if (options.length < 2) {
      return { valid: false, error: 'Please enter at least 2 distinct answer options.' };
    }

    const maxScore = Math.max(...Object.values(optionScores), points || 20);
    let chosenCorrect = [optA.trim(), optB.trim(), optC.trim(), optD.trim()][correctOptionIndex];
    if (!chosenCorrect || (optionScores[chosenCorrect] ?? 0) < maxScore) {
      const highestOpt = Object.entries(optionScores).find(([_, sc]) => sc === maxScore)?.[0];
      if (highestOpt) chosenCorrect = highestOpt;
    }

    if (!chosenCorrect) {
      return { valid: false, error: 'Selected correct answer option is empty.' };
    }

    const finalCategory = isCustomCategory ? (customCategory.trim() || 'General') : category;
    const id = initialQuestion?.id || `quest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const question: Question = {
      id,
      text: text.trim(),
      stageDescription: stageDescription.trim() || undefined,
      options,
      optionScores,
      correctAnswer: chosenCorrect,
      explanation: explanation.trim(),
      category: finalCategory,
      points: maxScore,
      status,
      createdAt: initialQuestion?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return { valid: true, question };
  };

  const handleSave = (addAnother: boolean = false) => {
    const result = validate();
    if (!result.valid || !result.question) {
      setError(result.error || 'Please correct the validation errors.');
      soundManager.playIncorrect();
      return;
    }

    soundManager.playCorrect();
    onSave(result.question, addAnother);

    if (addAnother) {
      // Reset form
      setText('');
      setStageDescription('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setScoreA(20);
      setScoreB(15);
      setScoreC(10);
      setScoreD(5);
      setExplanation('');
      setCorrectOptionIndex(0);
      setError(null);
      setDuplicateWarning(null);
    }
  };

  const handleTriggerPreview = () => {
    const result = validate();
    if (!result.valid || !result.question) {
      setError(result.error || 'Please fill required fields to preview.');
      return;
    }
    onPreview(result.question);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e19]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#0b1c2d] border border-[#1b3d63] rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#142e4d] mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {isEditing ? 'Edit Question' : 'Add New Question'}
            </h3>
            <p className="text-xs text-[#7ea0b7] mt-0.5">
              Configure question prompt, answer options, and tiered scoring (20, 15, 10, 5 pts)
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132d4b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Stage Description / Role Context */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
              <span>Stage Context / Department Role (Optional)</span>
              <span className="text-[11px] text-[#7ea0b7]">What this group does in the customer journey</span>
            </label>
            <input
              type="text"
              value={stageDescription}
              onChange={(e) => setStageDescription(e.target.value)}
              placeholder="e.g. Marketing creates awareness, understands audiences, and helps the right customers discover relevant capabilities."
              className="w-full px-3.5 py-2 rounded-xl bg-[#081525] border border-[#1b3e64] text-white placeholder-slate-500 focus:outline-none focus:border-[#38efbf] text-sm"
            />
          </div>

          {/* Question Text / Customer Scenario */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Customer Scenario / Question Prompt <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder="Customer scenario: Apex Industries is exploring ways to improve its operations. Your team has one chance to make a relevant first impression."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#081525] border border-[#1b3e64] text-white placeholder-slate-500 focus:outline-none focus:border-[#38efbf] text-sm"
            />
          </div>

          {duplicateWarning && (
            <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Options with Tiered Score Inputs */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
              <span>Answer Options & Weighted Scores <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-[#7ea0b7]">Set points for each choice (e.g. 20 optimal, 15, 10, 5 partial credit)</span>
            </label>

            <div className="space-y-2.5">
              {/* Option A */}
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswerRadio"
                  checked={correctOptionIndex === 0}
                  onChange={() => {
                    setCorrectOptionIndex(0);
                    if (scoreA < 20) setScoreA(20);
                  }}
                  title="Mark Option A as optimal"
                  className="w-4 h-4 accent-[#38efbf] cursor-pointer"
                />
                <span className="w-5 text-xs font-mono font-bold text-[#38efbf]">A.</span>
                <input
                  type="text"
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  placeholder="Option A (Required)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
                />
                <div className="flex items-center gap-1 bg-[#061322] px-2 py-1.5 rounded-lg border border-[#1b3e64]">
                  <span className="text-[10px] font-mono text-[#38efbf] font-bold">Score:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scoreA}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setScoreA(isNaN(val) ? 0 : val);
                    }}
                    className="w-11 text-center text-xs font-mono font-bold bg-[#0b1c2d] border border-[#1d446e] rounded text-white py-0.5 focus:outline-none focus:border-[#38efbf]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">pts</span>
                </div>
              </div>

              {/* Option B */}
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswerRadio"
                  checked={correctOptionIndex === 1}
                  onChange={() => {
                    setCorrectOptionIndex(1);
                    if (scoreB < 20) setScoreB(20);
                  }}
                  title="Mark Option B as optimal"
                  className="w-4 h-4 accent-[#38efbf] cursor-pointer"
                />
                <span className="w-5 text-xs font-mono font-bold text-[#38efbf]">B.</span>
                <input
                  type="text"
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  placeholder="Option B (Required)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
                />
                <div className="flex items-center gap-1 bg-[#061322] px-2 py-1.5 rounded-lg border border-[#1b3e64]">
                  <span className="text-[10px] font-mono text-[#38efbf] font-bold">Score:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scoreB}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setScoreB(isNaN(val) ? 0 : val);
                    }}
                    className="w-11 text-center text-xs font-mono font-bold bg-[#0b1c2d] border border-[#1d446e] rounded text-white py-0.5 focus:outline-none focus:border-[#38efbf]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">pts</span>
                </div>
              </div>

              {/* Option C */}
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswerRadio"
                  checked={correctOptionIndex === 2}
                  onChange={() => {
                    setCorrectOptionIndex(2);
                    if (scoreC < 20) setScoreC(20);
                  }}
                  title="Mark Option C as optimal"
                  className="w-4 h-4 accent-[#38efbf] cursor-pointer"
                />
                <span className="w-5 text-xs font-mono font-bold text-slate-400">C.</span>
                <input
                  type="text"
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  placeholder="Option C (Optional)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
                />
                <div className="flex items-center gap-1 bg-[#061322] px-2 py-1.5 rounded-lg border border-[#1b3e64]">
                  <span className="text-[10px] font-mono text-[#38efbf] font-bold">Score:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scoreC}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setScoreC(isNaN(val) ? 0 : val);
                    }}
                    className="w-11 text-center text-xs font-mono font-bold bg-[#0b1c2d] border border-[#1d446e] rounded text-white py-0.5 focus:outline-none focus:border-[#38efbf]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">pts</span>
                </div>
              </div>

              {/* Option D */}
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctAnswerRadio"
                  checked={correctOptionIndex === 3}
                  onChange={() => {
                    setCorrectOptionIndex(3);
                    if (scoreD < 20) setScoreD(20);
                  }}
                  title="Mark Option D as optimal"
                  className="w-4 h-4 accent-[#38efbf] cursor-pointer"
                />
                <span className="w-5 text-xs font-mono font-bold text-slate-400">D.</span>
                <input
                  type="text"
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  placeholder="Option D (Optional)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
                />
                <div className="flex items-center gap-1 bg-[#061322] px-2 py-1.5 rounded-lg border border-[#1b3e64]">
                  <span className="text-[10px] font-mono text-[#38efbf] font-bold">Score:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scoreD}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setScoreD(isNaN(val) ? 0 : val);
                    }}
                    className="w-11 text-center text-xs font-mono font-bold bg-[#0b1c2d] border border-[#1d446e] rounded text-white py-0.5 focus:outline-none focus:border-[#38efbf]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Explanation & Best Practice Takeaway (Optional)
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder="Why is this answer the most effective business decision?"
              className="w-full px-3.5 py-2 rounded-xl bg-[#081525] border border-[#1b3e64] text-white placeholder-slate-500 focus:outline-none focus:border-[#38efbf] text-sm"
            />
          </div>

          {/* Metadata Row: Category, Points, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Category / Stage
              </label>
              {!isCustomCategory ? (
                <div className="space-y-1">
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__custom__">+ Add Custom Category...</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="New category..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Points */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Points Awarded
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value, 10) || 10)}
                className="w-full px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Question Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'published' | 'draft' | 'disabled')}
                className="w-full px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
              >
                <option value="published">Published (Active in games)</option>
                <option value="draft">Draft (Work in progress)</option>
                <option value="disabled">Disabled (Excluded)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-[#142e4d] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTriggerPreview}
            className="py-2.5 px-4 rounded-xl bg-[#0c243a] hover:bg-[#122e4d] border border-[#1c456f] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#38efbf]" />
            <span>Preview</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-4 rounded-xl bg-transparent hover:bg-[#132d4b] text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            {!isEditing && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="py-2.5 px-4 rounded-xl bg-[#0e2c47] hover:bg-[#153a5c] border border-[#214f7d] text-teal-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save & Add Another</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave(false)}
              className="py-2.5 px-5 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] text-xs font-bold shadow-md cursor-pointer"
            >
              Save Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
