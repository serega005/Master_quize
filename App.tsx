
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { parseDocxFile } from './services/docxParser';
import { Question, QuizState, QuizMode } from './types';
import { Button } from './components/Button';
import { 
  CheckCircle2, 
  XCircle, 
  FileText, 
  ChevronRight, 
  Trophy, 
  LogOut, 
  Download, 
  BrainCircuit, 
  ClipboardList, 
  Zap, 
  Moon, 
  Sun, 
  Flame, 
  User, 
  Trash2, 
  Star, 
  Clock, 
  ShieldCheck,
  Info,
  LogIn,
  Layers,
  Timer,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';

const SESSION_SIZE = 25;

interface SavedFile {
  id: string;
  name: string;
  questions: Question[];
  timestamp: number;
}

interface TestHistory {
  fileName: string;
  date: number;
  score: number;
  total: number;
  mode: string;
  timeTaken: number;
}

interface ExtendedQuizState extends QuizState {
  currentStreak: number;
  bookmarkedIds: Set<string>;
  secondsElapsed: number;
}

const getScorePlural = (n: number) => {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'баллов';
  if (lastDigit === 1) return 'балл';
  if (lastDigit >= 2 && lastDigit <= 4) return 'балла';
  return 'баллов';
};

const formatTime = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const [state, setState] = useState<ExtendedQuizState>({
    allQuestions: [],
    currentSessionIndices: [],
    solvedIndices: new Set(),
    currentIndex: 0,
    score: 0,
    selectedAnswerIndex: null,
    isAnswerChecked: false,
    status: 'idle',
    mode: null,
    fileName: '',
    currentStreak: 0,
    bookmarkedIds: new Set(),
    secondsElapsed: 0
  });

  const [library, setLibrary] = useState<SavedFile[]>([]);
  const [history, setHistory] = useState<TestHistory[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('is_logged_in') === 'true');
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const savedLib = localStorage.getItem('quiz_library');
    if (savedLib) setLibrary(JSON.parse(savedLib));
    const savedHistory = localStorage.getItem('quiz_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const savedBookmarks = localStorage.getItem('quiz_bookmarks');
    if (savedBookmarks) {
      try {
        setState(s => ({ ...s, bookmarkedIds: new Set(JSON.parse(savedBookmarks)) }));
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => { localStorage.setItem('quiz_library', JSON.stringify(library)); }, [library]);
  useEffect(() => { localStorage.setItem('quiz_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('quiz_bookmarks', JSON.stringify(Array.from(state.bookmarkedIds))); }, [state.bookmarkedIds]);
  useEffect(() => { localStorage.setItem('is_logged_in', isLoggedIn.toString()); }, [isLoggedIn]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Управление таймером
  useEffect(() => {
    if (state.status === 'quiz') {
      timerRef.current = window.setInterval(() => {
        setState(prev => ({ ...prev, secondsElapsed: prev.secondsElapsed + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.status]);

  const toggleTheme = useCallback(() => setTheme(prev => (prev === 'light' ? 'dark' : 'light')), []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setState(prev => ({ ...prev, status: 'loading', fileName: file.name }));
    try {
      const parsedQuestions = await parseDocxFile(file);
      if (parsedQuestions.length === 0) {
        alert("Вопросы не найдены.");
        setState(prev => ({ ...prev, status: 'idle' }));
        return;
      }
      if (!library.find(f => f.name === file.name)) {
        const newFile: SavedFile = { id: Date.now().toString(), name: file.name, questions: parsedQuestions, timestamp: Date.now() };
        setLibrary(prev => [newFile, ...prev].slice(0, 10));
      }
      setState(prev => ({ ...prev, allQuestions: parsedQuestions, status: 'mode_selection' }));
    } catch (err) {
      alert("Ошибка: " + (err as Error).message);
      setState(prev => ({ ...prev, status: 'idle' }));
    }
  };

  const loadFromLibrary = (file: SavedFile) => {
    setShowUserMenu(false);
    setState(prev => ({ ...prev, allQuestions: file.questions, fileName: file.name, status: 'mode_selection' }));
  };

  const deleteFromFileLibrary = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Удалить файл из библиотеки?")) setLibrary(prev => prev.filter(f => f.id !== id));
  };

  const startSession = (mode: QuizMode) => {
    setShowUserMenu(false);
    let indices: number[] = [];
    const allIndices = state.allQuestions.map((_, i) => i);
    if (mode === 'test') {
      indices = [...allIndices].sort(() => Math.random() - 0.5).slice(0, Math.min(SESSION_SIZE, state.allQuestions.length));
    } else if (mode === 'speedrun') {
      indices = [...allIndices].sort(() => Math.random() - 0.5);
    } else if (mode === 'favorites') {
      indices = allIndices.filter(i => state.bookmarkedIds.has(state.allQuestions[i].id));
      if (indices.length === 0) { alert("У вас еще нет избранных вопросов!"); return; }
    } else {
      const unsolved = allIndices.filter(i => !state.solvedIndices.has(i));
      indices = (unsolved.length > 0 ? unsolved : allIndices).sort(() => Math.random() - 0.5).slice(0, Math.min(SESSION_SIZE, unsolved.length || allIndices.length));
    }
    setState(prev => ({ 
      ...prev, 
      mode, 
      currentSessionIndices: indices, 
      currentIndex: 0, 
      score: 0, 
      selectedAnswerIndex: null, 
      isAnswerChecked: false, 
      status: 'quiz', 
      currentStreak: 0,
      secondsElapsed: 0 
    }));
  };

  const toggleBookmark = (id: string) => {
    setState(prev => {
      const newBookmarks = new Set(prev.bookmarkedIds);
      if (newBookmarks.has(id)) newBookmarks.delete(id);
      else newBookmarks.add(id);
      return { ...prev, bookmarkedIds: newBookmarks };
    });
  };

  const longCorrectStats = useMemo(() => {
    if (state.allQuestions.length === 0) return null;
    const longCorrect = state.allQuestions.filter(q => {
      const lengths = q.answers.map(a => a.text.length);
      const maxLength = Math.max(...lengths);
      const correctAns = q.answers.find(a => a.isCorrect);
      return correctAns && correctAns.text.length === maxLength;
    }).length;
    return {
      count: longCorrect,
      total: state.allQuestions.length,
      percent: Math.round((longCorrect / state.allQuestions.length) * 100)
    };
  }, [state.allQuestions]);

  const checkAnswer = useCallback(() => {
    if (state.selectedAnswerIndex === null) return;
    const globalIdx = state.currentSessionIndices[state.currentIndex];
    const q = state.allQuestions[globalIdx];
    const isCorrect = state.selectedAnswerIndex === q.correctIndex;
    setState(prev => ({ 
      ...prev, 
      isAnswerChecked: true, 
      score: isCorrect ? prev.score + 1 : prev.score, 
      currentStreak: isCorrect ? prev.currentStreak + 1 : 0 
    }));
  }, [state.currentIndex, state.currentSessionIndices, state.allQuestions, state.selectedAnswerIndex]);

  const nextQuestion = useCallback(() => {
    if (state.currentIndex + 1 >= state.currentSessionIndices.length) {
      const isCorrect = state.selectedAnswerIndex === state.allQuestions[state.currentSessionIndices[state.currentIndex]].correctIndex;
      const finalScore = state.score + (state.isAnswerChecked && isCorrect ? 1 : 0);
      const newHistory: TestHistory = { 
        fileName: state.fileName, 
        date: Date.now(), 
        score: finalScore, 
        total: state.currentSessionIndices.length, 
        mode: state.mode || 'test',
        timeTaken: state.secondsElapsed
      };
      setHistory(prev => [newHistory, ...prev].slice(0, 20));
      setState(prev => ({ ...prev, status: 'result' }));
    } else {
      setState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, selectedAnswerIndex: null, isAnswerChecked: false }));
    }
  }, [state.currentIndex, state.currentSessionIndices, state.score, state.fileName, state.mode, state.isAnswerChecked, state.selectedAnswerIndex, state.allQuestions, state.secondsElapsed]);

  const goHome = () => { setState(s => ({ ...s, status: 'idle', allQuestions: [], fileName: '' })); };

  const renderContent = () => {
    switch (state.status) {
      case 'idle':
        return (
          <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in flex flex-col items-center">
            <div className="text-center mb-12">
               <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-3"><FileText className="w-10 h-10 text-white" /></div>
               <h1 className="text-5xl font-black dark:text-white mb-4 tracking-tighter">QuizMaster</h1>
               <p className="text-lg text-slate-500 max-w-md mx-auto">Профессиональный тренажер для подготовки к тестам.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 w-full">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center shadow-sm">
                 <input type="file" accept=".docx" onChange={handleFileUpload} className="hidden" id="docx-upload" />
                 <label htmlFor="docx-upload" className="cursor-pointer group flex flex-col items-center">
                   <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-50 transition-all"><Download className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" /></div>
                   <span className="text-xl font-bold dark:text-white mb-2">Выбрать файл</span>
                   <span className="text-sm text-slate-400">Поддерживается .docx</span>
                 </label>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2"><Clock className="w-4 h-4" /> Библиотека</h3>
                {library.length > 0 ? (
                  <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                    {library.map(file => (
                      <div key={file.id} onClick={() => loadFromLibrary(file)} className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 cursor-pointer flex items-center justify-between shadow-sm transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600"><FileText className="w-5 h-5" /></div>
                          <div className="truncate pr-4">
                            <p className="font-bold text-slate-900 dark:text-white truncate text-sm">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{file.questions.length} вопросов</p>
                          </div>
                        </div>
                        <button onClick={(e) => deleteFromFileLibrary(e, file.id)} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                ) : <div className="flex-1 flex items-center justify-center border border-dashed rounded-3xl text-slate-400 text-sm py-10">Ваша библиотека пока пуста</div>}
              </div>
            </div>

            <div className="w-full max-w-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-100 dark:border-amber-900/30 rounded-[35px] p-8 mx-auto shadow-sm">
               <div className="flex items-center gap-3 mb-4">
                 <div className="bg-amber-100 dark:bg-amber-800 p-2 rounded-xl flex-shrink-0"><Info className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
                 <h3 className="text-xl font-black text-amber-900 dark:text-amber-200">Загрузились не все вопросы?</h3>
               </div>
               <p className="text-amber-800 dark:text-amber-300 text-sm leading-relaxed mb-6">Если программа видит меньше вопросов, чем есть в файле, возможно в документе используются «мягкие переносы» вместо абзацев.</p>
               <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-5 space-y-3">
                 <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Как исправить в Word:</p>
                 <ul className="text-sm text-amber-900 dark:text-amber-200 space-y-2 font-medium">
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div> Нажмите <kbd className="bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm">Ctrl + H</kbd></li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div> В поле «Найти»: введите <code className="bg-amber-100 dark:bg-amber-800 px-1.5 rounded">^l</code> (маленькая L)</li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div> В поле «Заменить на»: введите <code className="bg-amber-100 dark:bg-amber-800 px-1.5 rounded">^p</code></li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div> Нажмите «Заменить всё» и сохраните файл.</li>
                 </ul>
               </div>
            </div>
          </div>
        );
      case 'mode_selection':
        const favsCount = state.allQuestions.filter(q => state.bookmarkedIds.has(q.id)).length;
        const modes = [
          { id: 'test', title: 'Экзамен', desc: 'Случайные 25 вопросов для проверки знаний.', icon: <ClipboardList />, color: 'indigo' },
          { id: 'preparation', title: 'Тренировка', desc: 'Упор на вопросы, в которых вы чаще ошибаетесь.', icon: <BrainCircuit />, color: 'emerald' },
          { id: 'speedrun', title: 'Марафон', desc: 'Все вопросы документа в оригинальном порядке.', icon: <Zap />, color: 'amber' },
          { id: 'favorites', title: 'Избранное', desc: `Ваши отмеченные вопросы (${favsCount}).`, icon: <Star />, color: 'rose', disabled: favsCount === 0 }
        ];

        const getStatsColorClasses = (percent: number) => {
          if (percent < 60) return 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-800';
          if (percent < 72) return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800';
          return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800';
        };

        return (
          <div className="max-w-6xl mx-auto py-12 px-4 animate-in zoom-in-95">
            <div className="text-center mb-12">
               <h2 className="text-4xl font-black mb-4 dark:text-white tracking-tight">Выберите режим обучения</h2>
               {longCorrectStats && (
                 <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border shadow-sm transition-colors duration-500 ${getStatsColorClasses(longCorrectStats.percent)}`}>
                   <Layers className="w-4 h-4" />
                   <span className="text-sm font-bold">Длинные прав. ответы: {longCorrectStats.count} из {longCorrectStats.total} ({longCorrectStats.percent}%)</span>
                 </div>
               )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {modes.map(m => (
                 <button 
                   key={m.id} 
                   disabled={m.disabled} 
                   onClick={() => startSession(m.id as QuizMode)} 
                   className={`group p-8 bg-white dark:bg-slate-900 border-2 rounded-[40px] text-left hover:shadow-2xl transition-all flex flex-col h-full ${m.disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:-translate-y-2'}
                    ${m.color === 'indigo' ? 'border-indigo-100 dark:border-indigo-900/20 hover:border-indigo-500' : ''}
                    ${m.color === 'emerald' ? 'border-emerald-100 dark:border-emerald-900/20 hover:border-emerald-500' : ''}
                    ${m.color === 'amber' ? 'border-amber-100 dark:border-amber-900/20 hover:border-amber-500' : ''}
                    ${m.color === 'rose' ? 'border-rose-100 dark:border-rose-900/20 hover:border-rose-500' : ''}
                   `}
                 >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 shadow-sm
                      ${m.color === 'indigo' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : ''}
                      ${m.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : ''}
                      ${m.color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : ''}
                      ${m.color === 'rose' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600' : ''}
                    `}>
                      {m.icon}
                    </div>
                    <h3 className="text-2xl font-black dark:text-white mb-3">{m.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed flex-grow">{m.desc}</p>
                 </button>
               ))}
            </div>
            <div className="mt-12 text-center"><Button variant="outline" onClick={goHome} className="rounded-full px-10">Вернуться на главную</Button></div>
          </div>
        );
      case 'quiz':
        const q = state.allQuestions[state.currentSessionIndices[state.currentIndex]];
        const isFav = state.bookmarkedIds.has(q.id);
        return (
          <div className="max-w-3xl mx-auto py-8 px-4 animate-in slide-in-from-bottom-8">
            <div className="mb-4 px-2 flex items-center justify-between">
               <div className="flex items-center gap-1.5 opacity-60 overflow-hidden">
                 <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">
                   {state.fileName}
                 </p>
               </div>
               <div className="flex items-center gap-4">
                 {state.currentStreak > 1 && (
                   <div className="flex items-center gap-1 animate-bounce">
                     <Flame className="w-4 h-4 text-orange-500 fill-current" />
                     <span className="text-xs font-black text-orange-600 dark:text-orange-400">Стрик: {state.currentStreak}!</span>
                   </div>
                 )}
                 <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-full text-slate-500 dark:text-slate-400">
                   <Timer className="w-3.5 h-3.5" />
                   <span className="text-xs font-black tabular-nums tracking-wider">{formatTime(state.secondsElapsed)}</span>
                 </div>
               </div>
            </div>

            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 dark:shadow-none">{state.currentIndex + 1}</div>
                <div className="flex flex-col">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Вопрос {state.currentIndex + 1} из {state.currentSessionIndices.length}</p>
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mt-0.5">{state.mode === 'test' ? 'Экзамен' : state.mode === 'preparation' ? 'Тренировка' : 'Марафон'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-white dark:bg-slate-900 border px-4 py-2 rounded-xl text-sm font-black text-indigo-600 shadow-sm">{state.score} {getScorePlural(state.score)}</div>
                <button 
                  onClick={() => toggleBookmark(q.id)} 
                  className={`p-2.5 rounded-xl border-2 transition-all ${isFav ? 'bg-amber-50 border-amber-400 text-amber-500 shadow-sm' : 'border-slate-100 dark:border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-200'}`}
                  title="Добавить в избранное"
                >
                  <Star className={isFav ? 'fill-current' : ''} />
                </button>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-[45px] shadow-2xl mb-8 min-h-[180px] flex items-center border border-slate-100 dark:border-slate-800">
               <p className="text-xl sm:text-2xl font-bold dark:text-white leading-tight">{q.text}</p>
            </div>

            <div className="space-y-4 mb-12">
              {q.shuffledAnswers.map((ans, idx) => {
                let btnStyle = "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-sm";
                let iconStyle = "bg-slate-100 dark:bg-slate-800 text-slate-400 border-2 border-transparent";

                if (state.isAnswerChecked) {
                  if (idx === q.correctIndex) {
                    btnStyle = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-600 dark:border-emerald-500 text-emerald-900 dark:text-emerald-400 shadow-lg shadow-emerald-100 dark:shadow-none ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-950 scale-[1.01]";
                    iconStyle = "bg-emerald-600 text-white border-emerald-600";
                  } else if (state.selectedAnswerIndex === idx) {
                    btnStyle = "bg-rose-50 dark:bg-rose-900/20 border-rose-600 dark:border-rose-500 text-rose-900 dark:text-rose-400 shadow-lg shadow-rose-100 dark:shadow-none ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-slate-950";
                    iconStyle = "bg-rose-600 text-white border-rose-600";
                  } else {
                    btnStyle = "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-40 grayscale-[0.5]";
                    iconStyle = "bg-slate-100 dark:bg-slate-800 text-slate-300 border-slate-100 dark:border-slate-800";
                  }
                } else if (state.selectedAnswerIndex === idx) {
                  btnStyle = "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-600 dark:border-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-none ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950";
                  iconStyle = "bg-indigo-600 text-white border-indigo-600";
                }

                return (
                  <button 
                    key={idx} 
                    disabled={state.isAnswerChecked} 
                    onClick={() => setState(s => ({ ...s, selectedAnswerIndex: idx }))} 
                    className={`w-full p-5 sm:p-6 rounded-[35px] flex items-center gap-5 text-left font-bold transition-all duration-300 ${btnStyle}`}
                  >
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-black transition-all duration-300 ${iconStyle}`}>
                      {state.isAnswerChecked && idx === q.correctIndex ? <CheckCircle2 className="w-6 h-6" /> : 
                       state.isAnswerChecked && state.selectedAnswerIndex === idx ? <XCircle className="w-6 h-6" /> : 
                       String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-base sm:text-lg leading-snug flex-1">{ans.text}</span>
                  </button>
                );
              })}
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg p-5 sm:p-7 rounded-[40px] shadow-2xl flex flex-col sm:flex-row gap-4 justify-between items-center border border-slate-100 dark:border-slate-800">
               <Button variant="outline" className="w-full sm:w-auto px-8 rounded-2xl border-2" onClick={goHome}><LogOut className="w-4 h-4 mr-2" /> Выход</Button>
               {!state.isAnswerChecked ? (
                 <Button className="w-full sm:w-auto px-16 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none py-4 text-lg" disabled={state.selectedAnswerIndex === null} onClick={checkAnswer}>Проверить</Button>
               ) : (
                 <Button className="w-full sm:w-auto px-16 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none py-4 text-lg" onClick={nextQuestion}>Дальше <ChevronRight className="ml-2 w-6 h-6" /></Button>
               )}
            </div>
          </div>
        );
      case 'result':
        const finalPercent = Math.round((state.score / state.currentSessionIndices.length) * 100);
        
        const getResultClasses = (percent: number) => {
          if (percent < 60) return {
            bg: 'bg-rose-50 dark:bg-rose-900/20',
            text: 'text-rose-600 dark:text-rose-400',
            border: 'border-rose-100 dark:border-rose-800/50',
            iconBg: 'bg-rose-100 dark:bg-rose-900/50'
          };
          if (percent < 72) return {
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            text: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-100 dark:border-amber-800/50',
            iconBg: 'bg-amber-100 dark:bg-amber-900/50'
          };
          return {
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            text: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-100 dark:border-emerald-800/50',
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/50'
          };
        };

        const resStyle = getResultClasses(finalPercent);

        return (
          <div className="max-w-4xl mx-auto py-12 px-4 text-center animate-in zoom-in-95">
             <div className={`${resStyle.iconBg} w-32 h-32 rounded-[45px] flex items-center justify-center mx-auto mb-10 shadow-xl transition-all duration-700 rotate-2`}>
               <Trophy className={`w-16 h-16 ${resStyle.text}`} />
             </div>
             
             <h1 className="text-5xl font-black mb-12 dark:text-white tracking-tighter">Поздравляем!</h1>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
               <div className="bg-white dark:bg-slate-900 p-10 rounded-[45px] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                 <div className={`absolute top-0 left-0 w-1.5 h-full ${resStyle.text.split(' ')[0].replace('text', 'bg')}`}></div>
                 <p className={`text-5xl font-black mb-2 transition-transform group-hover:scale-110 ${resStyle.text}`}>{finalPercent}%</p>
                 <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Точность</p>
               </div>
               
               <div className="bg-white dark:bg-slate-900 p-10 rounded-[45px] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col items-center justify-center group">
                 <p className="text-5xl font-black dark:text-white mb-2 transition-transform group-hover:scale-110">{state.score}</p>
                 <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{getScorePlural(state.score)}</p>
               </div>
               
               <div className="bg-white dark:bg-slate-900 p-10 rounded-[45px] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col items-center justify-center group">
                 <div className="flex items-center gap-3 mb-2">
                   <Timer className="w-8 h-8 text-indigo-500" />
                   <p className="text-4xl font-black dark:text-white tabular-nums transition-transform group-hover:scale-110">{formatTime(state.secondsElapsed)}</p>
                 </div>
                 <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Времени затрачено</p>
               </div>
             </div>
             
             <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Button 
                  onClick={() => startSession(state.mode!)} 
                  className="w-full sm:w-auto px-12 h-16 rounded-[25px] text-lg font-black shadow-2xl shadow-indigo-200 dark:shadow-none transition-transform hover:-translate-y-1 active:scale-95"
                >
                  <RefreshCw className="w-5 h-5 mr-3" /> Повторить попытку
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setState(s => ({ ...s, status: 'mode_selection' }))} 
                  className="w-full sm:w-auto px-12 h-16 rounded-[25px] text-lg font-black border-2 transition-transform hover:-translate-y-1 active:scale-95"
                >
                  <LayoutGrid className="w-5 h-5 mr-3" /> К режимам
                </Button>
             </div>
          </div>
        );
      case 'loading':
        return <div className="flex flex-col items-center justify-center py-40"><div className="w-20 h-20 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-8"></div><p className="text-slate-400 font-black uppercase tracking-[0.2em] animate-pulse">Обработка файла...</p></div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <nav className="h-24 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={goHome}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg group-hover:rotate-12 transition-transform"><CheckCircle2 className="w-7 h-7 text-white" /></div>
            <span className="text-2xl font-black dark:text-white tracking-tighter hidden sm:block">QuizMaster</span>
          </div>
          <div className="flex items-center gap-5">
            <button onClick={toggleTheme} className="p-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
              {theme === 'light' ? <Moon className="w-6 h-6 text-slate-600" /> : <Sun className="w-6 h-6 text-amber-400" />}
            </button>
            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl transition-all relative hover:bg-slate-200 dark:hover:bg-slate-700">
                <User className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                <div className={`absolute top-2.5 right-2.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isLoggedIn ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-4 w-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[35px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-7 animate-in fade-in slide-in-from-top-2">
                   <div className="mb-6 pb-6 border-b dark:border-slate-800">
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <ShieldCheck className="w-4 h-4 text-emerald-500" /> Верификация профиля
                     </p>
                     <div className="flex items-center justify-between">
                       <div>
                         <h4 className="font-black text-lg dark:text-white leading-tight">{isLoggedIn ? 'Статус: Верифицирован' : 'Гость'}</h4>
                         <p className="text-[11px] text-slate-500 mt-1">{isLoggedIn ? 'Синхронизация данных активна' : 'Профиль не подтвержден'}</p>
                       </div>
                       {!isLoggedIn && <button onClick={() => setIsLoggedIn(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><LogIn className="w-5 h-5" /></button>}
                     </div>
                   </div>
                   
                   <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Статистика</p>
                        <div className="grid grid-cols-2 gap-2">
                           <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                             <p className="text-xl font-black dark:text-white">{history.length}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">Тестов</p>
                           </div>
                           <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                             <p className="text-xl font-black dark:text-white">{state.bookmarkedIds.size}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">Избранных</p>
                           </div>
                        </div>
                      </div>
                      {isLoggedIn && (
                        <button onClick={() => setIsLoggedIn(false)} className="w-full py-3 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-colors">
                          Выйти из профиля
                        </button>
                      )}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="pb-32">{renderContent()}</main>
    </div>
  );
};

export default App;
