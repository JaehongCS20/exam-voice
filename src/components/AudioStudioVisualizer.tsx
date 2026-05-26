import React, { useState, useEffect } from "react";
import { PlaybackItem } from "../types";
import { Volume2, Play, Pause, SkipForward, SkipBack, RotateCcw, ChevronRight } from "lucide-react";

interface AudioStudioVisualizerProps {
  items: PlaybackItem[];
  currentIndex: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  playbackRate: number;
  onRateChange: (rate: number) => void;
  selectedVoiceName: string;
  onVoiceChange: (voiceName: string) => void;
  voices: SpeechSynthesisVoice[];
  title: string;
  isAutoAdvance: boolean;
  onToggleAutoAdvance: () => void;
}

export default function AudioStudioVisualizer({
  items,
  currentIndex,
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
  onReset,
  playbackRate,
  onRateChange,
  selectedVoiceName,
  onVoiceChange,
  voices,
  title,
  isAutoAdvance,
  onToggleAutoAdvance,
}: AudioStudioVisualizerProps) {
  const [waveHeight, setWaveHeight] = useState<number[]>(Array(16).fill(15));

  // Simulated audio waveform movement when playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setWaveHeight(Array.from({ length: 16 }, () => Math.floor(Math.random() * 50) + 12));
      }, 100);
    } else {
      setWaveHeight(Array(16).fill(10));
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const currentItem = items[currentIndex] || null;

  return (
    <div
      className="relative transition-all duration-500 rounded-3xl overflow-hidden shadow-lg border bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border-slate-700 text-white p-6 md:p-8"
      id="studio-visualizer-card"
    >
      {/* 백그라운드 빛 효과 (스탠다드 모드 전용) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" id="ambient-glows">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* 헤더 행 */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4 mb-6" id="visualizer-header">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaying ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPlaying ? "bg-emerald-500" : "bg-amber-500"}`} />
          </span>
          <span className="text-xs font-mono tracking-widest text-slate-300 uppercase">
            {isPlaying ? "ON AIR / 읽는 중" : "STANDBY / 일시정지"}
          </span>
          <span className="text-white/40 text-xs font-sans">|</span>
          <span className="text-xs text-indigo-200 truncate max-w-[150px] md:max-w-xs">{title}</span>
        </div>
      </div>

      {/* 중앙 메인 낭독 / 자막 하이라이팅 스크린 */}
      <div className="relative z-10 flex-1 flex flex-col justify-center my-6 md:my-10" id="main-subtitles-area">
        {currentItem ? (
          <div className="text-center px-4" id="active-subtitle-wrapper">
            {/* 문장 강조 태그 (emphasis) 디자인 */}
            {currentItem.emphasis && (
              <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg mb-4 border border-amber-500/40 uppercase tracking-widest animate-bounce">
                구조 대본 지점 강조
              </span>
            )}
            
            {/* 문장 자막 텍스트 */}
            <h1
              className="font-sans leading-snug tracking-tight transition-all duration-300 text-2xl md:text-2xl lg:text-3xl text-white font-bold"
              id="active-subtitle-text"
              style={{ textShadow: "0 4px 12px rgba(0, 0, 0, 0.4)" }}
            >
              {currentItem.text}
            </h1>

            {/* 자막 설명 / 다음 구절 미리보기 */}
            {currentIndex < items.length - 1 && (
              <p className="text-xs text-white/30 font-semibold flex items-center justify-center gap-1 mt-6 animate-pulse">
                <span>다음 구절:</span>
                <span className="font-sans italic">{items[currentIndex + 1].text.substring(0, 30)}...</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-10" id="empty-visualizer-prompt">
            <Volume2 className="w-12 h-12 text-white/20 mx-auto mb-4 animate-pulse" />
            <h2 className="text-lg font-semibold text-white/80">선택된 청취 대본이 없습니다</h2>
            <p className="text-xs text-white/40 mt-1">좌측 라이브러리에서 복습할 기출 회차를 고르거나 대본을 변환해 감상하십시오</p>
          </div>
        )}
      </div>

      {/* 파형 그래픽 */}
      <div className="relative z-10 flex items-end justify-center gap-1 h-14 mb-6" id="audio-wave-bars">
        {waveHeight.map((h, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-gradient-to-t from-blue-600 via-indigo-400 to-cyan-300 opacity-80"
            style={{
              height: `${h}px`,
              transition: "height 0.1s ease-in-out",
            }}
          />
        ))}
      </div>

      {/* 재생 및 오디오 세부 컨트롤 패널 */}
      <div className="relative z-10 border-t border-white/10 pt-5" id="audio-control-bar">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* 미디어 전송 제어 버튼 */}
          <div className="flex items-center gap-3">
            <button
              onClick={onReset}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white/80 hover:text-white transition-colors cursor-pointer"
              title="처음으로 되돌리기"
              id="btn-ccw"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="p-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-full text-white/80 hover:text-white transition-colors cursor-pointer"
              title="이전 구절"
              id="btn-skip-back"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={onPlayPause}
              disabled={items.length === 0}
              className="p-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-white/40 text-slate-950 font-bold rounded-full shadow-lg shadow-amber-500/10 hover:scale-105 transition-all duration-200 cursor-pointer"
              id="btn-main-play-pause"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950 translate-x-[1px]" />}
            </button>
            <button
              onClick={onNext}
              disabled={currentIndex >= items.length - 1}
              className="p-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-full text-white/80 hover:text-white transition-colors cursor-pointer"
              title="다음 구절"
              id="btn-skip-forward"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* 인덱스 진행 상황 */}
          <div className="text-center font-mono text-xs text-white/50" id="progress-indicator">
            {items.length > 0 ? (
              <span>
                문장 <strong className="text-amber-400">{currentIndex + 1}</strong> / {items.length} (
                {Math.round(((currentIndex + 1) / items.length) * 100)}%)
              </span>
            ) : (
              <span>대본 대기 상태</span>
            )}
          </div>

          {/* 속도 및 음성선택 제어 */}
          <div className="flex flex-wrap items-center gap-4" id="voice-speed-controls">
            {/* 자동 다음문제 재생 토글 */}
            <div className="flex items-center gap-1.5 mr-2" id="auto-advance-wrapper">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none font-bold">
                <input
                  type="checkbox"
                  checked={isAutoAdvance}
                  onChange={onToggleAutoAdvance}
                  className="sr-only peer"
                  id="auto-advance-toggle"
                />
                <div className="relative w-8 h-4 bg-white/20 rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600" />
                <span className="text-white/80 hover:text-white transition-colors">자동 다음문제</span>
              </label>
            </div>

            {/* 배속 조절 */}
            <div className="flex items-center gap-1.5" id="speed-wrapper">
              <span className="text-[11px] text-white/40 uppercase font-mono">Rate:</span>
              <select
                value={playbackRate}
                onChange={(e) => onRateChange(parseFloat(e.target.value))}
                className="bg-white/10 hover:bg-white/15 border border-white/5 rounded-lg px-2 py-1 text-xs text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-bold"
                id="rate-select"
              >
                <option value="0.7" className="text-gray-900">0.7x (슬로우)</option>
                <option value="0.8" className="text-gray-900">0.8x</option>
                <option value="0.9" className="text-gray-900">0.9x</option>
                <option value="1" className="text-gray-900">1.0x (보통)</option>
                <option value="1.1" className="text-gray-900">1.1x</option>
                <option value="1.2" className="text-gray-900">1.2x</option>
                <option value="1.3" className="text-gray-900">1.3x</option>
                <option value="1.5" className="text-gray-900">1.5x (빠르게)</option>
                <option value="1.8" className="text-gray-900">1.8x</option>
                <option value="2" className="text-gray-900">2.0x</option>
              </select>
            </div>

            {/* 음성 종류 선택 */}
            <div className="flex items-center gap-1.5" id="voice-wrapper">
              <span className="text-[11px] text-white/40 uppercase font-mono">Voice:</span>
              <select
                value={selectedVoiceName}
                onChange={(e) => onVoiceChange(e.target.value)}
                className="bg-white/10 hover:bg-white/15 border border-white/5 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[130px] sm:max-w-[180px] md:max-w-[150px] truncate"
                id="voice-select"
              >
                {voices.length > 0 ? (
                  voices.map((v) => (
                    <option key={v.name} value={v.name} className="text-gray-900">
                      {v.name} ({v.lang})
                    </option>
                  ))
                ) : (
                  <option className="text-gray-900">시스템 기본 음성</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
