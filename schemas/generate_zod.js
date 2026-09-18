const { jsonSchemaToZod } = require("json-schema-to-zod");
const fs = require("fs");
const { resolveRefs } = require('json-refs');

async function main() {
  const schema = JSON.parse(fs.readFileSync("schema.json", "utf8"));
  const { resolved } = await resolveRefs(schema);
  const moduleCode = jsonSchemaToZod(resolved, { name: "RealEstateData", module: "esm" });
  fs.writeFileSync("generated/zod.ts", moduleCode);
}
main();
