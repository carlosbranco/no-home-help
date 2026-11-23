import fs from "node:fs/promises";
import path from "node:path";
import {
  CITY_DATA_ROOT,
  ROOT,
  inlineText,
  loadCityData,
  slugify,
} from "./lib/city-data.mjs";
import { FIXED_CATEGORIES } from "./lib/categories.mjs";

const DOCUMENTATION_URL = "https://github.com/carlosbranco/no-home-help/blob/main/EDIT_CITY_JSON.md";

const categoryAliases = new Map(Object.entries({
  emergency: "emergency",
  urgent: "emergency",
  "urgent-help": "emergency",
  "urgent-help-now": "emergency",
  emergenze: "emergency",
  today: "emergency",
  "what-to-do-today": "emergency",
  "o-que-fazer-hoje": "emergency",
  "que-hacer-hoy": "emergency",
  "co-zrobic-dzisiaj": "emergency",
  "ce-sa-faci-astazi": "emergency",
  "sa-pou-fe-jodi-a": "emergency",
  "plano-pratico-para-hoje": "emergency",
  "plano-pratico-para-as-proximas-24-horas": "emergency",
  "was-sie-heute-zuerst-tun-konnen": "emergency",
  plan: "emergency",
  weather: "emergency",
  shelter: "shelter",
  housing: "shelter",
  alojamento: "shelter",
  accoglienza: "shelter",
  "tempat-aman": "shelter",
  "day-centres": "shelter",
  "centro-pop": "shelter",
  food: "food",
  cibo: "food",
  makanan: "food",
  "alimentacao-higiene": "food",
  community: "community",
  churches: "community",
  faith: "community",
  religioso: "community",
  keagamaan: "community",
  charity: "community",
  social: "community",
  hygiene: "hygiene",
  showers: "hygiene",
  igiene: "hygiene",
  basic: "hygiene",
  "basic-needs": "hygiene",
  "day-services": "hygiene",
  "daily-needs": "hygiene",
  daily: "hygiene",
  spazi: "hygiene",
  practical: "hygiene",
  clothing: "clothing",
  health: "health",
  medical: "health",
  saude: "health",
  salute: "health",
  kesehatan: "health",
  "mental-health": "mental-health",
  mental: "mental-health",
  mentale: "mental-health",
  "public-facilities": "public-facilities",
  toilets: "public-facilities",
  internet: "phone-internet",
  "phone-internet": "phone-internet",
  communication: "phone-internet",
  transport: "transport",
  transportation: "transport",
  transportasi: "transport",
  trasporti: "transport",
  travel: "transport",
  airport: "transport",
  airports: "transport",
  benefits: "benefits",
  government: "benefits",
  welfare: "benefits",
  "apoio-social": "benefits",
  pemerintah: "benefits",
  income: "benefits",
  work: "employment",
  jobs: "employment",
  employment: "employment",
  trabalho: "employment",
  lavoro: "employment",
  pekerjaan: "employment",
  legal: "legal",
  legale: "legal",
  hukum: "legal",
  documents: "documents",
  documenti: "documents",
  dokumen: "documents",
  "work-documents": "documents",
  mail: "mail",
  storage: "storage",
  safety: "safety",
  protection: "safety",
  protezione: "safety",
  "domestic-violence": "safety",
  violence: "safety",
  "violencia-domestica": "safety",
  kekerasan: "safety",
  women: "safety",
  "women-children": "safety",
  specialized: "specialist-support",
  specialist: "specialist-support",
  "older-disabled": "specialist-support",
  older: "specialist-support",
  fragilita: "specialist-support",
  migrants: "specialist-support",
  migration: "specialist-support",
  households: "specialist-support",
  veterans: "veterans",
  pets: "pets",
  animals: "pets",
  animais: "pets",
  animali: "pets",
}));

function canonicalCategory(id) {
  if (categoryAliases.has(id)) return categoryAliases.get(id);
  if (/verif|correct|corre|contrib|source|about|sobre|inform|confirm|help-keep|prufung|duzelt|bilgileri|ayude|item|director/.test(id)) return "other";
  return "other";
}

function stripNumber(title = "") {
  return title.replace(/^\s*\d+[.)]?\s*/, "").trim();
}

function segments(inline) {
  return typeof inline === "string" ? [] : inline ?? [];
}

function blockInlines(block) {
  if (block.content !== undefined) return [block.content];
  return block.items ?? [];
}

function linksFromBlocks(blocks) {
  const links = [];
  for (const block of blocks ?? []) {
    for (const inline of blockInlines(block)) {
      for (const segment of segments(inline)) {
        if (segment.href) links.push({ href: segment.href, label: segment.text?.trim() || segment.href });
      }
    }
  }
  return links;
}

