<script lang="ts">
  import SectionHeadersTable from "./SectionHeadersTable.svelte";
  import ProgramHeadersTable from "./ProgramHeadersTable.svelte";
  import SymbolsTable from "./SymbolsTable.svelte";
  import DynamicInfo from "./DynamicInfo.svelte";
  import type { Types } from "@bininspect";

  export let elf: Types.ElfDetails;

  const sectionHeaders = elf.sections;
  const programHeaders = elf.programHeaders;
  const symbols = elf.symbols;
  const dynInfo = elf.dynlink;
  const dynamic = dynInfo?.isDynamic ?? false;

  let selectedTab = "Sections";
  function switchTab(tab: string) {
    selectedTab = tab;
  }
</script>

<div>
  <div class="tab">
    <button
      class:active={selectedTab === "Sections"}
      on:click={() => switchTab("Sections")}>Sections</button
    >
    <button
      class:active={selectedTab === "Programs"}
      on:click={() => switchTab("Programs")}>Program Headers</button
    >
    <button
      class:active={selectedTab === "Symbols"}
      on:click={() => switchTab("Symbols")}>Symbols</button
    >
    {#if dynamic}
      <button
        class:active={selectedTab === "Dynamic"}
        on:click={() => switchTab("Dynamic")}>Dynamic Info</button
      >
    {/if}
  </div>

  {#if selectedTab === "Sections"}
    <div class="tabcontent active">
      <h3>Section Headers</h3>
      <SectionHeadersTable sections={sectionHeaders} />
    </div>
  {/if}

  {#if selectedTab === "Programs"}
    <div class="tabcontent active">
      <h3>Program Headers</h3>
      <ProgramHeadersTable {programHeaders} />
    </div>
  {/if}

  {#if selectedTab === "Symbols"}
    <div class="tabcontent active">
      <h3>Symbols</h3>
      <SymbolsTable {symbols} />
    </div>
  {/if}

  {#if selectedTab === "Dynamic" && dynamic}
    <div class="tabcontent active">
      <h3>Dynamic Linking Information</h3>
      <DynamicInfo {dynInfo} />
    </div>
  {/if}
</div>
