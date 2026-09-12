/*!
 * Justified layout with optimal line breaking.
 * Replaces the greedy SmugMug-based layout shipped with hugo-theme-gallery.
 * Licensed under the terms of the MIT license.
 */

export interface LayoutOptions {
  rowHeight: number;
  rowWidth: number;
  spacing: number;
  /**
   * Largest height a row may be stretched to in order to span the full width.
   * A row that would have to grow beyond it falls back to `rowHeight` and is
   * centred in the width it leaves. Defaults to `rowHeight * MAX_STRETCH`.
   */
  maxRowHeight?: number;
}

export interface Box {
  aspectRatio: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Default limit on how far past the target height a row may be stretched to
 * span the full width. Generous enough that rows which only just overshoot the
 * target still justify, tight enough to catch the two-or-three-image galleries
 * that would otherwise be blown up to several times the target height.
 */
const MAX_STRETCH = 1.5;

/**
 * Penalty added for every unit of row width left unfilled by a row that hit the
 * stretch limit, relative to the width that row would need. Chosen high enough
 * that a genuinely justifiable layout always beats a ragged one — a ragged row
 * is only ever picked when there are too few images to fill it at a sane size.
 */
const RAGGED_PENALTY = 4;

/**
 * Lays out items in rows that span the full row width — including the last row,
 * so there are never orphaned images.
 *
 * A greedy algorithm fills rows one after another and has to take whatever is
 * left over for the last row. Instead, this considers every possible way to
 * split the (ordered) items into rows and picks the split whose row heights are
 * closest to the target row height overall (dynamic programming, O(n²)).
 * Each row is then scaled so that it exactly fills the available width.
 *
 * Galleries holding too few images to fill a single row are the exception: a
 * row is never stretched past `maxRowHeight`, so two or three images do not get
 * blown up to banner size. Such a row falls back to the plain target height —
 * the size the previous (greedy) layout gave leftovers — and is centred in the
 * width it leaves unused.
 */
export default function (aspectRatios: number[], { rowHeight, rowWidth, spacing, maxRowHeight }: LayoutOptions) {
  const n = aspectRatios.length;
  const maxHeight = maxRowHeight && maxRowHeight > 0 ? maxRowHeight : rowHeight * MAX_STRETCH;

  // prefix[i] = sum of the first i aspect ratios
  const prefix = [0];
  aspectRatios.forEach((ar, i) => prefix.push(prefix[i] + ar));

  // Height a row holding items [start, end) needs in order to fill the full width
  const fullWidthHeightOf = (start: number, end: number) =>
    (rowWidth - (end - start - 1) * spacing) / (prefix[end] - prefix[start]);

  // ... and the height it is actually laid out at: the full-width height while
  // that stays within the stretch limit, the plain target height once it does not
  const heightOf = (start: number, end: number) => {
    const fullHeight = fullWidthHeightOf(start, end);
    return fullHeight <= maxHeight ? fullHeight : rowHeight;
  };

  // Deviation from the target height (symmetric for too tall / too short rows),
  // plus the penalty for the width a fallback row fails to cover. Item widths
  // scale with the row height, so the covered fraction is height / fullHeight.
  const costOf = (start: number, end: number) => {
    const fullHeight = fullWidthHeightOf(start, end);
    if (!(fullHeight > 0)) return Infinity;
    if (fullHeight <= maxHeight) return Math.log(fullHeight / rowHeight) ** 2;
    return RAGGED_PENALTY * (1 - rowHeight / fullHeight);
  };

  // best[i] = lowest total cost for laying out the first i items; breakAt[i] = start of the last row
  const best = [0];
  const breakAt = [0];
  for (let end = 1; end <= n; end++) {
    best[end] = Infinity;
    for (let start = end - 1; start >= 0; start--) {
      const cost = best[start] + costOf(start, end);
      if (cost < best[end]) {
        best[end] = cost;
        breakAt[end] = start;
      }
    }
  }

  // Walk back through the chosen breaks to recover the rows
  const rows: [number, number][] = [];
  for (let end = n; end > 0; end = breakAt[end]) {
    rows.unshift([breakAt[end], end]);
  }

  const boxes: Box[] = [];
  let top = 0;
  for (const [start, end] of rows) {
    const height = heightOf(start, end);

    // Rows that fell back to the target height do not span the full width; the
    // leftover is split evenly so they sit centred. Justified rows use it all,
    // which leaves the offset at zero.
    const usedWidth = (prefix[end] - prefix[start]) * height + (end - start - 1) * spacing;
    let left = Math.max(0, (rowWidth - usedWidth) / 2);

    for (let i = start; i < end; i++) {
      const width = aspectRatios[i] * height;
      boxes.push({ aspectRatio: aspectRatios[i], top, left, width, height });
      left += width + spacing;
    }
    top += height + spacing;
  }

  const containerHeight = Math.max(0, top - spacing);
  return { containerHeight, boxes };
}
