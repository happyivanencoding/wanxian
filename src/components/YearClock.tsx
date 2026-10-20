import { useEffect, useRef, useState } from 'react';
import './YearClock.css';

export const YEARS_PER_LIFE_ESTIMATE = 450;
export const secondsPerYear = (minutes: 30 | 60, speed: number) => minutes * 60 / YEARS_PER_LIFE_ESTIMATE / speed;

export default function YearClock({ active, age, lifeId, durationMinutes, speed, onYear }: {
  active: boolean; age: number; lifeId: string; durationMinutes: 30 | 60; speed: number; onYear: () => void;
}) {
  const progressRef = useRef(0);
  const onYearRef = useRef(onYear);
  onYearRef.current = onYear;
  const [progress, setProgress] = useState(0);
  const [yearKey, setYearKey] = useState(`${lifeId}:${age}`);
  const currentYearKey = `${lifeId}:${age}`;
  if (yearKey !== currentYearKey) {
    progressRef.current = 0;
    setProgress(0);
    setYearKey(currentYearKey);
  }
  useEffect(() => {
    if (!active) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(0, Math.min(200, now - previous));
      previous = now;
      progressRef.current = Math.min(1, progressRef.current + elapsed / (secondsPerYear(durationMinutes, speed) * 1000));
      if (progressRef.current >= 1) {
        progressRef.current = 0;
        setProgress(0);
        onYearRef.current();
        return;
      }
      setProgress(progressRef.current);
    }, 80);
    return () => window.clearInterval(timer);
  }, [active, durationMinutes, speed]);
  const seconds = secondsPerYear(durationMinutes, speed);
  return <div className="year-clock" data-testid="year-clock" aria-label="当前年度流转进度">
    <div className="year-clock-caption">
      <span><strong>岁序流转</strong> <small>{active ? '正在流转' : '时光暂停'} · 约 {seconds.toFixed(1)} 秒／年</small></span>
      <span className="year-clock-countdown" data-testid="year-countdown">{Math.max(0, seconds * (1 - progress)).toFixed(1)} 秒后 · {age + 1}岁</span>
    </div>
    <div className="year-clock-track" role="progressbar" aria-label="本年度进度" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} data-testid="year-progress">
      <div className="year-clock-fill" style={{ width: `${(progress * 100).toFixed(2)}%` }}/>
    </div>
  </div>;
}
