<script lang="ts">
    import { onMount } from "svelte";
    import type { Types } from "../../ts/src/elfpreview";
    import { VirtualList } from 'svelte-virtuallists';

    let { initialData }: {initialData: {
        filename?: string;
        fileinfo?: Types.Fileinfo;
    }} = $props();

    // Destructure types for easier usage
    type Sectioninfo = Types.Sectioninfo;
    type Programinfo = Types.Programinfo;
    type Symbolinfo = Types.Symbolinfo;
    type Fileinfo = Types.Fileinfo;

    // hydrated props
    let filename = initialData.filename || "Unknown ELF File";
    let fileInfo = $state<Fileinfo | null>(initialData?.fileinfo || null);

    // Rest of component state
    let sectionHeaders = $state<Sectioninfo[]>([]);
    let programHeaders = $state<Programinfo[]>([]);
    let symbols = $state<Symbolinfo[]>([]);
    let sectionsLoaded = $state(false);
    let programsLoaded = $state(false);
    let symbolsLoaded = $state(false);
    let error = $state<string | null>(null);
    let stripped = $state('');
    let loadState = $state('loading');
    

    // Message types for staged loading
    type MessageType = 
        | "strip-info"
        | "section-info" 
        | "program-info" 
        | "symbol-info" 
        | "parse-complete" 
        | "request-elf-info" 
        | "error";
    
    type Payload = {
        type: MessageType;
        data?: any;
        error?: string;
    };

     // Handle incoming messages with staged loading
     function handleMessage(event: MessageEvent<Payload>) {
        const message = event.data;
        
        switch (message.type) {
            case "strip-info":
                stripped = message.data || '';
                break;

            case "section-info":
                sectionHeaders = message.data || [];
                sectionsLoaded = true;
                loadState = 'sections-loaded';
                break;
                
            case "program-info":
                programHeaders = message.data || [];
                programsLoaded = true;
                loadState = 'programs-loaded';
                break;
                
            case "symbol-info":
                symbols = message.data || [];
                symbolsLoaded = true;
                loadState = 'symbols-loaded';
                break;
                
            case "parse-complete":
                loadState = 'complete';
                break;
                
            case "error":
                error = message.error || "Unknown error";
                loadState = 'error';
                break;
        }
    }

    onMount(() => {
        // Setup message listener
        window.addEventListener("message", handleMessage);
        
        // Cleanup listener on unmount
        return () => {
            window.removeEventListener("message", handleMessage);
        };
    });

    let selectedTab = $state('Sections');

     // Symbol filter state
     let symbolFilter = $state('');
    
     let filteredSymbols = $derived(symbols.filter(symbol => 
        symbol.name.toLowerCase().includes(symbolFilter.toLowerCase())
    ));
    
    // Tab switching
    function switchTab(tab: string) {
        selectedTab = tab;
    }

</script>

