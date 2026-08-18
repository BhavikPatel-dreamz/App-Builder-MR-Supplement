-- Reusable sticky-header / sticky-footer references. Sticky slots now point at
-- the same header/footer-type Page records used by `headerId`/`footerId`, so a
-- component can be built once and reused across pages.
ALTER TABLE "Page" ADD COLUMN     "stickyHeaderId" TEXT,
ADD COLUMN     "stickyFooterId" TEXT;
