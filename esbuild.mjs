import { build } from "esbuild";
import { copy } from "esbuild-plugin-copy";
import fs from "node:fs";

const result = await build({
  entryPoints: ["src/index.mts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/index.mjs",
  minify: true,
  metafile: true,
  plugins: [
    copy({
      assets: {
        from: "src/task.json",
        to: ".",
      },
    }),
  ],
});

fs.writeFileSync("dist/meta.json", JSON.stringify(result.metafile, null, 2));
