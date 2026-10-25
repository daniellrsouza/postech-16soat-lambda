// Gera um bundle CommonJS por função em dist/<funcao>/index.js (handler:
// index.handler). O auth-cpf leva junto o bundle de CAs do RDS.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";

const funcoes = ["auth-cpf", "authorizer"];

rmSync("dist", { recursive: true, force: true });

for (const funcao of funcoes) {
  await build({
    entryPoints: [`src/${funcao}/handler.ts`],
    outfile: `dist/${funcao}/index.js`,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    minify: true,
    sourcemap: false,
    // Dependência opcional do pg, não usada.
    external: ["pg-native"],
    logLevel: "warning",
  });
}

mkdirSync("dist/auth-cpf", { recursive: true });
copyFileSync("certs/rds-global-bundle.pem", "dist/auth-cpf/rds-global-bundle.pem");

console.log(`build ok: ${funcoes.map((f) => `dist/${f}/index.js`).join(", ")}`);
