import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  function onTouchStart(e) {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    } else {
      pulling.current = false;
    }
  }

  function onTouchMove(e) {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (delta > 0 && scrollTop <= 0) {
      setPull(Math.min(delta * 0.4, 80));
    } else if (delta <= 0 || scrollTop > 0) {
      setPull(0);
      pulling.current = false;
    }
  }

  async function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull > 50) {
      setRefreshing(true);
      setPull(40);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pull }}
      >
        <RefreshCw
          className={`h-5 w-5 text-primary transition-opacity ${refreshing ? "animate-spin" : ""}`}
          style={{ opacity: Math.min(1, pull / 50) }}
        />
      </div>
      {children}
    </div>
  );
}