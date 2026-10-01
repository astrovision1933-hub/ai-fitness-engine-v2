// Voice Fitness Coach — provider abstraction.
// The UI only talks to this hook; swapping the underlying engine (web_speech →
// a hosted provider) requires no page changes. Voice NEVER claims to be human:
// the Coach UI labels it "SYNTHETIC VOICE — AI COACH".
import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

export type VoiceProviderId = "web_speech";

export interface VoiceCoachState {
  providerId: VoiceProviderId;
  sttSupported: boolean;
  ttsSupported: boolean;
  listening: boolean;
  speaking: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  clearTranscript: () => void;
}

export function useVoiceCoach(options: { enabled: boolean; lang?: string }): VoiceCoachState {
  const { enabled, lang = "en-IN" } = options;
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(false);

  const sttSupported =
    typeof window !== "undefined" &&
    Boolean((window as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ||
      (window as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    finalRef.current = false;
    if (!enabled) {
      setError("Voice input is disabled. Enable it in SETTINGS (premium plans only).");
      return;
    }
    if (!sttSupported) {
      setError("This browser does not support speech recognition.");
      return;
    }
    const Ctor =
      (window as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let text = "";
      let final = false;
      for (let i = 0; i < event.results.length; i++) {
        const alt = event.results[i][0];
        text += alt.transcript;
        // Last result carries isFinal in real events; typed loosely here.
      }
      void final;
      setTranscript(text);
      if (text.trim()) finalRef.current = true;
    };
    rec.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied."
          : `Voice input error: ${event.error ?? "unknown"}`,
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start the microphone.");
      setListening(false);
    }
  }, [enabled, lang, sttSupported]);

  const stopListening = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  // Text-to-speech — web_speech provider. A hosted provider can replace this
  // block without touching any page component.
  const speak = useCallback(
    (text: string) => {
      if (!enabled) {
        setError("Voice output is disabled. Enable it in SETTINGS (premium plans only).");
        return;
      }
      if (!ttsSupported) {
        setError("This browser does not support speech synthesis.");
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      // Strip markdown-ish artifacts for a cleaner spoken reply.
      const clean = text.replace(/[#*_`>]/g, "").slice(0, 900);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = lang;
      utter.rate = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      synth.speak(utter);
    },
    [enabled, lang, ttsSupported],
  );

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [ttsSupported]);

  const clearTranscript = useCallback(() => setTranscript(""), []);

  return {
    providerId: "web_speech",
    sttSupported,
    ttsSupported,
    listening,
    speaking,
    transcript,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearTranscript,
  };
}
