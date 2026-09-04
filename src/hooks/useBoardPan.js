import { useEffect, useRef, useState } from "react";

/**
 * Geser board dengan tarik area kosong (seperti Trello) + wheel mouse → scroll
 * horizontal. Tidak mengganggu drag kartu/list (dnd-kit) karena pan hanya
 * mulai bila pointer turun di area kosong canvas, bukan di kartu / kolom /
 * elemen interaktif.
 *
 * Pakai: const { onPointerDown, panning } = useBoardPan(scrollRef);
 * lalu pasang ref + onPointerDown ke elemen scroll horizontal-nya.
 */
const SKIP_SELECTOR = [
  '[data-testid^="list-column-"]', '[data-testid^="card-tile-"]',
  '[data-testid^="hari-column-"]', '[data-testid^="hari-card-"]',
  '[data-testid^="skor-column-"]', '[data-testid^="skor-card-"]',
  "button", "a", "input", "textarea", "select", '[role="button"]', "[data-no-pan]",
].join(", ");

export function useBoardPan(scrollRef) {
  const [panning, setPanning] = useState(false);
  const state = useRef(null);

  const onPointerDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    if (e.button !== 0 || e.pointerType === "touch") return; // touch: scroll native
    if (e.target.closest(SKIP_SELECTOR)) return; // biar dnd-kit / tombol yang tangani
    if (el.scrollWidth <= el.clientWidth) return; // tidak perlu digeser
    state.current = { startX: e.clientX, startY: e.clientY, startLeft: el.scrollLeft, active: false };
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const move = (e) => {
      const s = state.current;
      if (!s) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (!s.active) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; // ambang: jangan telan klik
        s.active = true;
        setPanning(true);
        document.body.style.userSelect = "none";
      }
      el.scrollLeft = s.startLeft - dx;
    };
    const up = () => {
      if (state.current?.active) {
        setPanning(false);
        document.body.style.userSelect = "";
      }
      state.current = null;
    };
    // Wheel mouse biasa (deltaY, tanpa deltaX) → geser horizontal. Trackpad
    // (punya deltaX) & Shift+wheel dibiarkan default. Listener non-passive
    // supaya preventDefault sah.
    const wheel = (e) => {
      if (e.deltaY !== 0 && e.deltaX === 0 && !e.shiftKey && el.scrollWidth > el.clientWidth) {
        const before = el.scrollLeft;
        el.scrollLeft += e.deltaY;
        if (el.scrollLeft !== before) e.preventDefault();
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      document.body.style.userSelect = "";
    };
  }, [scrollRef]);

  return { onPointerDown, panning };
}
