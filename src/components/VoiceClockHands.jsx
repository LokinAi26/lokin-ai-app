import { useEffect, useRef } from "react";

// Live clock hands for the LOKIN Voice centerpiece. Drawn over the baked
// no-hands artwork at the watch-face dial. Pointer events are disabled so
// taps pass through to the existing tap-to-speak clock-face button.
// Motion: real device time — the second hand ticks once per second, hour and
// minute hands glide. This is the approved motion; no sweep mode, no toggles.
export default function VoiceClockHands() {
  const hourRef = useRef(null);
  const minRef = useRef(null);
  const secRef = useRef(null);

  useEffect(() => {
    if (secRef.current) secRef.current.style.transition = "transform .09s ease-out";
    let rafId = 0;
    const tick = () => {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      if (secRef.current) secRef.current.setAttribute("transform", `rotate(${Math.floor(s) * 6} 100 100)`);
      if (minRef.current) minRef.current.setAttribute("transform", `rotate(${m * 6} 100 100)`);
      if (hourRef.current) hourRef.current.setAttribute("transform", `rotate(${h * 30} 100 100)`);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "51.25%",
        top: "54.20%",
        width: "36.04%",
        aspectRatio: "1 / 1",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 2,
      }}
    >
      <defs>
        <linearGradient id="chromePolish" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#14171a" />
          <stop offset=".18" stopColor="#5f666d" />
          <stop offset=".36" stopColor="#d7dde3" />
          <stop offset=".46" stopColor="#ffffff" />
          <stop offset=".54" stopColor="#eef1f4" />
          <stop offset=".68" stopColor="#9aa1a8" />
          <stop offset=".86" stopColor="#43484e" />
          <stop offset="1" stopColor="#101315" />
        </linearGradient>
        <radialGradient id="capChrome" cx=".36" cy=".28" r=".95">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".35" stopColor="#dfe5ea" />
          <stop offset=".7" stopColor="#8b9299" />
          <stop offset="1" stopColor="#2b2f34" />
        </radialGradient>
        <filter id="handShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="1.7" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>
      <g id="hourHand" ref={hourRef} filter="url(#handShadow)">
        <polygon points="100,104 94.5,64 100,36 105.5,64" fill="url(#chromePolish)" stroke="#101315" strokeWidth=".8" />
      </g>
      <g id="minHand" ref={minRef} filter="url(#handShadow)">
        <polygon points="100,106 96.5,52 100,16 103.5,52" fill="url(#chromePolish)" stroke="#101315" strokeWidth=".8" />
      </g>
      <g id="secHand" ref={secRef} filter="url(#handShadow)">
        <polygon points="100,102 98.8,58 100,14 101.2,58" fill="url(#chromePolish)" stroke="#101315" strokeWidth=".6" />
      </g>
      <circle cx="100" cy="100" r="6.5" fill="url(#capChrome)" stroke="#14171a" strokeWidth=".9" />
      <ellipse cx="97.9" cy="97.7" rx="2" ry="1.4" fill="#ffffff" opacity=".85" transform="rotate(-24 97.9 97.7)" />
    </svg>
  );
}