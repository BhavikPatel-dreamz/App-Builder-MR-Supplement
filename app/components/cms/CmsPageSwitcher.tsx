import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  FaCheck,
  FaChevronDown,
  FaFileAlt,
  FaPlus,
  FaSearch,
} from "react-icons/fa";

export type CmsPageListItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

type ContentType = "page" | "header" | "footer";

type CmsPageSwitcherProps = {
  currentPageId?: string;
  contentType: ContentType;
  currentTitle: string;
  pages?: CmsPageListItem[];
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const TYPE_LABEL: Record<ContentType, string> = {
  page: "Pages",
  header: "Headers",
  footer: "Footers",
};

const TYPE_SINGULAR: Record<ContentType, string> = {
  page: "Page",
  header: "Header",
  footer: "Footer",
};

function useHeaderCenterMount() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function sync() {
      const center = document.querySelector(
        ".cms-editor-shell .editor-header .header-center",
      ) as HTMLElement | null;
      if (!center) {
        return;
      }

      const input = center.querySelector(".page-title-input") as
        | HTMLInputElement
        | null;
      if (input) {
        input.style.display = "none";
      }

      setMountNode(center);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return mountNode;
}

export function CmsPageSwitcher({
  currentPageId,
  contentType,
  currentTitle,
  pages: initialPages = [],
}: CmsPageSwitcherProps) {
  const navigate = useNavigate();
  const currentSearch =
    typeof window !== "undefined" ? window.location.search || "" : "";
  const mountNode = useHeaderCenterMount();
  const [pages, setPages] = useState<CmsPageListItem[]>(initialPages);
  const [loading, setLoading] = useState(initialPages.length === 0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPages(initialPages);
    if (initialPages.length > 0) {
      setLoading(false);
    }
  }, [initialPages]);

  useEffect(() => {
    if (initialPages.length > 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/cms/pages?type=${encodeURIComponent(contentType)}`,
        );
        if (!response.ok) {
          throw new Error("Failed to load pages.");
        }
        const data = (await response.json()) as CmsPageListItem[];
        if (!cancelled) {
          setPages(data);
        }
      } catch {
        if (!cancelled) {
          setPages([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentType, initialPages.length]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(380, Math.max(rect.width, 320));
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 12,
    );

    setMenuPosition({
      top: rect.bottom + 10,
      left,
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();
    const onLayoutChange = () => updateMenuPosition();
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    updateMenuPosition();
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const navigateToPage = useCallback(
    (pageId: string) => {
      if (pageId === currentPageId) {
        setOpen(false);
        return;
      }
      setOpen(false);
      navigate(`/app/${pageId}${currentSearch}`);
    },
    [currentPageId, currentSearch, navigate],
  );

  const createNew = useCallback(() => {
    setOpen(false);
    const params = new URLSearchParams(currentSearch);
    params.set("type", contentType);
    const search = params.toString();
    navigate(`/app/new${search ? `?${search}` : ""}`);
  }, [contentType, currentSearch, navigate]);

  if (!mountNode) {
    return null;
  }

  const displayTitle =
    currentTitle.trim() ||
    pages.find((page) => page.id === currentPageId)?.title ||
    `Untitled ${TYPE_SINGULAR[contentType].toLowerCase()}`;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPages = normalizedQuery
    ? pages.filter(
        (page) =>
          page.title.toLowerCase().includes(normalizedQuery) ||
          page.slug.toLowerCase().includes(normalizedQuery),
      )
    : pages;

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            className="cms-page-switcher__menu"
            role="dialog"
            aria-label={`Switch ${TYPE_SINGULAR[contentType].toLowerCase()}`}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              zIndex: 10001,
            }}
          >
            <div className="cms-page-switcher__menu-header">
              <span className="cms-page-switcher__menu-label">
                {TYPE_LABEL[contentType]}
              </span>
              <div className="cms-page-switcher__search">
                <FaSearch
                  className="cms-page-switcher__search-icon"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="search"
                  className="cms-page-switcher__search-input"
                  placeholder={`Search ${TYPE_LABEL[contentType].toLowerCase()}…`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="cms-page-switcher__list" role="listbox">
              {loading ? (
                <p className="cms-page-switcher__empty">Loading…</p>
              ) : filteredPages.length === 0 ? (
                <p className="cms-page-switcher__empty">
                  {normalizedQuery
                    ? "No matches found."
                    : "No saved pages yet."}
                </p>
              ) : (
                filteredPages.map((page) => {
                  const isActive = page.id === currentPageId;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`cms-page-switcher__item${
                        isActive ? " is-active" : ""
                      }`}
                      onClick={() => navigateToPage(page.id)}
                    >
                      <span className="cms-page-switcher__item-icon" aria-hidden>
                        <FaFileAlt />
                      </span>
                      <span className="cms-page-switcher__item-copy">
                        <span className="cms-page-switcher__item-title">
                          {page.title}
                        </span>
                        {page.slug ? (
                          <span className="cms-page-switcher__item-slug">
                            /{page.slug}
                          </span>
                        ) : null}
                      </span>
                      {page.status === "draft" ? (
                        <span className="cms-page-switcher__badge">Draft</span>
                      ) : null}
                      {isActive ? (
                        <FaCheck
                          className="cms-page-switcher__check"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            <div className="cms-page-switcher__menu-footer">
              <button
                type="button"
                className="cms-page-switcher__create"
                onClick={createNew}
              >
                <FaPlus aria-hidden />
                <span>Create new {TYPE_SINGULAR[contentType].toLowerCase()}</span>
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {createPortal(
        <div className={`cms-page-switcher${open ? " is-open" : ""}`}>
          <button
            ref={triggerRef}
            type="button"
            className="cms-page-switcher__trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="cms-page-switcher__trigger-meta">
              <span className="cms-page-switcher__trigger-label">
                {TYPE_SINGULAR[contentType]}
              </span>
              <span className="cms-page-switcher__trigger-sep" aria-hidden>
                ·
              </span>
              <span className="cms-page-switcher__trigger-title">
                {displayTitle}
              </span>
            </span>
            <FaChevronDown
              className="cms-page-switcher__chevron"
              aria-hidden
            />
          </button>
        </div>,
        mountNode,
      )}
      {menu}
    </>
  );
}
