<script lang="ts">
  import type { DynamicInfo } from "../../../ts/src/protocol";
  const { data }: { data: DynamicInfo } = $props();
</script>

<h2>Dynamic Linking Information</h2>
{#if data.isDynamic}
  <dl class="dynamic-info">
    <dt>SONAME</dt>
    <dd>{data.soname ?? "None"}</dd>
    <dt>DT_NEEDED</dt>
    <dd>{data.neededLibs.join(", ") || "None"}</dd>
    <dt>RPATH</dt>
    <dd>{data.rpath?.join(":") || "None"}</dd>
    <dt>RUNPATH</dt>
    <dd>{data.runpath?.join(":") || "None"}</dd>
  </dl>
{:else}
  <p>No dynamic linking information.</p>
{/if}