function lineFromInline(inline) {
  const text = inlineText(inline);
  if (typeof inline === "string") return text;
  const additions = [];
  for (const segment of inline ?? []) {
    if (!segment.href) continue;
    const target = segment.href.startsWith("tel:") ? segment.href : segment.href;
    if (target.startsWith("tel:")) {
      const visibleDigits = text.replace(/\D/g, "");
      const targetDigits = target.replace(/\D/g, "");
      const comparable = targetDigits.slice(-7);
      if (comparable && visibleDigits.includes(comparable)) continue;
    }
    if (!text.includes(target) && !additions.includes(target)) additions.push(target);
  }
  return [text, ...additions].filter(Boolean).join(" — ");
}

function textFromBlocks(blocks, { includeAddresses = true } = {}) {
  const lines = [];
  for (const block of blocks ?? []) {
    if (!includeAddresses && block.type === "address") continue;
    if (block.type === "list" || block.type === "ordered-list") {
      for (const [index, item] of (block.items ?? []).entries()) {
        const text = lineFromInline(item);
        if (text) lines.push(block.type === "ordered-list" ? `${index + 1}. ${text}` : `- ${text}`);
      }
    } else {
      const text = lineFromInline(block.content);
      if (text) lines.push(text);
    }
  }
  return lines.join("\n").trim();
}

function selectPhone(blocks) {
  const phone = linksFromBlocks(blocks).find((link) => /^tel:/i.test(link.href));
  if (!phone) return "";
  try { return decodeURIComponent(phone.href.replace(/^tel:/i, "")).trim(); } catch { return phone.href.replace(/^tel:/i, "").trim(); }
}

