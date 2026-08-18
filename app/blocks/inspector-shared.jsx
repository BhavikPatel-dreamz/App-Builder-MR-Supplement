// @ts-nocheck
import { useRef, useEffect, useCallback } from 'gutenberg-block-kit/wp/element';
import { MediaUpload, MediaUploadCheck } from 'gutenberg-block-kit/wp/block-editor';
import { Button } from 'gutenberg-block-kit/wp/components';
import { useSelect, useDispatch } from 'gutenberg-block-kit/wp/data';

export const contentTabStyle = {
  padding: '0 16px 16px',
  maxHeight: 'calc(100vh - 220px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
};

export function imageAttributesFromMedia(media, urlKey = 'imageUrl') {
  return {
    [urlKey]: media?.url ?? '',
    imageWidth: media?.width ?? 0,
    imageHeight: media?.height ?? 0,
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
  className = 'riyasat-pagination',
  dotClassName = 'riyasat-pagination__dot',
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
    (select) => select('core/block-editor').getBlocks(clientId),
    [clientId],
  );
  const childCount = childBlocks.length;
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
