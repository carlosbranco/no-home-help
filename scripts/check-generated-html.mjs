import fs from "node:fs/promises";
import path from "node:path";
import { ROOT, loadCityData } from "./lib/city-data.mjs";

const failures = [];

function languageSuffix(language) {
  return language.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function cityPath(city) {
  const suffix = city.locale.primary ? "" : `.${languageSuffix(city.locale.language)}`;
  return `${city.location.country_slug}/${city.location.region_slug}/${city.location.city_slug}${suffix}.html`;
}

function attributesFrom(html, name) {
  return [...html.matchAll(new RegExp(`\\b${name}=["']([^"']+)["']`, "gi"))].map((match) => match[1]);
}

async function checkHtml(relative, html, sourceMarker) {
  const lower = html.toLowerCase();
  for (const element of ["script", "img", "svg", "picture", "video", "audio", "iframe", "object", "embed"]) {
    if (new RegExp(`<${element}\\b`, "i").test(html)) failures.push(`${relative}: forbidden <${element}> element`);
  }
  if (/\son[a-z]+\s*=/i.test(html)) failures.push(`${relative}: inline event handler is forbidden`);
  if (/\{\{[A-Z_]+\}\}/.test(html)) failures.push(`${relative}: unresolved template placeholder`);
  for (const href of attributesFrom(html, "href")) {
    if (/^javascript:/i.test(href)) failures.push(`${relative}: javascript URL is forbidden`);
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) continue;
    const cleanHref = href.split(/[?#]/, 1)[0];
    if (!cleanHref) continue;
    const target = path.resolve(ROOT, path.dirname(relative), decodeURIComponent(cleanHref));
    if (!target.startsWith(`${ROOT}${path.sep}`) && target !== ROOT) {
      failures.push(`${relative}: internal link escapes the repository: ${href}`);
      continue;
    }
    try { await fs.access(target); } catch { failures.push(`${relative}: missing internal link target ${href}`); }
  }
  for (const stylesheet of [...html.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]) {
    if (!/(?:^|\/)style\.css$/.test(stylesheet[1])) failures.push(`${relative}: external or unexpected stylesheet ${stylesheet[1]}`);
  }
  const ids = attributesFrom(html, "id");
  const idSet = new Set();
  for (const id of ids) {
    if (idSet.has(id)) failures.push(`${relative}: duplicate HTML id ${id}`);
    idSet.add(id);
  }
  for (const href of attributesFrom(html, "href").filter((value) => value.startsWith("#") && value.length > 1)) {
    const target = decodeURIComponent(href.slice(1));
    if (!idSet.has(target)) failures.push(`${relative}: missing same-page anchor target ${href}`);
  }
  if (!lower.includes(sourceMarker.toLowerCase())) failures.push(`${relative}: missing generated source marker`);
}

const records = await loadCityData();
const published = records.filter((record) => record.data.status === "published");
const primary = published.filter((record) => record.data.locale.primary);
const indexPaths = new Set(["index.html"]);
for (const record of primary) {
  indexPaths.add(`${record.data.location.country_slug}/index.html`);
  indexPaths.add(`${record.data.location.country_slug}/${record.data.location.region_slug}/index.html`);
}
for (const record of published) {
  const relative = cityPath(record.data);
  let html;
  try {
    html = await fs.readFile(path.join(ROOT, relative), "utf8");
  } catch {
    failures.push(`${relative}: generated HTML is missing`);
    continue;
  }
  await checkHtml(relative, html, "Generated from data/cities/");
}
for (const relative of [...indexPaths].sort()) {
  let html;
  try {
    html = await fs.readFile(path.join(ROOT, relative), "utf8");
  } catch {
    failures.push(`${relative}: generated index is missing`);
    continue;
  }
  await checkHtml(relative, html, "Generated from primary published files in data/cities/");
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Checked ${published.length} published guides and ${indexPaths.size} generated indexes: no forbidden client features, duplicate IDs, or broken internal links.\n`);
