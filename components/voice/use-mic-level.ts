"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "requesting" | "live" | "denied" | "unavailable";

export function useMicLevel(options?: { smoothing?: number }) {
  const smoothing = options?.smoothing ?? 0.72;
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const smoothedRef = useRef(0);

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (contextRef.current && contextRef.current.state !== "closed") {
      void contextRef.current.close();
    }
    contextRef.current = null;
    setLevel(0);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (status === "requesting" || status === "live") return true;
    setError(null);
    setStatus("requesting");
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        setError("This browser does not expose microphone access.");
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        setStatus("unavailable");
        setError("Audio analysis is not available in this browser.");
        return false;
      }
      const context = new AudioContextCtor();
      contextRef.current = context;
      if (context.state === "suspended") await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);

      const tick = () => {
        const node = analyserRef.current;
        if (!node) return;
        node.getByteTimeDomainData(data);
        let sum = 0;
        for (let index = 0; index < data.length; index += 1) {
          const value = (data[index] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / data.length);
        const boosted = Math.min(1, rms * 5.4);
        smoothedRef.current = smoothedRef.current * smoothing + boosted * (1 - smoothing);
        setLevel(smoothedRef.current);
        frameRef.current = requestAnimationFrame(tick);
      };

      setStatus("live");
      tick();
      return true;
    } catch (caught) {
      const message =
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser settings, then retry."
          : "We could not open the microphone. Check that a device is connected and try again.";
      setError(message);
      setStatus(caught instanceof DOMException && caught.name === "NotAllowedError" ? "denied" : "unavailable");
      return false;
    }
  }, [smoothing, status]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { status, level, error, start, stop };
}
