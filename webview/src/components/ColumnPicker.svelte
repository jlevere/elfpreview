<script lang="ts">
  import { onMount } from "svelte";
  const {
    columns,
    shown,
    onChange,
    onReset,
  }: {
    columns: string[];
    shown: string[];
    onChange: (column: string, shown: boolean) => void;
    onReset: () => void;
  } = $props();
  let picker: HTMLDetailsElement;
  onMount(() => {
    const dismiss = (event: PointerEvent) => {
      if (
        picker.open &&
        event.target instanceof Node &&
        !picker.contains(event.target)
      )
        picker.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && picker.open) {
        picker.open = false;
        picker.querySelector("summary")?.focus();
        event.preventDefault();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  });
</script>

<details class="column-picker" bind:this={picker}>
  <summary>Columns</summary>
  <div class="column-menu" aria-label="Visible columns">
    {#each columns as column (column)}
      <label
        ><input
          type="checkbox"
          checked={shown.includes(column)}
          disabled={shown.length === 1 && shown.includes(column)}
          onchange={(event) => onChange(column, event.currentTarget.checked)}
        />{column}</label
      >
    {/each}
    <button class="secondary" onclick={onReset}>Reset columns</button>
  </div>
</details>
