/*!
 * Justified layout with optimal line breaking.
 * Replaces the greedy SmugMug-based layout shipped with hugo-theme-gallery.
 * Licensed under the terms of the MIT license.
 */

export interface LayoutOptions {
  rowHeight: number;
  rowWidth: number;
  spacing: number;
}

export interface Box {
  aspectRatio: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Lays out items in rows that all span the full row width — including the last
 * row, so there are never orphaned images.
 *
 * A greedy algorithm fills rows one after another and has to take whatever is
 * left over for the last row. Instead, this considers every possible way to
 * split the (ordered) items into rows and picks the split whose row heights are
 * closest to the target row height overall (dynamic programming, O(n²)).
 * Each row is then scaled so that it exactly fills the available width.
 */
export default function (aspectRatios: number[], { rowHeight, rowWidth, spacing }: LayoutOptions) {
  const n = aspectRatios.length;

  // prefix[i] = sum of the first i aspect ratios
  const prefix = [0];
  aspectRatios.forEach((ar, i) => prefix.push(prefix[i] + ar));

  // Height of a row holding items [start, end) scaled to fill the full width
  const heightOf = (start: number, end: number) =>
    (rowWidth - (end - start - 1) * spacing) / (prefix[end] - prefix[start]);

  // Deviation from the target height, symmetric for too tall / too short rows
  const costOf = (height: number) => (height > 0 ? Math.log(height / rowHeight) ** 2 : Infinity);

  // best[i] = lowest total cost for laying out the first i items; breakAt[i] = start of the last row
  const best = [0];
  const breakAt = [0];
  for (let end = 1; end <= n; end++) {
    best[end] = Infinity;
    for (let start = end - 1; start >= 0; start--) {
      const cost = best[start] + costOf(heightOf(start, end));
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
    let left = 0;
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
