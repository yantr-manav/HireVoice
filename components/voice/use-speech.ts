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

export type SpeechOptions = {
  lang?: string;
  onFinal?: (text: string) => void;
};

/**
 * Browser speech recognition. The transcript is produced on-device by the
 * browser (Chrome/Edge send audio to their speech service); Hirevoice only
 * receives text and never uploads audio from this hook.
 */
export function useSpeechRecognition(options: SpeechOptions = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState(options.lang ?? "en-IN");

  const recognitionRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(options.onFinal);
  onFinalRef.current = options.onFinal;

  useEffect(() => {
    setSupported(Boolean(getRecognition()));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) {
      setError("This browser does not support speech recognition. Type the command instead.");
      setSupported(false);
      return false;
    }

    recognitionRef.current?.abort();
    setError(null);
    setInterim("");
    setTranscript("");
    finalRef.current = "";

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
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access was blocked. Allow it in your browser, then try again.",
        "service-not-allowed": "Speech recognition was blocked by the browser.",
        "no-speech": "I did not hear anything. Try again, a little closer to the mic.",
        "audio-capture": "No microphone was found.",
        network: "The browser's speech service is offline. Type the command instead.",
        aborted: "",
      };
      const message = messages[event.error] ?? event.message ?? "Speech recognition failed.";
      if (message) setError(message);
      setListening(false);
    };

    recognition.onend = () => {
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
      setError("Could not start the microphone. Try again.");
      return false;
    }
  }, [lang]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
    finalRef.current = "";
  }, []);

  return { supported, listening, transcript, interim, error, lang, setLang, start, stop, reset };
}
