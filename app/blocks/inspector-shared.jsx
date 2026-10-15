// @ts-nocheck
import { useRef, useEffect, useCallback } from 'gutenberg-block-kit/wp/element';
import {
  MediaUpload,
  MediaUploadCheck,
  PanelColorSettings,
  BlockIcon,
  useBlockEditContext,
} from 'gutenberg-block-kit/wp/block-editor';
import { getBlockType } from 'gutenberg-block-kit/wp/blocks';
import { Button } from 'gutenberg-block-kit/wp/components';
import { useSelect, useDispatch } from 'gutenberg-block-kit/wp/data';

export const contentTabStyle = {
  padding: '0 16px 16px',
  maxHeight: 'calc(100vh - 220px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
};

const editorSectionLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  marginBottom: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1e1e1e',
  background: '#f0f0f1',
  border: '1px dashed #c3c4c7',
  borderRadius: '4px',
};

/** Visible block icon + name in the editor canvas for sections with no storefront UI. */
export function EditorSectionLabel({ name, detail }) {
  const extra = typeof detail === 'string' ? detail.trim() : '';
  const context = useBlockEditContext() || {};
  const icon = context.name ? getBlockType(context.name)?.icon : null;
  return (
    <span className="appbuilder-editor-section-label" style={editorSectionLabelStyle}>
      {icon ? <BlockIcon icon={icon.src || icon} /> : null}
      <span>
        {name}
        {extra ? (
          <span style={{ fontWeight: 400, color: '#50575e', marginLeft: '8px' }}>
            {extra}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function getImageUrl(media) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  const item = Array.isArray(media) ? media[0] : media;
  if (!item || typeof item !== 'object') return '';
  return (
    item.url ||
    item.src ||
    item.sizes?.full?.url ||
    item.sizes?.medium?.url ||
    item.source_url ||
    ''
  );
}

export function imageAttributesFromMedia(media, urlKey = 'imageUrl') {
  const item = Array.isArray(media) ? media[0] : media;
  const url = getImageUrl(media);
  return {
    [urlKey]: url ?? '',
    imageWidth: item?.width ?? item?.imageWidth ?? 0,
    imageHeight: item?.height ?? item?.imageHeight ?? 0,
  };
}

export function clearImageAttributes(urlKey = 'imageUrl') {
  return {
    [urlKey]: '',
    imageWidth: 0,
    imageHeight: 0,
  };
}

export function stopPaginationEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

export function SliderPaginationDots({
  count,
  activeIndex,
  onSelect,
  className = 'appbuilder-pagination',
  dotClassName = 'appbuilder-pagination__dot',
  ariaLabelPrefix = 'Go to slide',
}) {
  if (!count || count <= 1) return null;

  return (
    <div className={className} onMouseDown={stopPaginationEvent}>
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          type="button"
          className={`${dotClassName}${index === activeIndex ? ' is-active' : ''}`}
          aria-label={`${ariaLabelPrefix} ${index + 1}`}
          aria-current={index === activeIndex ? 'true' : undefined}
          onMouseDown={stopPaginationEvent}
          onClick={(event) => onSelect(index, event)}
        />
      ))}
    </div>
  );
}

function getTrackSlides(track) {
  if (!track) return [];

  const layout = track.querySelector('.block-editor-block-list__layout');
  const candidates = layout ? Array.from(layout.children) : Array.from(track.children);

  return candidates.filter((node) => {
    if (node.classList?.contains('block-list-appender')) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  });
}

function scrollTrackToIndex(track, activeIndex) {
  if (!track || activeIndex < 0) return;

  const slides = getTrackSlides(track);
  const slide = slides[activeIndex];
  if (!slide) return;

  const targetLeft =
    track.scrollLeft + (slide.getBoundingClientRect().left - track.getBoundingClientRect().left);

  track.scrollTo({ left: targetLeft, behavior: 'smooth' });
}

