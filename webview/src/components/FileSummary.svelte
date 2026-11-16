<script lang="ts">
  import type { ElfInfo } from "../../../ts/src/protocol";
  import { address } from "../ui-state";
  const { data }: { data: ElfInfo } = $props();
</script>

<section class="basic-info" aria-label="File information">
  <h2>File Information</h2>
  <dl class="metadata">
    <div>
      <dt>File Type</dt>
      <dd>{data.info.filetype}</dd>
    </div>
    <div>
      <dt>Machine Architecture</dt>
      <dd>{data.info.machine}</dd>
    </div>
    <div>
      <dt>Class</dt>
      <dd>{data.info.class}</dd>
    </div>
    <div>
      <dt>Endianness</dt>
      <dd>{data.info.endianness}</dd>
    </div>
    <div>
      <dt>OS ABI</dt>
      <dd>{data.info.osabi}</dd>
    </div>
    <div>
      <dt>Entry Point</dt>
      <dd>{address(data.info.entrypoint, data.info.class)}</dd>
    </div>
    <div>
      <dt>ELF Version</dt>
      <dd>{data.info.version}</dd>
    </div>
    <div>
      <dt>Static Symbols</dt>
      <dd>{data.symbols.length}</dd>
    </div>
    <div>
      <dt>Sections</dt>
      <dd>{data.sectionheaders.length}</dd>
    </div>
    <div>
      <dt>Program Headers</dt>
      <dd>{data.programheaders.length}</dd>
    </div>
    {#if data.dynlink.interpreter}<div>
        <dt>Interpreter</dt>
        <dd>{data.dynlink.interpreter}</dd>
      </div>{/if}
  </dl>
</section>
