import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "assets", "js", "assessment-core.js"), "utf8"), context);
vm.runInNewContext(fs.readFileSync(path.join(root, "assets", "js", "assessment-charts.js"), "utf8"), context);

const core = context.window.AssessmentCore;
const charts = context.window.AssessmentCharts;
assert.equal(core.mean([2, 4, 6]), 4);
assert.equal(core.quantile([0, 10, 20, 30], 0.5), 15);
assert.equal(core.fmtPtsAuto(0.45), "+0.5 pts");
assert.equal(
  JSON.stringify(core.boyEoyPairs([
    { id: "b1", order: 1, assessmentWindow: "Beginning" },
    { id: "e1", order: 2, assessmentWindow: "End" },
    { id: "b2", order: 3, assessmentWindow: "Beginning" },
    { id: "e2", order: 4, assessmentWindow: "End" },
  ]).map((pair) => [pair.begin.id, pair.end.id])),
  JSON.stringify([["b1", "e1"], ["b2", "e2"]])
);
assert.equal(charts.pointsToPath([{ x: 0, y: 1 }, { x: 2, y: 3 }]), "M 0.0 1.0 L 2.0 3.0");
assert.ok(charts.niceTicks(62, 91).ticks.length >= 4);

console.log("Assessment core statistics and chart primitives valid.");
