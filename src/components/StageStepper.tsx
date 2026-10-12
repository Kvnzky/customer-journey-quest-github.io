import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface StageStepperProps {
  categories: string[];
  activeCategory?: string;
  completedCategories?: string[];
  onCategoryClick?: (category: string) => void;
}

export const StageStepper: React.FC<StageStepperProps> = ({
  categories,
  activeCategory,
  completedCategories = [],
  onCategoryClick
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 my-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {categories.map((cat, idx) => {
          const numStr = String(idx + 1).padStart(2, '0');
          const isActive = activeCategory?.toLowerCase() === cat.toLowerCase();
          const isCompleted = completedCategories.some(c => c.toLowerCase() === cat.toLowerCase());

          return (
            <div
              key={cat}
              onClick={() => onCategoryClick && onCategoryClick(cat)}
              className={`relative rounded-lg p-2.5 sm:p-3 border transition-all duration-300 select-none ${
                isActive
                  ? 'bg-[#102a45] border-[#38efbf] shadow-[0_0_15px_rgba(56,239,191,0.25)] ring-1 ring-[#38efbf]/50'
                  : isCompleted
                  ? 'bg-[#091a2e] border-emerald-500/40 opacity-90'
                  : 'bg-[#0a182a]/80 border-[#183658]/70 opacity-70 hover:opacity-100 hover:border-[#254e7d]'
              } ${onCategoryClick ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[10px] sm:text-xs font-semibold tracking-wider font-mono ${
                    isActive ? 'text-[#38efbf]' : isCompleted ? 'text-emerald-400' : 'text-[#7ea0b7]'
                  }`}
                >
                  {numStr}
                </span>
                {isCompleted && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-[#38efbf] animate-ping" />
                )}
              </div>
              <div
                className={`text-xs sm:text-sm font-semibold truncate ${
                  isActive ? 'text-white font-bold' : isCompleted ? 'text-emerald-100' : 'text-slate-300'
                }`}
              >
                {cat}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