function useTrackScrollSync(trackRef, setActiveIndex) {
  const suppressSyncRef = useRef(false);
  const syncTimerRef = useRef(null);

  const markProgrammaticScroll = useCallback(() => {
    suppressSyncRef.current = true;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      suppressSyncRef.current = false;
    }, 450);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !setActiveIndex) return undefined;

    let frame = 0;
    const onScroll = () => {
      if (suppressSyncRef.current) return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (suppressSyncRef.current) return;

        const slides = getTrackSlides(track);
        if (!slides.length) return;

        const origin = track.getBoundingClientRect().left;
        let closest = 0;
        let minDistance = Infinity;

        slides.forEach((slide, index) => {
          const distance = Math.abs(slide.getBoundingClientRect().left - origin);
          if (distance < minDistance) {
            minDistance = distance;
            closest = index;
          }
        });

        setActiveIndex((current) => (current === closest ? current : closest));
      });
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      track.removeEventListener('scroll', onScroll);
    };
  }, [trackRef, setActiveIndex]);

  const scrollToIndex = useCallback(
    (index) => {
      markProgrammaticScroll();
      scrollTrackToIndex(trackRef.current, index);
      requestAnimationFrame(() => {
        scrollTrackToIndex(trackRef.current, index);
      });
    },
    [markProgrammaticScroll, trackRef],
  );

  return scrollToIndex;
}

/** Sync pagination with child selection and scroll the track to the active slide. */
export function useSliderPagination(clientId, activeIndex, setActiveIndex) {
  const trackRef = useRef(null);
  const { selectBlock } = useDispatch('core/block-editor');
  const scrollToIndex = useTrackScrollSync(trackRef, setActiveIndex);

  const { childClientIds, selectedBlockClientId } = useSelect(
    (select) => {
      const editor = select('core/block-editor');
      return {
        childClientIds: editor.getBlockOrder(clientId),
        selectedBlockClientId: editor.getSelectedBlockClientId(),
      };
    },
    [clientId],
  );

  const slideCount = childClientIds.length;

  useEffect(() => {
    if (slideCount <= 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > slideCount - 1) {
      setActiveIndex(slideCount - 1);
    }
  }, [activeIndex, slideCount, setActiveIndex]);

  useEffect(() => {
    if (!selectedBlockClientId || !childClientIds.includes(selectedBlockClientId)) {
      return;
    }
    const nextIndex = childClientIds.indexOf(selectedBlockClientId);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
    }
  }, [childClientIds, selectedBlockClientId, setActiveIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || activeIndex < 0) return;

    const slides = getTrackSlides(track);
    const slide = slides[activeIndex];
    if (!slide) return;

    const distance = Math.abs(slide.getBoundingClientRect().left - track.getBoundingClientRect().left);
    if (distance < 4) return;

    scrollToIndex(activeIndex);
  }, [activeIndex, scrollToIndex, trackRef]);

  const goToSlide = useCallback(
    (index, event) => {
      if (event) {
        stopPaginationEvent(event);
      }
      if (index < 0 || index >= childClientIds.length) return;

      setActiveIndex(index);
      selectBlock(childClientIds[index]);
      scrollToIndex(index);
    },
    [childClientIds, scrollToIndex, selectBlock, setActiveIndex],
  );

  return { trackRef, slideCount, goToSlide };
}

/** Hero carousel — index + dot navigation only (no horizontal track scroll). */
export function useCarouselPagination(clientId, activeIndex, setActiveIndex) {
  const { selectBlock } = useDispatch('core/block-editor');

  const { childClientIds, selectedBlockClientId } = useSelect(
    (select) => {
      const editor = select('core/block-editor');
      return {
        childClientIds: editor.getBlockOrder(clientId),
        selectedBlockClientId: editor.getSelectedBlockClientId(),
      };
    },
    [clientId],
  );

  const slideCount = childClientIds.length;

  useEffect(() => {
    if (slideCount <= 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > slideCount - 1) {
      setActiveIndex(slideCount - 1);
    }
  }, [activeIndex, slideCount, setActiveIndex]);

  useEffect(() => {
    if (!selectedBlockClientId || !childClientIds.includes(selectedBlockClientId)) {
      return;
    }
    const nextIndex = childClientIds.indexOf(selectedBlockClientId);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
    }
  }, [childClientIds, selectedBlockClientId, setActiveIndex]);

  const goToSlide = useCallback(
    (index, event) => {
      if (event) {
        stopPaginationEvent(event);
      }
      if (index < 0 || index >= childClientIds.length) return;

      setActiveIndex(index);
      selectBlock(childClientIds[index]);
    },
    [childClientIds, selectBlock, setActiveIndex],
  );

  return { slideCount, goToSlide };
}

