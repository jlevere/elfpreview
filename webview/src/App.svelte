<script lang="ts">
    let count = $state(0);

    function increment() {
        count += 1;
    }
</script>

<main>
    <h1>ELF Preview Webview</h1>
    <p>Count: {count}</p>
    <button onclick={increment}> Increment </button>
</main>

<style>
    main {
        font-family: system-ui, sans-serif;
        text-align: center;
        padding: 1rem;
    }
</style>
