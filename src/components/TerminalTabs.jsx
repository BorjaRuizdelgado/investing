import React, { useRef, useEffect, useState } from "react";

export default function TerminalTabs({ tabs, activeTab, onChange }) {
  const containerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  function updateScrollState() {
    const el = containerRef.current;
    if (!el) return setShowScrollBtn(false);
    const overflow = el.scrollWidth > el.clientWidth + 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setShowScrollBtn(overflow && !atEnd);
  }

  useEffect(() => {
    updateScrollState();
    const el = containerRef.current;
    if (!el) return;

    function onResize() {
      updateScrollState();
    }

    function onScroll() {
      updateScrollState();
    }

    window.addEventListener("resize", onResize);
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      el.removeEventListener("scroll", onScroll);
    };
  }, [tabs]);

  function scrollRight() {
    const el = containerRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.6);
    el.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="terminal-tabs-wrapper">
      <div ref={containerRef} className="terminal-tabs" role="tablist" aria-label="Research sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`terminal-tab${activeTab === tab.id ? " terminal-tab--active" : ""}`}
            onClick={() => onChange(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showScrollBtn && (
        <button
          type="button"
          className="terminal-tabs-scroll-btn"
          aria-label="Scroll tabs right"
          onClick={scrollRight}
        >
          »
        </button>
      )}
    </div>
  );
}
