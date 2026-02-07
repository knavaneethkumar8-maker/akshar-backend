const fs = require("fs/promises");

const TIER_DEFS = [
  { key: "akash", name: "आकाश" },
  { key: "agni", name: "अग्नि" },
  { key: "vayu", name: "वायु" },
  { key: "jal", name: "जल" },
  { key: "prithvi", name: "पृथ्वी" }
];

async function jsonToTextGrid(jsonPath, outPath) {
  const raw = await fs.readFile(jsonPath, "utf8");
  const data = JSON.parse(raw);

  const tiers = {};
  let maxTime = 0;

  for (const t of TIER_DEFS) tiers[t.key] = [];

  for (const grid of data.grids) {
    for (const t of TIER_DEFS) {
      const tier = grid.tiers[t.key];
      if (!tier) continue;

      for (const cell of tier.cells) {
        tiers[t.key].push(cell);
        maxTime = Math.max(maxTime, cell.end_ms);
      }
    }
  }

  const xmax = (maxTime / 1000).toFixed(6);

  let out = [];
  out.push('File type = "ooTextFile"');
  out.push('Object class = "TextGrid"\n');
  out.push(`xmin = 0`);
  out.push(`xmax = ${xmax}`);
  out.push(`tiers? <exists>`);
  out.push(`size = ${TIER_DEFS.length}`);
  out.push(`item []:`);

  TIER_DEFS.forEach((t, ti) => {
    const cells = tiers[t.key];

    out.push(`    item [${ti + 1}]:`);
    out.push(`        class = "IntervalTier"`);
    out.push(`        name = "${t.name}"`);
    out.push(`        xmin = 0`);
    out.push(`        xmax = ${xmax}`);
    out.push(`        intervals: size = ${cells.length}`);

    cells.forEach((c, ci) => {
      out.push(`        intervals [${ci + 1}]:`);
      out.push(`            xmin = ${(c.start_ms / 1000).toFixed(6)}`);
      out.push(`            xmax = ${(c.end_ms / 1000).toFixed(6)}`);
      out.push(`            text = "${(c.text || "").replace(/"/g, '""')}"`);
    });
  });

  await fs.writeFile(outPath, out.join("\n"), "utf8");
}

module.exports = { jsonToTextGrid };
