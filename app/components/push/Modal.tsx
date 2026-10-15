import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * Accessible dialog: focus trap, Esc to close, focus restored to the trigger.
 * While `busy` is true, Esc/backdrop/close are blocked (e.g. mid-send) so the
 * user can't abandon an in-flight request.
 */
export function PushModal({
  open,
  onClose,
  title,
  children,
  footer,
  label,
  variant = "default",
  busy = false,
  initialFocusSelector,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Accessible name when there is no visible heading (e.g. phone preview). */
  label?: string;
  variant?: "default" | "phone";
  busy?: boolean;
  /** CSS selector to focus on open (defaults to first focusable). */
  initialFocusSelector?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<Element | null>(null);

  const getFocusable = useCallback(() => {
    const box = boxRef.current;
    if (!box) return [] as HTMLElement[];
    return Array.from(
      box.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }, []);

  // Move focus into the dialog on open; restore it on close.
  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement;
    const box = boxRef.current;
    if (!box) return;
    const target =
      (initialFocusSelector
        ? box.querySelector<HTMLElement>(initialFocusSelector)
        : null) || getFocusable()[0] || box;
    // rAF: the dialog has just mounted; let layout settle before focusing.
    const raf = requestAnimationFrame(() => target.focus());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = lastActiveRef.current;
    return () => {
      if (previous && document.contains(previous)) {
        (previous as HTMLElement).focus?.();
      }
    };
  }, [open]);

  // Esc closes (unless busy); Tab cycles within the dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busy) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose, getFocusable]);

  if (!open) return null;

  return (
    <div
      className="pn-modal-root"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={boxRef}
        className={variant === "phone" ? "pn-modal pn-phone-only" : "pn-modal"}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={label ? undefined : title ? "pn-modal-title" : undefined}
        tabIndex={-1}
      >
        {children}
        {footer ? <div className="pn-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ModalHeading({ title }: { title: string }) {
  return (
    <div className="pn-modal-head">
      <h2 id="pn-modal-title">{title}</h2>
    </div>
  );
}
