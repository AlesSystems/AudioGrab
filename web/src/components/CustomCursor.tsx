'use client';

import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      window.matchMedia('(hover:none)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;
    if (window.innerWidth < 760) return;

    document.documentElement.classList.add('has-cursor');

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let rafId: number;

    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate3d(${mx - 3}px, ${my - 3}px, 0)`;
    };

    const onMouseDown = () => {
      ring.classList.add('down');
    };

    const onMouseUp = () => {
      ring.classList.remove('down');
    };

    const tick = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      const r = ring.getBoundingClientRect().width || 30;
      ring.style.transform = `translate3d(${rx - r / 2}px, ${ry - r / 2}px, 0)`;
      rafId = requestAnimationFrame(tick);
    };
    tick();

    const hoverSel =
      'a,button,input,select,textarea,[role="button"],.tab,.seg button,.dz,.field,.disclose,.linkbtn,.dl';

    const onMouseOver = (e: MouseEvent) => {
      if ((e.target as Element).closest(hoverSel)) ring.classList.add('hover');
    };

    const onMouseOut = (e: MouseEvent) => {
      const t = e.target as Element;
      const rel = e.relatedTarget as Element | null;
      if (t.closest(hoverSel) && !rel?.closest?.(hoverSel)) {
        ring.classList.remove('hover');
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);

    return () => {
      cancelAnimationFrame(rafId);
      document.documentElement.classList.remove('has-cursor');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
    };
  }, []);

  return (
    <>
      <div className="cur-ring" ref={ringRef} aria-hidden="true" />
      <div className="cur-dot" ref={dotRef} aria-hidden="true" />
    </>
  );
}
