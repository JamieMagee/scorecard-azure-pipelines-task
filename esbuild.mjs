import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";

await build({
  entryPoints: ["src/index.mts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/index.mjs",
  minify: true,
  plugins: [
    copy({
      assets: [
        {
          from: "src/task.json",
          to: ".",
        },
        {
          from: "assets/policy.yml",
          to: ".",
        },
      ],
    }),
  ],
});