/** Scroll a plain track (e.g. product cards) when activeIndex changes. */
export function useTrackPagination(activeIndex, setActiveIndex) {
  const trackRef = useRef(null);
  const scrollToIndex = useTrackScrollSync(trackRef, setActiveIndex);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || activeIndex < 0) return;

    const slides = getTrackSlides(track);
    const slide = slides[activeIndex];
    if (!slide) return;

    const distance = Math.abs(slide.getBoundingClientRect().left - track.getBoundingClientRect().left);
    if (distance < 4) return;

    scrollToIndex(activeIndex);
  }, [activeIndex, scrollToIndex, trackRef]);

  const goToIndex = useCallback(
    (index, event) => {
      if (event) {
        stopPaginationEvent(event);
      }
      setActiveIndex?.(index);
      scrollToIndex(index);
    },
    [scrollToIndex, setActiveIndex],
  );

  return setActiveIndex ? { trackRef, goToIndex } : { trackRef };
}

export function useChildBlocks(clientId) {
  const childBlocks = useSelect(
    (select) => {
      try {
        return select('core/block-editor')?.getBlocks(clientId) || [];
      } catch (err) {
        return [];
      }
    },
    [clientId],
  );
  const childCount = Array.isArray(childBlocks) ? childBlocks.length : 0;
  const { insertBlock, removeBlock, updateBlockAttributes } = useDispatch('core/block-editor');
  return { childBlocks, childCount, insertBlock, removeBlock, updateBlockAttributes };
}

