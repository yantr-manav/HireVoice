"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; 0: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechEvent = { resultIndex: number; results: SpeechResultList };
type SpeechErrorEvent = { error: string; message?: string };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function pickRecorderMime(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return "";
  for (const mime of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export type SpeechOptions = {
  lang?: string;
  onFinal?: (text: string) => void;
};

// Remember across hook instances in this tab if the browser's built-in speech
// service is blocked (e.g., Brave, Arc, Edge, or venue Wi-Fi firewall) so we
// immediately use MediaRecorder + Gemini Audio Transcription with zero error flash.
let browserSpeechBlocked = false;

/**
 * Resilient voice recognition for Vaani & recruiter controls:
 * 1. Tries native Web Speech API when available and reachable.
 * 2. Automatically falls back to MediaRecorder → POST /api/interviews/transcribe
 *    (Gemini multimodal audio) if Web Speech is unavailable or returns "network".
 */
export function useSpeechRecognition(options: SpeechOptions = {}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState(options.lang ?? "en-IN");

  const recognitionRef = useRef<Recognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");
  const onFinalRef = useRef(options.onFinal);
  onFinalRef.current = options.onFinal;

  useEffect(() => {
    const canRec = Boolean(getRecognition()) || Boolean(navigator?.mediaDevices?.getUserMedia);
    setSupported(canRec);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const startGeminiRecorder = useCallback(async () => {
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const cleanMime = (recorder.mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: cleanMime })
            : null;
        if (!blob || blob.size < 800) {
          setInterim("");
          return;
        }
        setTranscribing(true);
        setInterim("Transcribing with Gemini…");
        try {
          const form = new FormData();
          form.append("audio", blob, "command.webm");
          form.append("language", lang.startsWith("hi") ? "hi" : "en");
          const res = await fetch("/api/interviews/transcribe", { method: "POST", body: form });
          const data = (await res.json()) as {
            ok?: boolean;
            segments?: { text: string }[];
            error?: string;
          };
          const text = (data.segments ?? []).map((s) => s.text).join(" ").trim();
          setInterim("");
          if (text) {
            finalRef.current = text;
            setTranscript(text);
            onFinalRef.current?.(text);
          } else {
            setError("Could not hear speech clearly — try speaking closer to the mic.");
          }
        } catch {
          setInterim("");
          setError("Voice transcription failed — you can type your command instead.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setListening(true);
      setInterim("Recording with Gemini Voice… click Stop when done");
      return true;
    } catch {
      setListening(false);
      setError("Microphone access was blocked. Allow mic permission in your browser.");
      return false;
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
        return; // recorder.onstop handles setListening(false) & transcription
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    setInterim("");
    setTranscript("");
    finalRef.current = "";

    const Ctor = getRecognition();
    if (!Ctor || browserSpeechBlocked) {
      void startGeminiRecorder();
      return true;
    }

    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const value = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += value;
        else interimText += value;
      }
      if (finalText) {
        finalRef.current = `${finalRef.current} ${finalText}`.trim();
        setTranscript(finalRef.current);
      }
      setInterim(interimText.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "network" || event.error === "service-not-allowed") {
        // Browser speech service is blocked (Brave/Arc/Edge/firewall) -> switch seamlessly to Gemini Audio!
        browserSpeechBlocked = true;
        recognitionRef.current = null;
        void startGeminiRecorder();
        return;
      }
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow it in your browser, then try again.",
        "no-speech": "I did not hear anything. Try again, a little closer to the mic.",
        "audio-capture": "No microphone was found.",
        aborted: "",
      };
      const message = messages[event.error] ?? event.message ?? "Speech recognition failed.";
      if (message) setError(message);
      setListening(false);
    };

    recognition.onend = () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") return;
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      if (text) onFinalRef.current?.(text);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch {
      void startGeminiRecorder();
      return true;
    }
  }, [lang, startGeminiRecorder]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
    finalRef.current = "";
  }, []);

  return {
    supported,
    listening,
    transcribing,
    transcript,
    interim,
    error,
    lang,
    setLang,
    start,
    stop,
    reset,
  };
}
