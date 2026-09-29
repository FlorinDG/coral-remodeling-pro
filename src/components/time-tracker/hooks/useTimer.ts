"use client";
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerResult {
  elapsedTime: number;
  formattedTime: string;
  isRunning: boolean;
  startTimer: (startTime?: Date) => void;
  stopTimer: () => void;
  resetTimer: () => void;
  setStartTime: (time: Date) => void;
}

export function useTimer(): UseTimerResult {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update elapsed time when running
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      // Calculate initial elapsed time
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
      setElapsedTime(elapsed);

      // Set up interval
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  const startTimer = useCallback((start?: Date) => {
    startTimeRef.current = start || new Date();
    setIsRunning(true);
  }, []);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    startTimeRef.current = null;
    setElapsedTime(0);
    setIsRunning(false);
  }, []);

  const setStartTime = useCallback((time: Date) => {
    startTimeRef.current = time;
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - time.getTime()) / 1000);
    setElapsedTime(elapsed);
  }, []);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    elapsedTime,
    formattedTime: formatTime(elapsedTime),
    isRunning,
    startTimer,
    stopTimer,
    resetTimer,
    setStartTime,
  };
}
