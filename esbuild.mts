import * as esbuild from "esbuild";
import sveltePlugin from "esbuild-svelte";
const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const extensionConfig: esbuild.BuildOptions = {
    entryPoints: ["ts/src/extension.ts", "ts/src/worker.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    target: "node20",
    outdir: "dist",
    external: ["vscode"],
    logLevel: "warning",
  };

  const webviewConfig: esbuild.BuildOptions = {
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
        compilerOptions: {
          dev: !production,
        },
      }),
    ],
    conditions: ["svelte"],
  };

  const configs = [
    { ...extensionConfig, plugins: [esbuildProblemMatcherPlugin] },
    webviewConfig,
  ];
  if (watch) {
    for (const config of configs) {
      const context = await esbuild.context(config);
      await context.watch();
    }
  } else {
    await Promise.all(configs.map((config) => esbuild.build(config)));
  }
}

const esbuildProblemMatcherPlugin: esbuild.Plugin = {
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
