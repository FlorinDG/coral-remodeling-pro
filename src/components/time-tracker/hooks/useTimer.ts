"use client";
import { useCallback, useSyncExternalStore } from 'react';

interface UseTimerResult {
  elapsedTime: number;
  formattedTime: string;
  isRunning: boolean;
  startTimer: (startTime?: Date) => void;
  stopTimer: () => void;
  resetTimer: () => void;
  setStartTime: (time: Date) => void;
}

function formatTimerSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface TimerStoreState {
  elapsedTime: number;
  isRunning: boolean;
  formattedTime: string;
}

let startTimeRef: Date | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

let currentSnapshot: TimerStoreState = {
  elapsedTime: 0,
  isRunning: false,
  formattedTime: '00:00:00',
};

const serverSnapshot: TimerStoreState = {
  elapsedTime: 0,
  isRunning: false,
  formattedTime: '00:00:00',
};

function notify() {
  listeners.forEach((l) => l());
}

function tick() {
  if (startTimeRef && currentSnapshot.isRunning) {
    const now = new Date();
    const elapsed = Math.max(0, Math.floor((now.getTime() - startTimeRef.getTime()) / 1000));
    currentSnapshot = {
      elapsedTime: elapsed,
      isRunning: true,
      formattedTime: formatTimerSeconds(elapsed),
    };
    notify();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentSnapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

export function useTimer(): UseTimerResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const startTimer = useCallback((start?: Date) => {
    startTimeRef = start || new Date();
    const now = new Date();
    const elapsed = Math.max(0, Math.floor((now.getTime() - startTimeRef.getTime()) / 1000));
    currentSnapshot = {
      elapsedTime: elapsed,
      isRunning: true,
      formattedTime: formatTimerSeconds(elapsed),
    };
    if (!intervalId) {
      intervalId = setInterval(tick, 1000);
    }
    notify();
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    currentSnapshot = {
      ...currentSnapshot,
      isRunning: false,
    };
    notify();
  }, []);

  const resetTimer = useCallback(() => {
    startTimeRef = null;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    currentSnapshot = {
      elapsedTime: 0,
      isRunning: false,
      formattedTime: '00:00:00',
    };
    notify();
  }, []);

  const setStartTime = useCallback((time: Date) => {
    startTimeRef = time;
    const now = new Date();
    const elapsed = Math.max(0, Math.floor((now.getTime() - time.getTime()) / 1000));
    currentSnapshot = {
      ...currentSnapshot,
      elapsedTime: elapsed,
      formattedTime: formatTimerSeconds(elapsed),
    };
    notify();
  }, []);

  return {
    elapsedTime: snapshot.elapsedTime,
    formattedTime: snapshot.formattedTime,
    isRunning: snapshot.isRunning,
    startTimer,
    stopTimer,
    resetTimer,
    setStartTime,
  };
}
