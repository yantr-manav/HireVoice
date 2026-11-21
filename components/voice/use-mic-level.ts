"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "requesting" | "live" | "denied" | "unavailable";

const BAR_COUNT = 32;

export function useMicLevel(options?: { smoothing?: number }) {
  const releaseSmoothing = options?.smoothing ?? 0.62;
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [micVerified, setMicVerified] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const smoothedRef = useRef(0);
  const peakRef = useRef(0);
  const verifiedRef = useRef(false);
  const voiceFramesRef = useRef(0);
  const statusRef = useRef<MicStatus>("idle");
  // Updated at 60fps in-place with ZERO React re-renders for buttery canvas waveforms.
  const barsRef = useRef<Float32Array>(new Float32Array(BAR_COUNT));

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
    smoothedRef.current = 0;
    barsRef.current.fill(0);
    statusRef.current = "idle";
    setLevel(0);
    setStatus("idle");
  }, []);

  const resetVerification = useCallback(() => {
    peakRef.current = 0;
    verifiedRef.current = false;
    voiceFramesRef.current = 0;
    setPeak(0);
    setMicVerified(false);
  }, []);

  const start = useCallback(async () => {
    if (statusRef.current === "requesting" || statusRef.current === "live") return true;
    setError(null);
    statusRef.current = "requesting";
    setStatus("requesting");

    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        statusRef.current = "unavailable";
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

      const track = stream.getAudioTracks()[0];
      if (track?.label) setDeviceLabel(track.label);

      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        statusRef.current = "unavailable";
        setStatus("unavailable");
        setError("Audio analysis is not available in this browser.");
        return false;
      }

      const context = new AudioContextCtor();
      contextRef.current = context;
      if (context.state === "suspended") await context.resume();

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);
      analyserRef.current = analyser;

      const timeData = new Uint8Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      let lastReactSync = 0;

      const tick = (now: number) => {
        const node = analyserRef.current;
        if (!node) return;

        node.getByteTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i += 1) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const boosted = Math.min(1, rms * 6.5);

        // Fast attack (0.2), smooth release so waveform snaps instantly to speech
        const alpha = boosted > smoothedRef.current ? 0.2 : releaseSmoothing;
        smoothedRef.current = smoothedRef.current * alpha + boosted * (1 - alpha);

        // Update 32 spectrum bars in-place for zero-lag 60fps canvas rendering
        node.getByteFrequencyData(freqData);
        const bars = barsRef.current;
        const step = Math.max(1, Math.floor((freqData.length * 0.65) / BAR_COUNT));
        for (let i = 0; i < BAR_COUNT; i += 1) {
          const raw = (freqData[Math.min(freqData.length - 1, i * step + 1)] ?? 0) / 255;
          const shaped = Math.min(1, Math.max(raw * 1.25, smoothedRef.current * 0.65));
          bars[i] = bars[i] * 0.35 + shaped * 0.65;
        }

        // Sticky mic verification: once real speech is detected for ~8 frames (~130ms),
        // latch micVerified = true so the UI NEVER flickers between working/not-working.
        if (boosted > 0.055) {
          voiceFramesRef.current += 1;
          if (boosted > peakRef.current) peakRef.current = boosted;
          if (!verifiedRef.current && voiceFramesRef.current >= 8) {
            verifiedRef.current = true;
            setMicVerified(true);
            setPeak(peakRef.current);
          }
        }

        // Throttle React state updates to ~12fps so the main thread stays 100% free for live captions!
        if (now - lastReactSync >= 80) {
          lastReactSync = now;
          setLevel(smoothedRef.current);
          if (peakRef.current > 0) setPeak(peakRef.current);
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      statusRef.current = "live";
      setStatus("live");
      frameRef.current = requestAnimationFrame(tick);
      return true;
    } catch (caught) {
      const message =
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser settings, then retry."
          : "We could not open the microphone. Check that a device is connected and try again.";
      setError(message);
      const nextStatus: MicStatus =
        caught instanceof DOMException && caught.name === "NotAllowedError" ? "denied" : "unavailable";
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      return false;
    }
  }, [releaseSmoothing]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    status,
    level,
    peak,
    micVerified,
    deviceLabel,
    barsRef,
    error,
    start,
    stop,
    resetVerification,
  };
}
