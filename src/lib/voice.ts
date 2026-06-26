import { read, write } from "./storage";

let cachedVoices: SpeechSynthesisVoice[] = [];
let preferredVoice: SpeechSynthesisVoice | null = null;
let initialized = false;

export function isVoiceSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function selectPreferredVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const englishVoices = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith("en")
  );

  const maleHints = [
    "male",
    "david",
    "mark",
    "daniel",
    "alex",
    "george",
    "ryan",
    "james",
    "microsoft david",
    "microsoft mark",
    "google uk english male",
  ];

  const maleEnglishVoice = englishVoices.find((voice) =>
    maleHints.some((hint) => voice.name.toLowerCase().includes(hint))
  );

  return maleEnglishVoice || englishVoices[0] || voices[0] || null;
}

export function loadVoices(): SpeechSynthesisVoice[] {
  if (!isVoiceSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  cachedVoices = voices || [];
  if (cachedVoices.length > 0) {
    preferredVoice = selectPreferredVoice(cachedVoices);
  }
  return cachedVoices;
}

export function initVoiceSystem(): void {
  if (!isVoiceSupported() || initialized) return;
  initialized = true;
  loadVoices();
  if ("addEventListener" in window.speechSynthesis) {
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      loadVoices();
    });
  } else if ("onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      loadVoices();
    };
  }
}

export function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (!initialized) {
    initVoiceSystem();
  } else if (!preferredVoice || cachedVoices.length === 0) {
    loadVoices();
  }
  return preferredVoice;
}

export function cancelSpeech(): void {
  if (!isVoiceSupported()) return;
  window.speechSynthesis.cancel();
}

export function isVoiceEnabled(): boolean {
  if (!isVoiceSupported()) return false;
  const legacyVal = read<boolean>("studyCockpitVoice", true);
  return read<boolean>("studyTimerVoiceEnabled", legacyVal);
}

export function setVoiceEnabled(enabled: boolean): void {
  write("studyTimerVoiceEnabled", enabled);
  write("studyCockpitVoice", enabled);
  if (!enabled) {
    cancelSpeech();
  }
}

export function speakVoiceMessage(
  message: string,
  options?: { force?: boolean }
): void {
  if (!isVoiceSupported() || !message || !message.trim()) return;
  if (!isVoiceEnabled() && !options?.force) return;

  if (!initialized) {
    initVoiceSystem();
  } else if (!preferredVoice || cachedVoices.length === 0) {
    loadVoices();
  }

  if (
    window.speechSynthesis.state === "suspended" ||
    window.speechSynthesis.paused
  ) {
    window.speechSynthesis.resume();
  }

  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(message.trim());
  utterance.rate = 0.95;
  utterance.pitch = 0.9;
  utterance.volume = 1;

  const voice = getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

export const speakTimerMessage = speakVoiceMessage;

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  initVoiceSystem();
}
