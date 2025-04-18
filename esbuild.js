const esbuild = require("esbuild");
const sveltePlugin = require("esbuild-svelte");
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");
const sveltePreprocess = require("svelte-preprocess");

async function main() {
  const extensionConfig = {
    entryPoints: ["ts/src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "warning",
  };

  const webviewConfig = {
    entryPoints: ["webview/src/main.ts"],
    bundle: true,
    format: "esm",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "browser",
    target: ["es2020"],
    outfile: "dist/webview.js",
    plugins: [
      sveltePlugin({
        preprocess: sveltePreprocess(),
        compilerOptions: {
          dev: !production,
        },
      }),
    ],
    conditions: ["svelte"],
  };

  const ctx = await esbuild.context({
    ...extensionConfig,
    plugins: [esbuildProblemMatcherPlugin],
  });

  const webviewCtx = await esbuild.context(webviewConfig);

  if (watch) {
    await ctx.watch();
    await webviewCtx.watch();
  } else {
    await ctx.rebuild();
    await webviewCtx.rebuild();
    await ctx.dispose();
    await webviewCtx.dispose();
  }
}

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`,
        );
      });
      console.log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
