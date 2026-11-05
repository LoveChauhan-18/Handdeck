/**
 * HandDeck - Voice Provider Interface (Milestone 3)
 * Swappable audio/speech abstraction layer.
 * Uses browser Web Speech API (speechSynthesis & SpeechRecognition) as default provider.
 * Easily swappable for ElevenLabs or backend proxy in Milestone 4.
 */

export interface VoiceProvider {
  speak(text: string, onEnd?: () => void): void;
  stopSpeaking(): void;
  isSpeaking(): boolean;
  unlockAudio(): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  toggleMuted(): boolean;

  isRecognitionSupported(): boolean;
  isListening(): boolean;
  startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (errorMsg: string) => void,
    onEnd?: () => void
  ): void;
  stopListening(): void;
}

/** Default Web Speech API Provider */
class WebVoiceProvider implements VoiceProvider {
  private muted = false;
  private audioUnlocked = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private recognition: any = null;
  private listening = false;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      } catch (e) {
        console.warn('SpeechRecognition failed to construct:', e);
        this.recognition = null;
      }
    }
  }

  /** Unlocks browser audio autoplay restrictions on user gesture */
  unlockAudio(): void {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Play a short silent utterance to prime synthesis
      try {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      } catch (e) {
        // Ignore priming errors
      }
    }
  }

  speak(text: string, onEnd?: () => void): void {
    if (this.muted) {
      onEnd?.();
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    try {
      this.stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.lang = 'en-US';

      // Pick clean English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
      ) || voices.find((v) => v.lang.startsWith('en'));
      if (preferred) {
        utterance.voice = preferred;
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        onEnd?.();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        this.currentUtterance = null;
        onEnd?.();
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('speak exception:', err);
      onEnd?.();
    }
  }

  stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  isSpeaking(): boolean {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopSpeaking();
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isRecognitionSupported(): boolean {
    return this.recognition !== null;
  }

  isListening(): boolean {
    return this.listening;
  }

  startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (errorMsg: string) => void,
    onEnd?: () => void
  ): void {
    if (!this.recognition) {
      onError('Speech recognition is not supported in this browser.');
      onEnd?.();
      return;
    }

    if (this.listening) {
      this.stopListening();
    }

    // Stop teacher speech while listening so mic doesn't catch own speaker
    this.stopSpeaking();

    this.listening = true;

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const text = (final || interim).trim();
      if (text) {
        onTranscript(text, Boolean(final));
      }
    };

    this.recognition.onerror = (event: any) => {
      this.listening = false;
      const error = event.error || 'Speech error';
      console.warn('SpeechRecognition error:', error);
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        onError('Microphone permission denied. Use buttons below.');
      } else if (error === 'no-speech') {
        onError('No speech detected. Try again or use buttons.');
      } else {
        onError(`Mic error (${error}). Use fallback buttons.`);
      }
    };

    this.recognition.onend = () => {
      this.listening = false;
      onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      this.listening = false;
      console.warn('Failed to start SpeechRecognition:', e);
      onError(e.message || 'Could not start microphone');
      onEnd?.();
    }
  }

  stopListening(): void {
    if (this.recognition && this.listening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
      this.listening = false;
    }
  }
}

/** Active voice provider instance */
export const voice: VoiceProvider = new WebVoiceProvider();