<div class="container">
    <h1>
        {filename} 
        {#if stripped == 'true'}
            <span class="badge" title="Debug symbols have been removed">Stripped</span>
        {:else if stripped == 'false'}
            <span class="badge debug-symbols">Debug Symbols</span>
        {/if}
    </h1>

    <div class="basic-info">
        <h2>File Information</h2>
        <div class="file-info-grid">
            <div class="file-metadata">
                <table>
                    <thead>
                        <tr><th>File Type:</th><td>{fileInfo?.filetype}</td></tr>
                        <tr><th>Machine Architecture:</th><td>{fileInfo?.machine}</td></tr>
                        <tr><th>Class:</th><td>{fileInfo?.class}</td></tr>
                        <tr><th>Endianness:</th><td>{fileInfo?.endianness}</td></tr>
                        <tr><th>OS ABI:</th><td>{fileInfo?.osabi}</td></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <div class="file-metadata">
                <table>
                    <thead>
                        <tr><th>Entry Point:</th><td>0x{fileInfo?.entrypoint}</td></tr>
                        <tr><th>ELF Version:</th><td>{fileInfo?.version}</td></tr>
                        <tr><th>Symbols:</th><td>{symbols.length}</td></tr>
                        <tr><th>Sections:</th><td>{sectionHeaders.length}</td></tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    </div>
        
    <div class="tab">
        <button class:active={selectedTab === 'Sections'} onclick={() => switchTab('Sections')}>Sections</button>
        <button class:active={selectedTab === 'Programs'} onclick={() => switchTab('Programs')}>Program Headers</button>
        <button class:active={selectedTab === 'Symbols'} onclick={() => switchTab('Symbols')}>Symbols</button>
    </div>

    {#if selectedTab === 'Sections'}
        <div class="tabcontent active">
            <h3>Section Headers</h3>
            {#if !sectionsLoaded}
                <p>Loading Sections...</p>
            {:else}
            <div class="virtual-table-container">
                <div class="table-header">
                    <div class="name-col">Name</div>
                    <div class="type-col">Type</div>
                    <div class="addr-col">Address</div>
                    <div class="size-col">Size</div>
                </div>
                <VirtualList items={sectionHeaders} style="height: 350px; width: 100%;">
                    {#snippet vl_slot({ item, index })}
                        <div class="table-row">
                            <div class="name-col">{item.name}</div>
                            <div class="type-col">{item.typename}</div>
                            <div class="addr-col">0x{item.address}</div>
                            <div class="size-col">{item.size}</div>
                        </div>
                    {/snippet}
                </VirtualList>
            </div>
            {/if}
        </div>
    {/if}

    {#if selectedTab === 'Programs'}
        <div class="tabcontent active">
            <h3>Program Headers</h3>
            {#if !programsLoaded}
                <p>Loading Program Headers...</p>
            {:else}
            <div class="virtual-table-container">
                <div class="table-header">
                    <div class="type-col">Type</div>
                    <div class="flags-col">Flags</div>
                    <div class="vaddr-col">Virtual Address</div>
                    <div class="paddr-col">Physical Address</div>
                    <div class="filesz-col">File Size</div>
                    <div class="memsz-col">Mem Size</div>
                </div>
                <VirtualList items={programHeaders} style="height: 350px; width: 100%;">
                    {#snippet vl_slot({ item, index })}
                        <div class="table-row">
                            <div class="type-col">{item.typename}</div>
                            <div class="flags-col">{item.flagstring}</div>
                            <div class="vaddr-col">0x{item.vaddr}</div>
                            <div class="paddr-col">0x{item.paddr}</div>
                            <div class="filesz-col">{item.filesz}</div>
                            <div class="memsz-col">{item.memsz}</div>
                        </div>
                    {/snippet}
                </VirtualList>
            </div>
            {/if}
        </div>
    {/if}

    {#if selectedTab === 'Symbols'}
        <div class="tabcontent active">
            <h3>Symbols</h3>
            {#if !symbolsLoaded}
                <p>Loading Symbols...</p>
            {:else}
            <div class="filter-container">
                <input type="text" bind:value={symbolFilter} placeholder="Filter..."/>
                <span class="count-badge">{filteredSymbols.length} of {symbols.length} symbols</span>
            </div>
            <div class="virtual-table-container">
                <div class="table-header">
                    <div class="name-col">Name</div>
                    <div class="value-col">Value</div>
                    <div class="size-col">Size</div>
                    <div class="type-col">Is Function</div>
                </div>
                <VirtualList items={filteredSymbols} style="height: 350px; width: 100%;">
                    {#snippet vl_slot({ item, index })}
                        <div class="table-row">
                            <div class="name-col" role="tooltip" title={item.name}>{item.name}</div>
                            <div class="value-col">0x{item.value}</div>
                            <div class="size-col">{item.size}</div>
                            <div class="type-col">{item.isfunction}</div>
                        </div>
                    {/snippet}
                </VirtualList>
            </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    :global(body) {
        font-family: var(--vscode-editor-font-family);
        padding: 0;
        margin: 0;
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
    }

    .container {
        padding: 20px;
    }

    h1, h2, h3 {
        color: var(--vscode-editor-foreground);
        border-bottom: 1px solid var(--vscode-panel-border);
        padding-bottom: 5px;
    }

    table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 20px;
    }

    th, td {
        border: 1px solid var(--vscode-panel-border);
        padding: 8px;
        text-align: left;
    }

    th {
        background-color: var(--vscode-panel-background);
    }

    tr:nth-child(even) {
        background-color: var(--vscode-list-inactiveSelectionBackground);
    }

    .tab {
        overflow: hidden;
        border: 1px solid var(--vscode-panel-border);
        background-color: var(--vscode-panel-background);
    }

    .tab button {
        background-color: inherit;
        color: var(--vscode-editor-foreground);
        float: left;
        border: none;
        outline: none;
        cursor: pointer;
        padding: 10px 16px;
        transition: 0.3s;
    }

    .tab button.active {
        background-color: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
    }

    .tabcontent {
        display: none;
        padding: 6px 12px;
        border: 1px solid var(--vscode-panel-border);
        border-top: none;
    }

    .tabcontent.active {
        display: block;
    }

    .file-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }

    .file-metadata {
        margin-bottom: 20px;
    }

    .badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 4px;
        margin-left: 10px;
        font-size: 12px;
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
    }

    .debug-symbols {
        color: black;
        background-color: var(--vscode-debugIcon-startForeground);
    }

    input[type="text"] {
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        padding: 8px 12px;
        color: var(--vscode-editor-foreground);
        margin-bottom: 10px;
        border-radius: 4px;
        width: 100px;
    }

    input[type="text"]:focus {
        border: 1px solid var(--vscode-focusBorder);
        box-shadow: 0 0 4px var(--vscode-focusBorder);
    }

    .virtual-table-container {
        width: 100%;
        border: 1px solid var(--vscode-panel-border, #333333);
        border-radius: 4px;
        overflow: hidden;
    }

    .table-header, .table-row {
        display: flex;
        width: 100%;
        box-sizing: border-box;
    }

    .table-header {
        background-color: var(--vscode-editor-lineHighlightBackground, #2a2d2e);
        font-weight: 500;
        border-bottom: 1px solid var(--vscode-panel-border, #333333);
        position: sticky;
        top: 0;
        z-index: 1;
    }

    .table-header > div, .table-row > div {
        padding: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .table-row {
        border-bottom: 1px solid var(--vscode-panel-border, #333333);
    }

    .table-row:hover {
        background-color: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    :global(.virtual-table-container .svelte-virtuallist) {
        width: 100% !important;
    }

    :global(.virtual-table-container .svelte-virtuallist-contents) {
        width: 100% !important;
    }

    @media (max-width: 768px) {
        .file-info-grid {
            grid-template-columns: 1fr;
        }
    }

    /* Column widths */
    .name-col { flex: 2; min-width: 150px; }
    .type-col { flex: 1.5; min-width: 120px; }
    .addr-col, .value-col { flex: 1; min-width: 100px; }
    .size-col { flex: 0.8; min-width: 80px; }
    .flags-col { flex: 0.8; min-width: 80px; }
    .vaddr-col, .paddr-col { flex: 1; min-width: 100px; }
    .filesz-col, .memsz-col { flex: 0.8; min-width: 80px; }
    
    /* Additional columns for Programs table */
    .flags-col { width: 15%; min-width: 60px; }
    .vaddr-col, .paddr-col { width: 20%; min-width: 100px; }
    .filesz-col, .memsz-col { width: 15%; min-width: 80px; }
</style>