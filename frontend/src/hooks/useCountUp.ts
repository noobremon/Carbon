import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function useCountUp(
  targetValue: number,
  options: UseCountUpOptions = {}
): string {
  const { duration = 800, decimals = 0, prefix = '', suffix = '' } = options;
  const [displayValue, setDisplayValue] = useState(targetValue);
  const prevValueRef = useRef(targetValue);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(targetValue);
      prevValueRef.current = targetValue;
      return;
    }

    const startVal = prevValueRef.current;
    const endVal = targetValue;
    const diff = endVal - startVal;

    if (diff === 0) {
      setDisplayValue(targetValue);
      return;
    }

    const easeOutExpo = (x: number): number => {
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    };

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const current = startVal + diff * easedProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
        startTimeRef.current = null;
      }
    };

    startTimeRef.current = null;
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      prevValueRef.current = endVal;
    };
  }, [targetValue, duration]);

  const formatted = decimals > 0
    ? displayValue.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : Math.round(displayValue).toLocaleString('en-US');

  return `${prefix}${formatted}${suffix}`;
}
