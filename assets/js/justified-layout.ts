/*!
 * Original work Copyright 2019 SmugMug, Inc.
 * Modified work Copyright 2025 Nico Kaiser
 * Licensed under the terms of the MIT license.
 */

export interface LayoutOptions {
  rowHeight: number;
  rowWidth: number;
  spacing: number;
  heightTolerance: number;
}

/**
 * Row
 * Wrapper for each row in a justified layout.
 */
class Row {
  top: number;
  rowWidth: number;
  spacing: number;
  rowHeight: number;
  heightTolerance: number;
  minAspectRatio: number;
  maxAspectRatio: number;
  items: {
    aspectRatio: number;
    top?: number;
    width?: number;
    height?: number;
    left?: number;
  }[] = [];
  height = 0;

  constructor(params: LayoutOptions & { top: number }) {
    this.top = params.top;
    this.rowWidth = params.rowWidth;
    this.spacing = params.spacing;
    this.rowHeight = params.rowHeight;
    this.heightTolerance = params.heightTolerance;

    this.minAspectRatio = (this.rowWidth / params.rowHeight) * (1 - params.heightTolerance);
    this.maxAspectRatio = (this.rowWidth / params.rowHeight) * (1 + params.heightTolerance);
  }

  addItem(aspectRatio: number): boolean {
    const itemData = { aspectRatio };
    const newItems = this.items.concat(itemData);
    const rowWidthWithoutSpacing = this.rowWidth - (newItems.length - 1) * this.spacing;
    const newAspectRatio = newItems.reduce((sum, item) => sum + item.aspectRatio, 0);
    const targetAspectRatio = rowWidthWithoutSpacing / this.rowHeight;

    if (newAspectRatio < this.minAspectRatio) {
      this.items.push(itemData);
      return true;
    } else if (newAspectRatio > this.maxAspectRatio) {
      if (this.items.length === 0) {
        this.items.push(itemData);
        this.completeLayout(rowWidthWithoutSpacing / newAspectRatio);
        return true;
      }

      const previousRowWidthWithoutSpacing = this.rowWidth - (this.items.length - 1) * this.spacing;
      const previousAspectRatio = this.items.reduce((sum, item) => sum + item.aspectRatio, 0);
      const previousTargetAspectRatio = previousRowWidthWithoutSpacing / this.rowHeight;

      if (Math.abs(newAspectRatio - targetAspectRatio) > Math.abs(previousAspectRatio - previousTargetAspectRatio)) {
        this.completeLayout(previousRowWidthWithoutSpacing / previousAspectRatio);
        return false;
      } else {
        this.items.push(itemData);
        this.completeLayout(rowWidthWithoutSpacing / newAspectRatio);
        return true;
      }
    } else {
      this.items.push(itemData);
      this.completeLayout(rowWidthWithoutSpacing / newAspectRatio);
      return true;
    }
  }

  /**
   * Complete row layout
   * @param isLastRow - if true, center items horizontally
   */
  completeLayout(newHeight: number, isLastRow = false) {
    const rowWidthWithoutSpacing = this.rowWidth - (this.items.length - 1) * this.spacing;
    const clampedHeight = Math.max(0.5 * this.rowHeight, Math.min(newHeight, 2 * this.rowHeight));
    this.height = clampedHeight;

    // Compute item geometry
    let itemWidthSum = 0;
    this.items.forEach(item => {
      item.top = this.top;
      item.width = item.aspectRatio * this.height;
      item.height = this.height;
      item.left = itemWidthSum;
      itemWidthSum += item.width + this.spacing;
    });

    // Center last row if needed
    if (isLastRow) {
      const totalRowWidth = itemWidthSum - this.spacing;
      const offset = (this.rowWidth - totalRowWidth) / 2;
      this.items.forEach(item => {
        item.left! += offset;
      });
    }
  }
}

/**
 * Justified layout
 */
export default function(aspectRatios: number[], layoutOptions: LayoutOptions) {
  let containerHeight = 0;
  let boxes: {
    aspectRatio: number;
    top?: number;
    width?: number;
    height?: number;
    left?: number;
  }[] = [];

  let currentRow: Row | null = null;
  let lastRowHeight = 0;

  for (const aspectRatio of aspectRatios) {
    if (!currentRow) {
      currentRow = new Row({ top: containerHeight, ...layoutOptions });
    }

    let itemAdded = currentRow.addItem(aspectRatio);

    if (currentRow.height > 0) {
      lastRowHeight = currentRow.height;
      boxes = boxes.concat(currentRow.items);
      containerHeight += currentRow.height + layoutOptions.spacing;
      currentRow = new Row({ top: containerHeight, ...layoutOptions });

      if (!itemAdded) {
        itemAdded = currentRow.addItem(aspectRatio);
        if (currentRow.height > 0) {
          lastRowHeight = currentRow.height;
          boxes = boxes.concat(currentRow.items);
          containerHeight += currentRow.height + layoutOptions.spacing;
          currentRow = new Row({ top: containerHeight, ...layoutOptions });
        }
      }
    }
  }

  // Handle leftover items (last row)
  if (currentRow && currentRow.items.length) {
    currentRow.completeLayout(lastRowHeight || layoutOptions.rowHeight, true); // <--- center last row
    boxes = boxes.concat(currentRow.items);
    containerHeight += currentRow.height + layoutOptions.spacing;
  }

  containerHeight -= layoutOptions.spacing; // remove extra spacing
  return { containerHeight, boxes };
}
