import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "assets", "js", "chat-ui.js"), "utf8");
const context = { URL, window: { location: { href: "https://grant-mccurdy.github.io/demos/" } } };
vm.runInNewContext(source, context);

const ui = context.window.PortfolioChatUI;
assert.equal(ui.escapeHtml('<script data-x="1">'), "&lt;script data-x=&quot;1&quot;&gt;");
assert.equal(ui.renderInlineMarkdown("**Safe** `code`"), "<strong>Safe</strong> <code>code</code>");
assert.equal(ui.renderInlineMarkdown("**<img>**"), "<strong>&lt;img&gt;</strong>");
assert.equal(ui.safeHttpUrl("javascript:alert(1)"), "");
assert.equal(ui.safeHttpUrl("../projects/"), "https://grant-mccurdy.github.io/projects/");

console.log("Shared chat UI escaping and URL guards valid.");