export function ImagePicker({
  imageUrl,
  onSelect,
  onClear,
  addLabel = 'Add image',
  changeLabel = 'Change image',
}) {
  return (
    <MediaUploadCheck>
      <MediaUpload
        onSelect={(media) => onSelect(media)}
        allowedTypes={['image']}
        render={({ open }) => (
          <div>
            {imageUrl ? (
              <div
                onClick={open}
                style={{
                  marginBottom: '8px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid #ddd',
                }}
              >
                <img
                  src={imageUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '80px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            ) : null}
            <Button onClick={open} variant="secondary" style={{ width: '100%' }}>
              {imageUrl ? changeLabel : addLabel}
            </Button>
            {imageUrl && onClear ? (
              <Button onClick={onClear} variant="link" isDestructive style={{ marginTop: '4px' }}>
                Remove image
              </Button>
            ) : null}
          </div>
        )}
      />
    </MediaUploadCheck>
  );
}

export function ParentBlockBackButton({ clientId, label }) {
  const { parentClientId, parentTitle } = useSelect(
    (select) => {
      try {
        const editor = select('core/block-editor');
        if (!editor || !editor.getBlockParents) return { parentClientId: null, parentTitle: '' };
        const parents = editor.getBlockParents(clientId);
        if (!parents || !parents.length) return { parentClientId: null, parentTitle: '' };
        const parentId = parents[parents.length - 1];
        if (!parentId) return { parentClientId: null, parentTitle: '' };

        const parentName = editor.getBlockName ? editor.getBlockName(parentId) : (editor.getBlock(parentId)?.name || '');
        if (!parentName) return { parentClientId: parentId, parentTitle: 'Parent Block' };

        const blockType = editor.getBlockType ? editor.getBlockType(parentName) : null;
        return {
          parentClientId: parentId,
          parentTitle: blockType?.title || 'Parent Block',
        };
      } catch (err) {
        return { parentClientId: null, parentTitle: '' };
      }
    },
    [clientId],
  );

  const { selectBlock } = useDispatch('core/block-editor');

  if (!parentClientId) return null;

  const displayText = label || `Back to ${parentTitle}`;

  return (
    <button
      type="button"
      onClick={() => selectBlock(parentClientId)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '7px 10px',
        marginBottom: '12px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        color: '#0f172a',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        transition: 'all 0.15s ease-in-out',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f1f5f9';
        e.currentTarget.style.borderColor = '#cbd5e1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#f8fafc';
        e.currentTarget.style.borderColor = '#e2e8f0';
      }}
      title={displayText}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="currentColor"
          style={{ color: '#334155', marginLeft: '-1px' }}
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {displayText}
      </span>
    </button>
  );
}

/**
 * Drop-in replacement for `PanelColorSettings` that fixes the color-picker
 * flicker where dragging makes colors rapidly auto-change (often two at once)
 * and only stops after an explicit click.
 *
 * The bundled picker fires `onChange` continuously on every pointer-move during
 * a drag. Committing each move straight to block attributes re-renders the panel
 * and feeds a re-normalized value back into the controlled picker, which then
 * oscillates (hex -> hsva -> hex rounding) and can let a sibling color control
 * pick up the change too. We debounce the commit so nothing re-renders mid-drag:
 * the picker's `value` prop stays frozen (no snap-back, no feedback loop) while
 * its own gradient/thumb still track live, and a single commit lands
 * `commitDelay`ms after the drag settles.
 *
 * API-compatible with `PanelColorSettings` — same `title`/`colorSettings` props.
 */
export function ColorSettingsPanel({ colorSettings = [], commitDelay = 120, ...panelProps }) {
  // Keep the latest caller-provided settings so the debounced commit always
  // calls the current `onChange` (which closes over fresh block attributes).
  const settingsRef = useRef(colorSettings);
  settingsRef.current = colorSettings;

  const timersRef = useRef([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => timer && clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    function handleOutsideClick(event) {
      const target = event?.target;
      if (!target || !(target instanceof Node)) return;

      const hasActiveModal = !!document.querySelector(
        '.components-modal__frame, .components-modal__screen-overlay, .rbb-media-modal, .components-modal, [role="dialog"], s-modal'
      );
      const isInsideModal = target.closest && target.closest(
        '.components-modal__frame, .components-modal__screen-overlay, .rbb-media-modal, .components-modal, [role="dialog"], s-modal, .components-modal__content, .components-modal__header'
      );
      if (hasActiveModal || isInsideModal) return;

      const popovers = Array.from(
        document.querySelectorAll(
          '.components-popover, .components-dropdown__content, .components-color-picker, .components-popover__content, .components-color-palette__picker, .components-dropdown-menu__menu'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

      if (popovers.length === 0) return;

      const isInsidePopover = popovers.some((popover) => popover.contains(target));
      if (isInsidePopover) return;

      const isTrigger = target.closest && target.closest(
        'button, .components-color-palette__item, .components-panel__color-title, [aria-expanded="true"], .components-color-palette__custom-color'
      );
      if (isTrigger && isTrigger.getAttribute('aria-expanded') === 'true') {
        return;
      }

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(escapeEvent);
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.dispatchEvent(escapeEvent);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
    };
  }, []);

  const debouncedSettings = colorSettings.map((setting, index) => ({
    ...setting,
    onChange: (nextColor) => {
      if (timersRef.current[index]) {
        clearTimeout(timersRef.current[index]);
      }
      timersRef.current[index] = setTimeout(() => {
        timersRef.current[index] = null;
        settingsRef.current[index]?.onChange?.(nextColor);
      }, commitDelay);
    },
  }));

  return <PanelColorSettings {...panelProps} colorSettings={debouncedSettings} />;
}