function websiteScore(link) {
  if (!/^https?:\/\//i.test(link.href)) return -Infinity;
  const value = `${link.label} ${link.href}`.toLowerCase();
  let score = 0;
  if (/official|website|information|service|program|programme|government|municip|gov\.|org\//.test(value)) score += 8;
  if (/direction|directions|map|maps|route|como chegar|cómo llegar|itinéraire/.test(value)) score -= 12;
  if (/google\.[^/]+\/maps|maps\.apple|goo\.gl\/maps/.test(value)) score -= 12;
  return score;
}

function selectWebsite(blocks) {
  return linksFromBlocks(blocks)
    .filter((link) => /^https?:\/\//i.test(link.href))
    .sort((a, b) => websiteScore(b) - websiteScore(a))[0]?.href ?? "";
}

function firstAddress(blocks) {
  const address = (blocks ?? []).find((block) => block.type === "address");
  return address ? inlineText(address.content) : "";
}

function additionalAddresses(blocks) {
  return (blocks ?? [])
    .filter((block) => block.type === "address")
    .slice(1)
    .map((block) => inlineText(block.content))
    .filter(Boolean)
    .join("\n");
}

function uniqueId(base, used) {
  let id = slugify(base);
  let number = 2;
  while (used.has(id)) {
    id = `${slugify(base)}-${number}`;
    number += 1;
  }
  used.add(id);
  return id;
}

function convertResource(resource, descriptionPrefix, used) {
  const description = [
    descriptionPrefix,
    additionalAddresses(resource.blocks),
    textFromBlocks(resource.blocks, { includeAddresses: false }),
  ]
    .filter(Boolean)
    .join("\n")
    .trim() || resource.name;
  return {
    id: uniqueId(resource.id || resource.name, used),
    title: resource.name,
    description,
    last_verified: resource.last_verified,
    address: firstAddress(resource.blocks),
    phone: selectPhone(resource.blocks),
    website: selectWebsite(resource.blocks),
    hours: "",
    how_to_access: "",
  };
}

function convertCategory(category, pageDate, used) {
  const blocks = category.items.filter((item) => item.type !== "resource");
  const resources = category.items.filter((item) => item.type === "resource");
  const categoryInformation = textFromBlocks(blocks);
  if (!resources.length) {
    if (!categoryInformation) return [];
    return [{
      id: uniqueId(`${category.id}-information`, used),
      title: stripNumber(category.title),
      description: categoryInformation,
      last_verified: pageDate,
      address: firstAddress(blocks),
      phone: selectPhone(blocks),
      website: selectWebsite(blocks),
      hours: "",
      how_to_access: "",
    }];
  }
  return resources.map((resource, index) => convertResource(resource, index === 0 ? categoryInformation : "", used));
}

function convertPage(page) {
  return {
    heading: page.heading,
    last_verified: page.last_verified,
    urgent: textFromBlocks(page.urgent),
    notice: inlineText(page.notice),
    intro: textFromBlocks(page.intro),
    footer: textFromBlocks(page.footer),
  };
}

function removeDuplicateTelephoneTargets(value = "") {
  return value.split("\n").map((line) => line.replace(/\s+—\s+tel:([^\s—]+)/gi, (match, phone, offset) => {
    const visibleDigits = line.slice(0, offset).replace(/\D/g, "");
    const targetDigits = phone.replace(/\D/g, "");
    const comparable = targetDigits.slice(-7);
    return comparable && visibleDigits.includes(comparable) ? "" : match;
  })).join("\n");
}

const hoursPattern = /^(?:hours?|opening hours?|open|schedule|availability|meal times?|breakfast|lunch|dinner|hor[aá]rios?|funcionamento|atendimento presencial|jantar|refeições|horarios?|atenci[oó]n|apertura|horaires?|ouverture|öffnungszeiten|geöffnet|sprechzeiten|orari|çalışma saatleri|saatler|açık|program|godziny|czynne|ωράριο|ώρες|часы|график|営業時間|운영 시간|开放时间|เวลาทำการ)\s*[:：-]/iu;
const accessPattern = /^(?:access|how to (?:access|apply|start|find|request)|intake|admission|registration|appointment|before (?:you go|travelling)|what to do|apply|eligibility|acesso|como (?:pedir|aceder|começar|encontrar|solicitar)|admissão|inscrição|antes de ir|quem pode|acceso|c[oó]mo (?:acceder|solicitar|pedir|llegar)|admisi[oó]n|ingreso|inscripci[oó]n|accès|comment accéder|admission|avant de|zugang|aufnahme|anmeldung|vor dem|accesso|come accedere|ammissione|prima di|erişim|başvuru|kabul|gitmeden|πρόσβαση|εισαγωγή|доступ|прием|dostęp|przyjęcie|admitere)\s*[:：-]/iu;

function extractStructuredFields(entry) {
  if (entry.hours || entry.how_to_access) return entry;
  const description = [];
  const hours = [];
  const access = [];
  for (const line of entry.description.split("\n")) {
    if (hoursPattern.test(line)) hours.push(line);
    else if (accessPattern.test(line)) access.push(line);
    else description.push(line);
  }
  return {
    ...entry,
    description: description.join("\n").trim() || entry.description,
    hours: hours.join("\n"),
    how_to_access: access.join("\n"),
  };
}

function normalizeCityV2(city) {
  return {
    ...city,
    page: Object.fromEntries(Object.entries(city.page).map(([key, value]) => [key, typeof value === "string" ? removeDuplicateTelephoneTargets(value) : value])),
    categories: city.categories.map((category) => ({
      ...category,
      entries: category.entries.map((entry) => extractStructuredFields({
          ...entry,
          description: entry.website
            ? removeDuplicateTelephoneTargets(entry.description).split("\n").map((line) => line.endsWith(` — ${entry.website}`)
              ? line.slice(0, -(` — ${entry.website}`).length)
              : line).join("\n")
            : removeDuplicateTelephoneTargets(entry.description),
          address: removeDuplicateTelephoneTargets(entry.address),
          hours: removeDuplicateTelephoneTargets(entry.hours),
          how_to_access: removeDuplicateTelephoneTargets(entry.how_to_access),
        })),
    })),
  };
}

function convertCity(city) {
  if (city.schema_version === 2) return normalizeCityV2(city);
  const categories = FIXED_CATEGORIES.map((category) => ({ ...category, entries: [] }));
  const byId = new Map(categories.map((category) => [category.id, category]));
  const usedByCategory = new Map(categories.map((category) => [category.id, new Set()]));
  for (const oldCategory of city.categories ?? []) {
    const destinationId = canonicalCategory(oldCategory.id);
    const destination = byId.get(destinationId);
    if (!destination.entries.length) destination.title = stripNumber(oldCategory.title) || destination.title;
    destination.entries.push(...convertCategory(oldCategory, city.page.last_verified, usedByCategory.get(destinationId)));
  }
  return normalizeCityV2({
    $schema: city.$schema,
    documentation: city.documentation || DOCUMENTATION_URL,
    schema_version: 2,
    status: city.status,
    locale: city.locale,
    location: city.location,
    seo: city.seo,
    page: convertPage(city.page),
    categories,
  });
}

const records = await loadCityData();
if (!records.length || !records.every((record) => record.file.startsWith(`${CITY_DATA_ROOT}${path.sep}`))) {
  throw new Error(`Refusing to migrate files outside ${path.relative(ROOT, CITY_DATA_ROOT)}`);
}

let migrated = 0;
let entries = 0;
for (const record of records) {
  const converted = convertCity(record.data);
  if (JSON.stringify(converted) === JSON.stringify(record.data)) continue;
  entries += converted.categories.reduce((count, category) => count + category.entries.length, 0);
  await fs.writeFile(record.file, `${JSON.stringify(converted, null, 2)}\n`, "utf8");
  migrated += 1;
}

process.stdout.write(`Migrated ${migrated} city JSON files to schema version 2 with ${entries} simple entries.\n`);

