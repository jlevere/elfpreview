<script lang="ts">
  import type { Types } from "@bininspect";

  export let dynInfo: Types.ElfDynlinkInfo | undefined;
</script>

{#if dynInfo?.isDynamic}
  <div class="virtual-table-container">
    <div class="table-header">
      <div class="name-col">Property</div>
      <div class="value-col">Value</div>
    </div>

    {#if dynInfo.soname}
      <div class="table-row">
        <div class="name-col">SONAME</div>
        <div class="value-col">{dynInfo.soname}</div>
      </div>
    {/if}

    <div class="table-row">
      <div class="value-col">
        {#if dynInfo.neededLibs?.length}
          {#each dynInfo.neededLibs as lib, i (lib)}
            <div class="table-row">
              {#if i === 0}
                <div class="name-col">DT_NEEDED</div>
              {:else}
                <div class="name-col"></div>
              {/if}
              <div
                class="value-col"
                role="tooltip"
                title="Resolved at load time, so no path"
              >
                {lib}
              </div>
            </div>
          {/each}
        {:else}
          <div class="table-row">
            <div class="name-col">DT_NEEDED</div>
            <div class="value-col">None</div>
          </div>
        {/if}
      </div>
    </div>

    <div class="table-row">
      <div class="name-col">RPATH</div>
      <div class="value-col">
        {#if dynInfo.rpath?.length}
          <ul>
            {#each dynInfo.rpath as path (path)}
              <li role="tooltip" title={path}>{path}</li>
            {/each}
          </ul>
        {:else}
          None
        {/if}
      </div>
    </div>

    <div class="table-row">
      <div class="name-col">RUNPATH</div>
      <div class="value-col">
        {#if dynInfo.runpath?.length}
          <ul>
            {#each dynInfo.runpath as path (path)}
              <li role="tooltip" title={path}>{path}</li>
            {/each}
          </ul>
        {:else}
          None
        {/if}
      </div>
    </div>
  </div>
{:else}
  <p>This binary is statically linked.</p>
{/if}
