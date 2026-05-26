export interface PlaybackItem {
  text: string;    // 읽어줄 텍스트 문장
  breakMs: number; // 문장이 끝난 후 다음 문장까지 무형 지연 시간 (밀리초)
  emphasis: boolean; // 일반 문장 대비 강조(예: 몇교시 몇번) 여부
}

export interface QuestionData {
  id: string;          // 고유 식별자 (예: "125-1-1")
  title: string;       // 교시 및 문제 번호 (예: "1교시 1번")
  scoreText: string;   // 점수 (예: "10점" 또는 "25점")
  subject: string;     // 문제 원문 내용
  items: PlaybackItem[]; // 해당 문제의 낭독 문장 배열
}

export interface ExplanationEdition {
  edition: number; // 회차 번호 (예: 125)
  title: string;   // 회차 설명 타이틀
  rawSsml: string; // 원본 SSML 대본 텍스트
  questions?: QuestionData[]; // 파싱된 문제 목록
}

export interface PlayerHistoryItem {
  id: string;
  edition: number;
  questionTitle?: string;
  completedAt: string;
  durationSeconds: number;
}
