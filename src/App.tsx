import React, { useState, useEffect, useRef } from "react";
import { PlaybackItem, QuestionData, PlayerHistoryItem } from "./types";
import { 
  GraduationCap, 
  BookOpen, 
  History, 
  Clock, 
  HelpCircle, 
  Sparkles, 
  Play, 
  Pause, 
  ChevronRight, 
  ListMusic, 
  BookOpenCheck,
  Award,
  Volume2,
  ListRestart
} from "lucide-react";
import AudioStudioVisualizer from "./components/AudioStudioVisualizer";

interface EditionMeta {
  edition: number;
  title: string;
  questions: {
    id: string;
    title: string;
    scoreText: string;
    subject: string;
  }[];
}

export default function App() {
  // Database States loaded via local JSON fetch
  const [editions, setEditions] = useState<EditionMeta[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<EditionMeta | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  
  // Loading and Search states
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [isEditionLoading, setIsEditionLoading] = useState(false);
  const [searchQuestionTerm, setSearchQuestionTerm] = useState("");
  
  // Playback configuration
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [history, setHistory] = useState<PlayerHistoryItem[]>([]);
  const [isAutoAdvance, setIsAutoAdvance] = useState(true);

  // Speech loop state refs
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const nextTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);
  const isAutoAdvanceRef = useRef(isAutoAdvance);
  const selectedQuestionIndexRef = useRef(selectedQuestionIndex);
  const questionsRef = useRef(questions);

  // 1. Initial Meta loading (Fetch index.json from /data/)
  useEffect(() => {
    async function loadMeta() {
      try {
        setIsMetaLoading(true);
        const res = await fetch("./data/index.json");
        if (!res.ok) {
          throw new Error(`Failed to load index.json: ${res.status}`);
        }
        const data: EditionMeta[] = await res.json();
        setEditions(data);
        if (data.length > 0) {
          setSelectedEdition(data[0]);
        }
      } catch (err) {
        console.error("Error loading editions list index.json:", err);
      } finally {
        setIsMetaLoading(false);
      }
    }
    loadMeta();
  }, []);

  // 2. Load selected edition details (Fetch [edition].json from /data/)
  useEffect(() => {
    if (!selectedEdition) return;

    async function loadEditionDetails() {
      try {
        stopSpeaking();
        setIsEditionLoading(true);
        const res = await fetch(`./data/${selectedEdition?.edition}.json`);
        if (!res.ok) {
          throw new Error(`Failed to load edition detail: ${res.status}`);
        }
        const detailedQuestions: QuestionData[] = await res.json();
        setQuestions(detailedQuestions);
        setSelectedQuestionIndex(0);
        setCurrentIndex(0);
      } catch (err) {
        console.error("Error loading detailed questions:", err);
      } finally {
        setIsEditionLoading(false);
      }
    }
    loadEditionDetails();
  }, [selectedEdition]);

  // Sync states with mutable refs for asynchronous speech loops
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isAutoAdvanceRef.current = isAutoAdvance;
  }, [isAutoAdvance]);

  useEffect(() => {
    selectedQuestionIndexRef.current = selectedQuestionIndex;
  }, [selectedQuestionIndex]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // 3. Load available synthesizers (Only Korean voices)
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const availableVoices = window.speechSynthesis.getVoices();
        const korVoices = availableVoices.filter((v) => v.lang.toLowerCase().includes("ko") || v.lang.toLowerCase().includes("kr"));
        setVoices(korVoices);

        if (korVoices.length > 0 && !selectedVoiceName) {
          // 고품질/프리미엄 한국어 음성 우선순위 (Siri, Premium, Enhanced, Seha, Google 등)
          const highQualityKorVoice = korVoices.find((v) => {
            const name = v.name.toLowerCase();
            return (
              name.includes("siri") ||
              name.includes("premium") ||
              name.includes("enhanced") ||
              name.includes("seha") ||
              name.includes("google")
            );
          });
          const defaultVoice = highQualityKorVoice || korVoices.find((v) => v.default) || korVoices[0];
          setSelectedVoiceName(defaultVoice ? defaultVoice.name : "");
        }
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Load history from localStorage
    const savedHistory = localStorage.getItem("civil-structural-audioplay-history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const activeQuestion = questions[selectedQuestionIndex] || null;
  const playbackItems = activeQuestion ? activeQuestion.items : [];

  // Main speech invocation function for the active question sentence
  const speakCurrentItem = () => {
    if (typeof window === "undefined" || !window.speechSynthesis || playbackItems.length === 0) return;

    // Clear previous speaking session
    window.speechSynthesis.cancel();
    if (nextTimeoutRef.current) clearTimeout(nextTimeoutRef.current);

    const item = playbackItems[currentIndex];
    if (!item) {
      setIsPlaying(false);
      saveToHistory();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    
    // Assign selected voice
    const voiceObj = voices.find((v) => v.name === selectedVoiceName);
    if (voiceObj) {
      utterance.voice = voiceObj;
    }
    
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;

    currentUtteranceRef.current = utterance;

    // Trigger next sentence after this one ends, respecting item.breakMs
    utterance.onend = () => {
      if (!isPlayingRef.current) return;

      const delay = item.breakMs || 400;
      nextTimeoutRef.current = setTimeout(() => {
        if (currentIndex < playbackItems.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          saveToHistory();
          if (isAutoAdvanceRef.current && selectedQuestionIndexRef.current < questionsRef.current.length - 1) {
            // Automatically transits to next exam question
            setSelectedQuestionIndex((prev) => prev + 1);
            setCurrentIndex(0);
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
          }
        }
      }, delay);
    };

    utterance.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      if (e.error !== "interrupted" && isPlayingRef.current) {
        nextTimeoutRef.current = setTimeout(() => {
          if (currentIndex < playbackItems.length - 1) {
            setCurrentIndex((prev) => prev + 1);
          } else {
            if (isAutoAdvanceRef.current && selectedQuestionIndexRef.current < questionsRef.current.length - 1) {
              setSelectedQuestionIndex((prev) => prev + 1);
              setCurrentIndex(0);
              setIsPlaying(true);
            } else {
              setIsPlaying(false);
            }
          }
        }, 400);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Re-run voice synthesizer loop whenever currentIndex, isPlaying status, rate, voice choice, or selected question changes
  useEffect(() => {
    if (isPlaying) {
      speakCurrentItem();
    }
  }, [currentIndex, isPlaying, selectedVoiceName, playbackRate, selectedQuestionIndex]);

  const togglePlayPause = () => {
    if (isPlaying) {
      stopSpeaking();
    } else {
      setIsPlaying(true);
    }
  };

  const stopSpeaking = () => {
    setIsPlaying(false);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (nextTimeoutRef.current) clearTimeout(nextTimeoutRef.current);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const isAlreadyPlaying = isPlaying;
      stopSpeaking();
      setCurrentIndex((prev) => {
        const nextIdx = prev - 1;
        if (isAlreadyPlaying) {
          setTimeout(() => setIsPlaying(true), 50);
        }
        return nextIdx;
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < playbackItems.length - 1) {
      const isAlreadyPlaying = isPlaying;
      stopSpeaking();
      setCurrentIndex((prev) => {
        const nextIdx = prev + 1;
        if (isAlreadyPlaying) {
          setTimeout(() => setIsPlaying(true), 50);
        }
        return nextIdx;
      });
    }
  };

  const handleReset = () => {
    stopSpeaking();
    setCurrentIndex(0);
  };

  // Specific sentence jump
  const handleParagraphClick = (idx: number) => {
    const isAlreadyPlaying = isPlaying;
    stopSpeaking();
    setCurrentIndex(idx);
    if (isAlreadyPlaying) {
      setTimeout(() => setIsPlaying(true), 100);
    } else {
      setIsPlaying(true); // Auto play when clicking dedicated block
    }
  };

  // Save successful listening session to history
  const saveToHistory = () => {
    if (!activeQuestion || !selectedEdition) return;
    const newItem: PlayerHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      edition: selectedEdition.edition,
      questionTitle: activeQuestion.title,
      completedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      durationSeconds: Math.round(playbackItems.length * 4.0),
    };

    const updated = [newItem, ...history.slice(0, 7)];
    setHistory(updated);
    localStorage.setItem("civil-structural-audioplay-history", JSON.stringify(updated));
  };

  // Filtered list of questions based on user searching questions
  const filteredQuestions = questions.filter((q) => {
    const normSearch = searchQuestionTerm.toLowerCase();
    return (
      q.title.toLowerCase().includes(normSearch) ||
      q.subject.toLowerCase().includes(normSearch) ||
      q.items.some((item) => item.text.toLowerCase().includes(normSearch))
    );
  });

  if (isMetaLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" id="loading-fallback">
        <div className="bg-white p-8 rounded-2xl border border-gray-150 shadow-xl max-w-sm text-center space-y-4">
          <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-full animate-pulse">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">기출문제 데이터베이스 로딩 중...</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            125회부터 139회까지의 풍부한 기출 SSML 낭독 스크립트를 조용히 준비하고 있습니다. 잠시만 기다려 주십시오.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 font-sans selection:bg-amber-100 selection:text-amber-950" id="main-application-wrap">
      
      {/* 1. 상단 품격 있는 브랜딩 헤더 */}
      <header className="bg-slate-900 border-b border-slate-800 text-white" id="main-app-header">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 rounded-2xl shadow-xl shadow-amber-500/20">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  기술사 기출답안 낭독 오디오 플레이어
                </h1>
                <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase">
                  V3.0 Pro
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                기출 15회분(125회 ~ 139회) 수록 및 무형 쉼표 교정 탑재 낭독 오디오 플레이어
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3" id="header-counters">
            <div className="bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl text-center">
              <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-mono">가용 회차</span>
              <strong className="text-base font-bold text-amber-400">{editions.length}개 회차</strong>
            </div>
          </div>
        </div>
      </header>

      {/* 2. 메인 대시보드 */}
      <main className="max-w-7xl mx-auto px-6 mt-8" id="dashboard-layout">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-grid">
          
          {/* [좌측 영역 (4 Grid)] - 회차 도서관 & 문제목록 */}
          <div className="lg:col-span-4 space-y-6" id="left-sidebar">
            
            {/* 회차 선택 박스 */}
            <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs" id="edition-selector-card">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-500" />
                <span>1. 기출 회차 선택</span>
              </h3>
              <div className="grid grid-cols-3 gap-2" id="grid-editions">
                {editions.map((edd) => {
                  const isCur = edd.edition === selectedEdition?.edition;
                  return (
                    <button
                      key={edd.edition}
                      onClick={() => setSelectedEdition(edd)}
                      className={`py-2 px-1 text-center font-mono text-sm rounded-xl font-bold border transition-all cursor-pointer ${
                        isCur
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                      id={`btn-edd-${edd.edition}`}
                    >
                      {edd.edition}회
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 회차 내 기출문제 목록 */}
            <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex flex-col" id="questions-list-card">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-indigo-600" />
                  <span>2. {selectedEdition?.edition}회 기출문제 목록</span>
                </h3>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
                  총 {questions.length}문항
                </span>
              </div>

              {/* 간이 기출단어 필터링 인풋 */}
              <input
                type="text"
                placeholder="해당 회차 문제 내용 검색..."
                value={searchQuestionTerm}
                onChange={(e) => setSearchQuestionTerm(e.target.value)}
                className="w-full text-xs py-2 px-3 mb-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="search-question-input"
              />

              {/* 기출문제 일련 리스트 */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1" id="questions-scroller">
                {isEditionLoading ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-[11px] text-gray-400 font-medium">상세 대본을 읽어오는 중...</p>
                  </div>
                ) : filteredQuestions.length > 0 ? (
                  filteredQuestions.map((q, qIdx) => {
                    const originalIndexInRaw = questions.findIndex((orig) => orig.id === q.id);
                    const isSelected = originalIndexInRaw === selectedQuestionIndex;
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          stopSpeaking();
                          setSelectedQuestionIndex(originalIndexInRaw);
                          setCurrentIndex(0);
                        }}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10"
                            : "bg-white text-gray-700 border-gray-150 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                        id={`btn-question-${q.id}`}
                      >
                        <div className="flex justify-between items-center w-full">
                           <span className={`font-bold font-mono tracking-wide ${isSelected ? "text-white" : "text-gray-900"}`}>
                            {q.title}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize ${
                            isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                          }`}>
                            {q.scoreText || "논술형"}
                          </span>
                        </div>
                        <p className={`line-clamp-2 leading-relaxed ${isSelected ? "text-indigo-100" : "text-gray-500"}`}>
                          {q.subject}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400 py-6 text-center italic">
                    일치하는 문항이 없습니다.
                  </p>
                )}
              </div>
            </div>

            {/* 청취 완료 기록장 */}
            <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs" id="history-sidebar-card">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-teal-650" />
                <span>오늘의 완독 이력</span>
              </h3>
              <div className="space-y-2 max-h-[220px] overflow-y-auto" id="history-items-container">
                {history.length > 0 ? (
                  history.map((h, i) => (
                    <div key={h.id || i} className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-xs flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-700">
                          {h.edition}회 기출
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {h.questionTitle || "문제 청취 완료"}
                        </span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] text-slate-405 font-mono flex items-center gap-0.5 text-gray-450">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{h.completedAt}</span>
                        </span>
                        <span className="text-[9px] bg-teal-50 text-teal-700 px-1 py-0.2 rounded mt-0.5 font-bold">
                          약 {h.durationSeconds}초 분량
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 py-4 text-center italic">
                    아직 완료 기록이 없습니다.
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* [우측 영역 (8 Grid)] - 낭독 비주얼라이저 & 지문 리딩 보드 */}
          <div className="lg:col-span-8 space-y-6" id="right-content">
            
            {/* 1. 현재 문제 정보 프리뷰 헤더 */}
            {activeQuestion && selectedEdition && (
              <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-xs" id="active-question-preview">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold font-mono tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase">
                        선택된 문항
                      </span>
                      <strong className="text-base font-extrabold text-gray-900 font-sans">
                        제 {selectedEdition.edition}회 {activeQuestion.title}
                      </strong>
                      <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                        배점: {activeQuestion.scoreText || "논술형"}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-relaxed font-sans mt-2.5 border-l-4 border-indigo-500 pl-3">
                      <span className="text-indigo-600 font-bold block text-xs mb-0.5">문제 원문</span>
                      {activeQuestion.subject}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. 낭독 재생기 비주얼라이저 */}
            {isEditionLoading ? (
              <div className="bg-white rounded-2xl border border-gray-150 p-12 text-center space-y-4">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="text-sm text-gray-650 font-bold">질문 및 음성 합성 대본 구성 중...</div>
                <p className="text-xs text-gray-400">잠시만 기다려 주시면 선명한 낭독 보드를 준비합니다.</p>
              </div>
            ) : (
              <AudioStudioVisualizer
                items={playbackItems}
                currentIndex={currentIndex}
                isPlaying={isPlaying}
                onPlayPause={togglePlayPause}
                onPrev={handlePrev}
                onNext={handleNext}
                onReset={handleReset}
                playbackRate={playbackRate}
                onRateChange={setPlaybackRate}
                selectedVoiceName={selectedVoiceName}
                onVoiceChange={setSelectedVoiceName}
                voices={voices}
                title={activeQuestion && selectedEdition ? `${selectedEdition.edition}회 ${activeQuestion.title}` : "대기 중"}
                isAutoAdvance={isAutoAdvance}
                onToggleAutoAdvance={() => setIsAutoAdvance((prev) => !prev)}
              />
            )}

            {/* 3. 모범답안 전체 지문 */}
            {!isEditionLoading && activeQuestion && (
              <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-sm" id="full-script-panel">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpenCheck className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-gray-900">모범답안 전체 낭독 지문 스크립트</h3>
                  </div>
                  <span className="text-xs text-gray-400 font-sans italic hidden sm:inline">
                    💡 터치 시 해당 단락에서 즉시 낭독을 시작합니다.
                  </span>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1" id="script-paragraphs-list">
                  {playbackItems.length > 0 ? (
                    playbackItems.map((item, idx) => {
                      const isActive = idx === currentIndex;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleParagraphClick(idx)}
                          className={`p-3.5 rounded-xl border text-sm transition-all duration-300 cursor-pointer ${
                            isActive
                              ? "bg-amber-500/10 border-amber-400 text-slate-900 shadow-xs ring-1 ring-amber-400 font-semibold"
                              : "bg-gray-50/50 border-gray-100 hover:bg-gray-100/70 hover:border-gray-200 text-gray-700"
                          }`}
                          id={`paragraph-block-${idx}`}
                        >
                          <div className="flex items-start gap-2.5">
                            {/* 인덱스 숫자 배지 */}
                            <span className={`w-5 h-5 text-[10px] font-mono font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              isActive
                                ? "bg-amber-500 text-slate-950"
                                : "bg-gray-200 text-gray-500"
                            }`}>
                              {idx + 1}
                            </span>
                            
                            {/* 문장 텍스트 */}
                            <p className="leading-relaxed flex-1 whitespace-pre-wrap">
                              {item.text}
                            </p>

                            {/* 쉼표 지연 여부 태그 */}
                            {item.breakMs > 300 && (
                              <span className="text-[9px] font-mono text-indigo-500 bg-indigo-50/60 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">
                                {item.breakMs / 1000}초 대기
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-400 py-6 text-center italic">
                      지문이 존재하지 않습니다.
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      </main>

      {/* 3. 푸터 영역 */}
      <footer className="max-w-7xl mx-auto px-6 mt-16 text-center text-xs text-gray-450" id="main-app-footer">
        <p className="border-t border-gray-205 pt-6 text-gray-400 font-mono">
          기술사 기출답안 낭독 보드 — 귀로 복습하는 집중 마스터 도구
        </p>
        <p className="mt-2 text-gray-400">
          본 도구는 유료 API 요금 걱정 없이 브라우저 내장(TTS) 엔진만을 백퍼센트 활용하여 기전력을 최대로 보호합니다.
        </p>
      </footer>
    </div>
  );
}
