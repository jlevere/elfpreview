<script lang="ts">
    import { onMount } from "svelte";
    import type { Types } from "../../ts/src/elfpreview";

    // Destructure types for easier usage
    type Sectioninfo = Types.Sectioninfo;
    type Programinfo = Types.Programinfo;
    type Symbolinfo = Types.Symbolinfo;
    type Fileinfo = Types.Fileinfo;
    type Elfinfo = Types.Elfinfo;

    // Message type for communication
    type MessageType = "initial-load" | "request-elf-info" | "error";

    type Payload = {
        type: MessageType;
        data?: Elfinfo;
        error?: string;
    };

    // State for the application
    let elfInfo = $state<Elfinfo | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // Webview communication
    function sendMessage(message: Payload) {
        // @ts-ignore
        window.vscode.postMessage(message);
    }

    // Handle incoming messages
    function handleMessage(event: MessageEvent<Payload>) {
        const message = event.data;
        switch (message.type) {
            case "initial-load":
                elfInfo = message.data || null;
                isLoading = false;
                break;
            case "error":
                error = message.error || "Unknown error";
                isLoading = false;
                break;
        }
    }

    // Computed properties for easy access
    const sections = $derived(elfInfo?.sectionheaders || []);
    const symbols = $derived(elfInfo?.symbols || []);
    const programHeaders = $derived(elfInfo?.programheaders || []);
    const fileInfo = $derived(elfInfo?.info);

    onMount(() => {
        // Setup message listener
        window.addEventListener("message", handleMessage);

        // Request ELF information
        sendMessage({ type: "request-elf-info" });

        // Cleanup listener on unmount
        return () => {
            window.removeEventListener("message", handleMessage);
        };
    });

    // Utility function to format bigint
    function formatBigInt(value: bigint): string {
        return value.toString(16).toUpperCase(); // Hex representation
    }
</script>

<main>
    {#if isLoading}
        <p>Loading ELF information...</p>
    {:else if error}
        <p class="error">Error: {error}</p>
    {:else if elfInfo}
        <div class="elf-preview">
            <section class="file-info">
                <h2>File Information</h2>
                {#if fileInfo}
                    <dl>
                        <dt>Machine</dt>
                        <dd>{fileInfo.machine}</dd>

                        <dt>Entry Point</dt>
                        <dd>0x{formatBigInt(fileInfo.entrypoint)}</dd>

                        <dt>Class</dt>
                        <dd>{fileInfo.class}</dd>

                        <dt>Endianness</dt>
                        <dd>{fileInfo.endianness}</dd>

                        <dt>OS ABI</dt>
                        <dd>{fileInfo.osabi}</dd>

                        <dt>File Type</dt>
                        <dd>{fileInfo.filetype}</dd>

                        <dt>Version</dt>
                        <dd>{fileInfo.version}</dd>

                        <dt>Stripped</dt>
                        <dd>{fileInfo.stripped ? "Yes" : "No"}</dd>
                    </dl>
                {/if}
            </section>

            <section class="sections">
                <h2>Sections ({sections.length})</h2>
                {#if sections.length}
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Address</th>
                                <th>Size</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each sections as section}
                                <tr>
                                    <td>{section.name}</td>
                                    <td>{section.typename}</td>
                                    <td>0x{formatBigInt(section.address)}</td>
                                    <td>{section.size.toString()} bytes</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {:else}
                    <p>No sections found.</p>
                {/if}
            </section>

            <section class="symbols">
                <h2>Symbols ({symbols.length})</h2>
                {#if symbols.length}
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Value</th>
                                <th>Size</th>
                                <th>Function</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each symbols as symbol}
                                <tr>
                                    <td>{symbol.name}</td>
                                    <td>0x{formatBigInt(symbol.value)}</td>
                                    <td>{symbol.size.toString()} bytes</td>
                                    <td>{symbol.isfunction ? "Yes" : "No"}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {:else}
                    <p>No symbols found.</p>
                {/if}
            </section>

            <section class="program-headers">
                <h2>Program Headers ({programHeaders.length})</h2>
                {#if programHeaders.length}
                    <table>
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Flags</th>
                                <th>Virtual Address</th>
                                <th>Physical Address</th>
                                <th>File Size</th>
                                <th>Memory Size</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each programHeaders as header}
                                <tr>
                                    <td>{header.typename}</td>
                                    <td>{header.flagstring}</td>
                                    <td>0x{formatBigInt(header.vaddr)}</td>
                                    <td>0x{formatBigInt(header.paddr)}</td>
                                    <td>{header.filesz.toString()} bytes</td>
                                    <td>{header.memsz.toString()} bytes</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {:else}
                    <p>No program headers found.</p>
                {/if}
            </section>
        </div>
    {/if}
</main>

<style>
    main {
        font-family: system-ui, sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        padding: 1rem;
        background-color: #f4f4f4;
    }

    .elf-preview {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    section {
        background-color: white;
        border-radius: 8px;
        padding: 1rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    h2 {
        border-bottom: 2px solid #e0e0e0;
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
    }

    dl {
        display: grid;
        grid-template-columns: max-content auto;
        gap: 0.5rem;
    }

    dt {
        font-weight: bold;
        color: #333;
    }

    dd {
        margin: 0;
        color: #666;
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th,
    td {
        border: 1px solid #e0e0e0;
        padding: 0.5rem;
        text-align: left;
    }

    th {
        background-color: #f8f8f8;
        font-weight: bold;
    }

    .error {
        color: red;
        font-weight: bold;
    }
</style>
