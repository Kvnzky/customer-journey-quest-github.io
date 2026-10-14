import { useState, useEffect, useCallback } from 'react';
import { ScreenState, GameSession, SanitizedQuestion, GameSettings, SyncStatus } from './types';
import { dbManager } from './utils/db';
import { soundManager } from './utils/audio';
import { syncClient } from './utils/syncClient';
import { Header } from './components/Header';
import { StageStepper } from './components/StageStepper';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GameplayScreen } from './components/GameplayScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { AppInfoModal } from './components/AppInfoModal';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './data/defaultQuestions';
import { selectJourneyQuestions, getJourneyOrderedCategories, matchJourneyStage } from './utils/journeySelector';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('welcome');
  const [playerName, setPlayerName] = useState<string>('');
  const [activeQuestions, setActiveQuestions] = useState<SanitizedQuestion[]>([]);
  const [latestSession, setLatestSession] = useState<GameSession | null>(null);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [completedCategories, setCompletedCategories] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state & App info modal
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncClient.getStatus());
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Initialize app & start background auto-sync
  useEffect(() => {
    const initApp = async () => {
      try {
        const s = await syncClient.pullLatestSettings();
        setSettings(s);
        const ordered = getJourneyOrderedCategories(s.categories);
        setCategories(ordered);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    initApp();

    // Start auto-sync client in background
    syncClient.startAutoSync(15000);
    const unsubscribe = syncClient.subscribe(async (status) => {
      setSyncStatus(status);
      try {
        const s = await dbManager.getSettings();
        setSettings(s);
        const ordered = getJourneyOrderedCategories(s.categories);
        setCategories(ordered);
      } catch {}
    });

    return () => {
      unsubscribe();
      syncClient.stopAutoSync();
    };
  }, []);

  const handleStartGame = async (name: string) => {
    setPlayerName(name);
    setErrorMessage(null);

    try {
      // Pull latest synchronized settings from admin portal / sync server before starting
      const currentSettings = await syncClient.pullLatestSettings();
      setSettings(currentSettings);
      const orderedStages = getJourneyOrderedCategories(currentSettings.categories);
      setCategories(orderedStages);

      const allPublished = await dbManager.getPublishedQuestions();
      if (allPublished.length === 0) {
        setErrorMessage('No published questions available in the local library. Please contact your administrator.');
        soundManager.playIncorrect();
        return;
      }

      // Select questions strictly following Customer Journey department sequence:
      // Marketing -> PreSales -> Proposals -> Guardian -> Digital
      const selectedQuestions = selectJourneyQuestions(allPublished, currentSettings);

      // CRITICAL FAIR COMPETITION SANITIZATION:
      // Strip correct answers and explanations before passing to player gameplay state!
      const sanitized = dbManager.sanitizeQuestions(selectedQuestions);
      setActiveQuestions(sanitized);

      setCompletedCategories([]);
      if (sanitized[0]) {
        setActiveCategory(matchJourneyStage(sanitized[0].category, orderedStages));
      } else {
        setActiveCategory(undefined);
      }

      setCurrentScreen('gameplay');
    } catch (err) {
      console.error('Error starting game:', err);
      setErrorMessage('Failed to initialize session. Please try again.');
    }
  };

  const handleQuestionChange = useCallback((_index: number, rawCat: string) => {
    setCategories(prevCats => {
      const stage = matchJourneyStage(rawCat, prevCats);
      setActiveCategory(stage);
      const stageIdx = prevCats.findIndex(c => c.toLowerCase() === stage.toLowerCase());
      if (stageIdx > 0) {
        setCompletedCategories(prevCats.slice(0, stageIdx));
      } else {
        setCompletedCategories([]);
      }
      return prevCats;
    });
  }, []);

  const handleGameEnd = useCallback(async (
    recordedAnswers: { questionId: string; selectedAnswer: string | null; timeSpent: number }[],
    totalDurationSeconds: number,
    reason: 'COMPLETED' | 'TIME_EXPIRED' | 'ABANDONED'
  ) => {
    try {
      // Execute trusted evaluation against local store
      const currentSettings = await dbManager.getSettings();
      const evaluatedSession = await dbManager.evaluateGameCompletion(
        playerName,
        recordedAnswers,
        totalDurationSeconds,
        currentSettings,
        reason
      );

      // Save to local IndexedDB (which also queues it for background sync)
      await dbManager.saveSession(evaluatedSession);
      setLatestSession(evaluatedSession);

      // Submit immediately to central server database and confirm persistence!
      try {
        const syncResult = await syncClient.submitSession(evaluatedSession);
        if (syncResult && syncResult.ok) {
          evaluatedSession.synced = true;
          await dbManager.markSessionsSynced([evaluatedSession.id]);
          setLatestSession({ ...evaluatedSession, synced: true });
        }
      } catch (syncErr) {
        console.warn('Direct score submission queued for background retry:', syncErr);
      }

      if (reason === 'COMPLETED') {
        soundManager.playVictory();
        setCompletedCategories([...categories]);
        setActiveCategory(undefined);
      } else {
        soundManager.playGameOver();
      }

      setCurrentScreen('results');
    } catch (err) {
      console.error('Error ending game:', err);
    }
  }, [playerName, categories]);

  const handlePlayAgain = () => {
    if (playerName) {
      handleStartGame(playerName);
    } else {
      setCompletedCategories([]);
      setActiveCategory(undefined);
      setCurrentScreen('welcome');
    }
  };

  const handleChangePlayer = () => {
    setPlayerName('');
    setLatestSession(null);
    setCompletedCategories([]);
    setActiveCategory(undefined);
    setCurrentScreen('welcome');
  };

  const handleHomeClick = () => {
    if (currentScreen === 'gameplay') {
      if (window.confirm('Do you want to abandon the current quest and return to the main menu?')) {
        setCompletedCategories([]);
        setActiveCategory(undefined);
        setCurrentScreen('welcome');
      }
    } else {
      setCompletedCategories([]);
      setActiveCategory(undefined);
      setCurrentScreen('welcome');
    }
  };

  return (
    <div className="min-h-screen bg-[#060e19] text-white flex flex-col bg-grid-pattern selection:bg-[#38efbf]/20 selection:text-teal-200">
      {/* Top Header (Admin button completely eliminated) */}
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        playerName={playerName}
        onHomeClick={handleHomeClick}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
      />

      {/* Stage Stepper across top */}
      {(currentScreen === 'welcome' || currentScreen === 'gameplay' || currentScreen === 'results') && (
        <StageStepper
          categories={categories}
          activeCategory={activeCategory}
          completedCategories={completedCategories}
        />
      )}

      {/* Main Game Screen Router */}
      <main className="flex-1 flex flex-col justify-center">
        {errorMessage && (
          <div className="max-w-2xl mx-auto px-4 py-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs sm:text-sm text-center">
            {errorMessage}
          </div>
        )}

        {currentScreen === 'welcome' && (
          <WelcomeScreen
            onStartGame={handleStartGame}
            onViewLeaderboard={() => setCurrentScreen('leaderboard')}
            syncStatus={syncStatus}
            initialPlayerName={playerName}
          />
        )}

        {currentScreen === 'gameplay' && (
          <GameplayScreen
            playerName={playerName}
            questions={activeQuestions}
            settings={settings}
            onGameEnd={handleGameEnd}
            onAbortGame={() => {
              setCompletedCategories([]);
              setActiveCategory(undefined);
              setCurrentScreen('welcome');
            }}
            onQuestionChange={handleQuestionChange}
          />
        )}

        {currentScreen === 'results' && latestSession && (
          <ResultsScreen
            session={latestSession}
            onPlayAgain={handlePlayAgain}
            onChangePlayer={handleChangePlayer}
            onViewLeaderboard={() => setCurrentScreen('leaderboard')}
            onReturnHome={() => setCurrentScreen('welcome')}
          />
        )}

        {currentScreen === 'leaderboard' && (
          <LeaderboardScreen
            onBack={() => setCurrentScreen('welcome')}
            activePlayerName={playerName}
            latestSessionId={latestSession?.id}
          />
        )}
      </main>

      {/* App Info Modal */}
      {isInfoModalOpen && (
        <AppInfoModal
          onClose={() => setIsInfoModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
