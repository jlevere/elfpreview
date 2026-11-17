<script lang="ts">
  import { columnWidth, minColumnWidth, maxColumnWidth } from "../column-state";
  import type { Sort } from "../ui-state";
  const {
    label,
    width,
    defaultWidth,
    direction,
    onSort,
    onResize,
  }: {
    label: string;
    width: number;
    defaultWidth: number;
    direction: Sort["direction"] | undefined;
    onSort: () => void;
    onResize: (width: number) => void;
  } = $props();
  let resizing: { pointer: number; x: number; width: number } | undefined;
  function startResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    const width = handle.parentElement?.getBoundingClientRect().width ?? 120;
    resizing = { pointer: event.pointerId, x: event.clientX, width };
    handle.setPointerCapture(event.pointerId);
  }
  function moveResize(event: PointerEvent) {
    if (resizing?.pointer === event.pointerId)
      onResize(columnWidth(resizing.width + event.clientX - resizing.x));
  }
  function resizeKey(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault();
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    const width =
      handle.parentElement?.getBoundingClientRect().width ?? defaultWidth;
    onResize(
      columnWidth(
        event.key === "Home"
          ? defaultWidth
          : width +
              (event.key === "ArrowRight" ? 1 : -1) *
                (event.shiftKey ? 50 : 10),
      ),
    );
  }
</script>

<div role="columnheader" aria-sort={direction ?? "none"}>
  <button class="column-sort" onclick={onSort}
    >{label}<span aria-hidden="true"
      >{direction ? (direction === "ascending" ? "↑" : "↓") : ""}</span
    ></button
  >
  <input
    class="column-resize"
    title="Drag to resize. Arrow keys adjust; Home resets."
    type="range"
    aria-label="Resize {label} column"
    min={minColumnWidth}
    max={maxColumnWidth}
    value={width}
    aria-valuetext={width + " pixels"}
    oninput={(event) => onResize(Number(event.currentTarget.value))}
    tabindex="0"
    onpointerdown={startResize}
    onpointermove={moveResize}
    onpointerup={() => (resizing = undefined)}
    onpointercancel={() => (resizing = undefined)}
    onlostpointercapture={() => (resizing = undefined)}
    onkeydown={resizeKey}
  />
</div>
