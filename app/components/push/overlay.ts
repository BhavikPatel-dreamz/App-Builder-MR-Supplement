import { useCallback, useEffect, useRef } from "react";

export type OverlayHost = {
  showOverlay?: () => void;
  hideOverlay?: () => void;
  addEventListener?: (name: string, handler: EventListener) => void;
  removeEventListener?: (name: string, handler: EventListener) => void;
};

/**
 * Same overlay API CMS uses (`showOverlay` / `hideOverlay` on `s-modal`).
 * Also listens for native hide so the X / backdrop stay in sync with React.
 */
export function useOverlay(onHide?: () => void) {
  const ref = useRef<OverlayHost | null>(null);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  useEffect(() => {
    const el = ref.current;
    if (!el?.addEventListener) return;
    const handle = () => onHideRef.current?.();
    el.addEventListener("hide", handle);
    el.addEventListener("afterhide", handle);
    return () => {
      el.removeEventListener?.("hide", handle);
      el.removeEventListener?.("afterhide", handle);
    };
  }, []);

  const show = useCallback(() => {
    requestAnimationFrame(() => ref.current?.showOverlay?.());
  }, []);

  const hide = useCallback(() => {
    ref.current?.hideOverlay?.();
    onHideRef.current?.();
  }, []);

  return { ref, show, hide };
}
