import { PlaybackItem, QuestionData } from "../types";

/**
 * Parses raw SSML text containing <p>, <break>, and <emphasis> tags
 * into structured PlaybackItem array for segment-by-segment speech synthesis.
 */
export function parseSsmlToPlaybackItems(ssml: string): PlaybackItem[] {
  const items: PlaybackItem[] = [];
  
  if (!ssml) return items;

  try {
    const parser = new DOMParser();
    // Wrap with a root element just in case it doesn't have one, though it usually starts with <speak>
    const cleanXml = ssml.trim();
    const xmlDoc = parser.parseFromString(cleanXml, "application/xml");

    // Check for XML parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.warn("SSML DOMParser warning, falling back to regex parser:", parserError.textContent);
      return parseSsmlWithRegexFallback(ssml);
    }

    const speakNode = xmlDoc.querySelector("speak");
    if (!speakNode) {
      return parseSsmlWithRegexFallback(ssml);
    }

    // Traverse children of <speak> to build segments
    const childNodes = Array.from(speakNode.childNodes);
    let currentPendingBreakMs = 0;

    for (const node of childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        
        if (el.tagName === "p") {
          // Inside a <p> tag, there could be <emphasis> or text
          const emphasisNode = el.querySelector("emphasis");
          const textContent = el.textContent ? el.textContent.trim() : "";
          
          if (textContent) {
            items.push({
              text: textContent,
              breakMs: 300, // Default break between paragraphs
              emphasis: !!emphasisNode
            });
          }
        } else if (el.tagName === "break") {
          const timeAttr = el.getAttribute("time") || "0s";
          const ms = parseTimeToMs(timeAttr);
          
          // Apply break to the last added item, or stack for the next
          if (items.length > 0) {
            items[items.length - 1].breakMs = ms;
          } else {
            currentPendingBreakMs = ms;
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ? node.textContent.trim() : "";
        if (text) {
          items.push({
            text: text,
            breakMs: currentPendingBreakMs > 0 ? currentPendingBreakMs : 300,
            emphasis: false
          });
          currentPendingBreakMs = 0;
        }
      }
    }

    return items;
  } catch (err) {
    console.error("SSML DOM parsing failed, trying fallback:", err);
    return parseSsmlWithRegexFallback(ssml);
  }
}

/**
 * Converts break time attributes (e.g. "1.2s", "500ms") into milliseconds
 */
function parseTimeToMs(timeStr: string): number {
  const clean = timeStr.trim().toLowerCase();
  if (clean.endsWith("ms")) {
    return parseInt(clean.replace("ms", ""), 10) || 0;
  } else if (clean.endsWith("s")) {
    return Math.round(parseFloat(clean.replace("s", "")) * 1000) || 0;
  }
  return 300;
}

/**
 * A robust Regex-based fallback parser if DOMParser fails due to non-well-formed XML snippets
 */
function parseSsmlWithRegexFallback(ssml: string): PlaybackItem[] {
  const items: PlaybackItem[] = [];
  // Basic regex cleaning and tokenization
  const pRegex = /<p>(.*?)<\/p>/gs;
  const breakRegex = /<break time="(.*?)"\s*?\/>/gi;
  
  // Since we just want simple lines to read, let's extract all <p> structures
  let match;
  const tempText = ssml.replace(/<speak>/gi, "").replace(/<\/speak>/gi, "");
  
  // Quick splitter by <p> tag
  const paragraphs = tempText.split(/<\/p>/i);
  
  for (const part of paragraphs) {
    let cleanPart = part.replace(/<p>/gi, "").trim();
    if (!cleanPart) continue;

    // Check if there's a break inside or right after
    let breakMs = 400; // default
    const breakMatch = cleanPart.match(/<break time="(.*?)"\s*?\/>/i);
    if (breakMatch && breakMatch[1]) {
      breakMs = parseTimeToMs(breakMatch[1]);
    }

    // Check for emphasis
    const hasEmphasis = /<emphasis/i.test(cleanPart);

    // Strips HTML/XML tags
    const cleanText = cleanPart.replace(/<[^>]*>/g, "").trim();
    
    if (cleanText) {
      items.push({
        text: cleanText,
        breakMs: breakMs,
        emphasis: hasEmphasis
      });
    }
  }

  return items;
}

/**
 * Parses raw SSML text of an edition into dynamic QuestionData[] structures.
 */
export function parseSsmlToQuestions(ssml: string, editionNum: number): QuestionData[] {
  const items = parseSsmlToPlaybackItems(ssml);
  const questions: QuestionData[] = [];
  
  if (items.length === 0) return [];

  let currentQuestion: QuestionData | null = null;
  let qIndex = 1;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const text = item.text.trim();
    
    // Check if the current item is a question header like "1교시 1번, 10점 문제입니다."
    const isHeaderByEmphasis = item.emphasis && (text.includes("교시") && (text.includes("번") || text.includes("문제")));
    const isHeaderByPattern = !item.emphasis && /^\d+교시\s*\d+번/i.test(text);

    if (isHeaderByEmphasis || isHeaderByPattern) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      const titleMatch = text.match(/^(\d+교시\s*\d+번)/i);
      const title = titleMatch ? titleMatch[1] : text.split(",")[0];
      
      const scoreMatch = text.match(/(\d+점)/i);
      const scoreText = scoreMatch ? scoreMatch[1] : "";

      let subject = "상세 해설 및 모범 답안";
      let shiftIndex = 0;
      if (i + 1 < items.length) {
        const nextItemText = items[i + 1].text.trim();
        if (nextItemText.startsWith("문제.") || nextItemText.startsWith("문제")) {
          subject = nextItemText.replace(/^문제\.?\s*/i, "");
          shiftIndex = 1;
        } else {
          subject = nextItemText;
          shiftIndex = 1;
        }
      }

      currentQuestion = {
        id: `${editionNum}-${qIndex++}`,
        title: title || text,
        scoreText: scoreText || "논술형",
        subject: subject,
        items: []
      };

      if (shiftIndex > 0) {
        i += shiftIndex;
      }
    } else {
      if (!currentQuestion) {
        currentQuestion = {
          id: `${editionNum}-intro`,
          title: "안내",
          scoreText: "공통",
          subject: "토목구조기술사 수험 가이드 및 개요",
          items: []
        };
      }
      currentQuestion.items.push(item);
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions.filter(q => q.items.length > 0);
}
