export function isVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function cancelSpeech(): void {
  if (!isVoiceSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakTimerMessage(message: string): void {
  if (!isVoiceSupported()) return;

  // Cancel any ongoing speech so the new message plays immediately
  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(message);
  // Using slightly faster rate as per user requirements
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}
