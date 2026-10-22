import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: 'currency' | 'number';
  duration?: number;
  className?: string;
}

// Formatadores de módulo: antes eram recriados a cada frame da animação.
const BRL_ANIMATED = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_ANIMATED = new Intl.NumberFormat('pt-BR');

export function AnimatedNumber({ value, format = 'number', duration = 1200, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) return;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(to);
        startRef.current = null;
      }
    };

    cancelAnimationFrame(frameRef.current);
    startRef.current = null;
    frameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  const formatted = format === 'currency'
    ? BRL_ANIMATED.format(display)
    : NUMBER_ANIMATED.format(Math.round(display));

  return <span className={className}>{formatted}</span>;
}
