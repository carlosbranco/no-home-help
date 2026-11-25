import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CITY_DATA_ROOT = path.join(ROOT, "data/cities");
export const REPOSITORY_URL = "https://github.com/carlosbranco/no-home-help";

const entities = new Map([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", "\""], ["apos", "'"], ["nbsp", " "],
  ["ndash", "–"], ["mdash", "—"], ["hellip", "…"], ["copy", "©"], ["reg", "®"], ["trade", "™"],
]);

export function decodeHtml(value = "") {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1]?.toLowerCase() === "x" ? 16 : 10;
      const raw = radix === 16 ? entity.slice(2) : entity.slice(1);
      const code = Number.parseInt(raw, radix);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return entities.get(entity.toLowerCase()) ?? match;
  });
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function textFromHtml(value = "") {
  return decodeHtml(value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAttributes(value = "") {
  const attributes = {};
  for (const match of value.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

function mergeSegments(segments) {
  const merged = [];
  for (const segment of segments) {
    if (!segment.break && !segment.text) continue;
    const previous = merged.at(-1);
    if (previous && !segment.break && !previous.break && previous.href === segment.href && previous.strong === segment.strong && previous.emphasis === segment.emphasis) {
      previous.text += segment.text;
    } else {
      merged.push(segment);
    }
  }
  return merged;
}

export function parseInline(value = "", inherited = {}) {
  const segments = [];
  const tokenPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>|<strong\b[^>]*>([\s\S]*?)<\/strong>|<em\b[^>]*>([\s\S]*?)<\/em>|<br\s*\/?>|([^<]+)|<[^>]+>/gi;
  for (const match of value.replace(/<!--[\s\S]*?-->/g, "").matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      const href = parseAttributes(match[1]).href;
      segments.push(...parseInline(match[2], { ...inherited, ...(href ? { href } : {}) }));
    } else if (match[3] !== undefined) {
      segments.push(...parseInline(match[3], { ...inherited, strong: true }));
    } else if (match[4] !== undefined) {
      segments.push(...parseInline(match[4], { ...inherited, emphasis: true }));
    } else if (/^<br/i.test(match[0])) {
      segments.push({ break: true });
    } else if (match[5] !== undefined) {
      const text = decodeHtml(match[5]).replace(/\s+/g, " ");
      if (text) segments.push({ text, ...inherited });
    }
  }
  const merged = mergeSegments(segments);
  if (merged[0]?.text) merged[0].text = merged[0].text.replace(/^\s+/, "");
  if (merged.at(-1)?.text) merged.at(-1).text = merged.at(-1).text.replace(/\s+$/, "");
  return merged.filter((segment) => segment.break || segment.text);
}

export function inlineText(inline = []) {
  if (typeof inline === "string") return inline.replace(/\s+/g, " ").trim();
  return inline.map((segment) => segment.break ? " " : segment.text ?? "").join("").replace(/\s+/g, " ").trim();
}

export function parseBlocks(value = "") {
  const clean = value
    .replace(/<p\b[^>]*class="[^"]*back-to-top[^"]*"[^>]*>[\s\S]*?<\/p>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const blocks = [];
  const blockPattern = /<(p|address|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of clean.matchAll(blockPattern)) {
    const tag = match[1].toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const items = [...match[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((item) => parseInline(item[1]))
        .filter((item) => inlineText(item));
      if (items.length) blocks.push({ type: tag === "ol" ? "ordered-list" : "list", items });
    } else {
      const content = parseInline(match[2]);
      if (inlineText(content)) blocks.push({ type: tag === "address" ? "address" : "paragraph", content });
    }
  }
  return blocks;
}

export function renderInline(inline = []) {
  if (typeof inline === "string") return escapeHtml(inline);
  return inline.map((segment) => {
    if (segment.break) return "<br>";
    let output = escapeHtml(segment.text ?? "");
    if (segment.emphasis) output = `<em>${output}</em>`;
    if (segment.strong) output = `<strong>${output}</strong>`;
    if (segment.href) output = `<a href="${escapeHtml(segment.href)}">${output}</a>`;
    return output;
  }).join("");
}

export function renderBlock(block, indent = "      ") {
  if (block.type === "paragraph" || block.type === "address") {
    const tag = block.type === "address" ? "address" : "p";
    return `${indent}<${tag}>${renderInline(block.content)}</${tag}>`;
  }
  const tag = block.type === "ordered-list" ? "ol" : "ul";
  const items = block.items.map((item) => `${indent}  <li>${renderInline(item)}</li>`).join("\n");
  return `${indent}<${tag}>\n${items}\n${indent}</${tag}>`;
}

export function slugify(value = "item") {
  const slug = value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

const monthNumbers = {
  january: "01", fevereiro: "02", february: "02", março: "03", marco: "03", march: "03",
  abril: "04", april: "04", maio: "05", may: "05", junho: "06", june: "06", julho: "07", july: "07",
  agosto: "08", august: "08", setembro: "09", september: "09", outubro: "10", october: "10",
  novembro: "11", november: "11", dezembro: "12", december: "12",
  enero: "01", febrero: "02", marzo: "03", mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

export function normalizeDate(value = "", fallback = "2026-11-12") {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eastAsian = value.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (eastAsian) return `${eastAsian[1]}-${eastAsian[2].padStart(2, "0")}-${eastAsian[3].padStart(2, "0")}`;
  const words = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .match(/(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(20\d{2})|([a-z]+)\s+(\d{1,2}),?\s+(20\d{2})/);
  if (words) {
    const day = words[1] ?? words[5];
    const month = monthNumbers[words[2] ?? words[4]];
    const year = words[3] ?? words[6];
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }
  return fallback;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === "\"" && text[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === "\"") {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}

export async function readLocations() {
  return parseCsv(await fs.readFile(path.join(ROOT, "data/locations.csv"), "utf8"));
}

async function walk(directory) {
  const output = [];
  let entries = [];
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full));
    else output.push(full);
  }
  return output;
}

export async function loadCityData() {
  const files = (await walk(CITY_DATA_ROOT)).filter((file) => file.endsWith(".json") && !file.endsWith("/example.json"));
  const cities = [];
  for (const file of files.sort()) {
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    cities.push({ file, relativeFile: path.relative(ROOT, file).split(path.sep).join("/"), data });
  }
  return cities;
}

const translations = {
  en: { contents: "On this page", verified: "Last verified", report: "Report incorrect information about this entry", back: "Back to top", cities: "Cities", contribute: "Contribute", location: "Location", noGuides: "No published city guides yet." },
  pt: { contents: "Nesta página", verified: "Última verificação", report: "Comunicar informação incorreta nesta entrada", back: "Voltar ao início", cities: "Cidades", contribute: "Contribuir", location: "Localização", noGuides: "Ainda não existem guias de cidades publicados." },
  es: { contents: "En esta página", quick: "Qué hacer ahora", tonight: "Esta noche", week: "Esta semana", month: "Este mes", verified: "Última verificación", report: "Informar de información incorrecta en esta entrada", back: "Volver arriba", cities: "Ciudades", contribute: "Contribuir", location: "Ubicación", noGuides: "Todavía no hay guías de ciudades publicadas." },
  de: { contents: "Auf dieser Seite", quick: "Nächste Schritte", tonight: "Heute Nacht", week: "Diese Woche", month: "Diesen Monat", verified: "Zuletzt geprüft", report: "Falsche Informationen zu diesem Eintrag melden", back: "Nach oben", cities: "Städte", contribute: "Mitwirken", location: "Standort", noGuides: "Noch keine veröffentlichten Stadtführer." },
  nl: { contents: "Op deze pagina", verified: "Laatst gecontroleerd", report: "Onjuiste informatie over deze vermelding melden", back: "Terug naar boven", cities: "Steden", contribute: "Bijdragen", location: "Locatie", noGuides: "Er zijn nog geen stadsgidsen gepubliceerd." },
  da: { contents: "På denne side", verified: "Senest kontrolleret", report: "Rapportér forkerte oplysninger i dette opslag", back: "Tilbage til toppen", cities: "Byer", contribute: "Bidrag", location: "Sted", noGuides: "Der er endnu ingen offentliggjorte byguider." },
  cs: { contents: "Na této stránce", verified: "Naposledy ověřeno", report: "Nahlásit nesprávné údaje v tomto záznamu", back: "Zpět nahoru", cities: "Města", contribute: "Přispět", location: "Místo", noGuides: "Zatím nebyly zveřejněny žádné průvodce městy." },
  sr: { contents: "Na ovoj stranici", verified: "Poslednja provera", report: "Prijavi netačne podatke u ovom unosu", back: "Nazad na vrh", cities: "Gradovi", contribute: "Doprinesi", location: "Lokacija", noGuides: "Još nema objavljenih vodiča za gradove." },
  hy: { contents: "Այս էջում", verified: "Վերջին ստուգումը", report: "Հաղորդել այս գրառման սխալ տեղեկության մասին", back: "Վերադառնալ վերև", cities: "Քաղաքներ", contribute: "Աջակցել նախագծին", location: "Վայր", noGuides: "Դեռ հրապարակված քաղաքային ուղեցույցներ չկան։" },
  bg: { contents: "На тази страница", verified: "Последна проверка", report: "Съобщете за неточна информация в този запис", back: "Към началото", cities: "Градове", contribute: "Допринасяне", location: "Местоположение", noGuides: "Все още няма публикувани градски справочници." },
  fr: { contents: "Sur cette page", quick: "Que faire maintenant", tonight: "Ce soir", week: "Cette semaine", month: "Ce mois-ci", verified: "Dernière vérification", report: "Signaler une information incorrecte dans cette entrée", back: "Retour en haut", cities: "Villes", contribute: "Contribuer", location: "Localisation", noGuides: "Aucun guide de ville publié pour le moment." },
  it: { contents: "In questa pagina", quick: "Cosa fare ora", tonight: "Questa notte", week: "Questa settimana", month: "Questo mese", verified: "Ultima verifica", report: "Segnala informazioni errate in questa voce", back: "Torna all'inizio", cities: "Città", contribute: "Contribuisci", location: "Posizione", noGuides: "Nessuna guida cittadina pubblicata." },
  ja: { contents: "このページの内容", quick: "次にすること", tonight: "今夜", week: "今週", month: "今月", verified: "最終確認", report: "この情報の誤りを報告", back: "ページ上部へ戻る", cities: "都市", contribute: "情報を追加する", location: "現在地", noGuides: "公開済みの都市ガイドはまだありません。" },
  zh: { contents: "本页内容", quick: "下一步", tonight: "今晚", week: "本周", month: "本月", verified: "最后核实", report: "报告此条目的错误信息", back: "返回顶部", cities: "城市", contribute: "贡献信息", location: "当前位置", noGuides: "尚无已发布的城市指南。" },
  ko: { contents: "이 페이지", quick: "다음 단계", tonight: "오늘 밤", week: "이번 주", month: "이번 달", verified: "마지막 확인", report: "이 항목의 잘못된 정보 신고", back: "맨 위로", cities: "도시", contribute: "기여하기", location: "위치", noGuides: "아직 게시된 도시 안내가 없습니다." },
  tr: { contents: "Bu sayfada", quick: "Şimdi ne yapılmalı", tonight: "Bu gece", week: "Bu hafta", month: "Bu ay", verified: "Son doğrulama", report: "Bu kayıttaki yanlış bilgiyi bildir", back: "Başa dön", cities: "Şehirler", contribute: "Katkıda bulun", location: "Konum", noGuides: "Henüz yayımlanmış şehir rehberi yok." },
  ru: { contents: "На этой странице", quick: "Что делать дальше", tonight: "Сегодня ночью", week: "На этой неделе", month: "В этом месяце", verified: "Последняя проверка", report: "Сообщить об ошибке в этой записи", back: "Наверх", cities: "Города", contribute: "Помочь проекту", location: "Местоположение", noGuides: "Опубликованных городских справочников пока нет." },
  uk: { contents: "На цій сторінці", quick: "Що робити далі", tonight: "Сьогодні вночі", week: "Цього тижня", month: "Цього місяця", verified: "Остання перевірка", report: "Повідомити про помилку в цьому записі", back: "Нагору", cities: "Міста", contribute: "Долучитися", location: "Місце", noGuides: "Опублікованих міських довідників ще немає." },
  pl: { contents: "Na tej stronie", quick: "Co zrobić dalej", tonight: "Dziś w nocy", week: "W tym tygodniu", month: "W tym miesiącu", verified: "Ostatnia weryfikacja", report: "Zgłoś błędne informacje w tym wpisie", back: "Wróć na górę", cities: "Miasta", contribute: "Współtwórz", location: "Lokalizacja", noGuides: "Brak opublikowanych przewodników miejskich." },
  ro: { contents: "Pe această pagină", quick: "Ce urmează", tonight: "În această noapte", week: "Săptămâna aceasta", month: "Luna aceasta", verified: "Ultima verificare", report: "Raportează informații greșite în această intrare", back: "Înapoi sus", cities: "Orașe", contribute: "Contribuie", location: "Locație", noGuides: "Nu există încă ghiduri de oraș publicate." },
  el: { contents: "Σε αυτή τη σελίδα", quick: "Τι να κάνετε τώρα", tonight: "Απόψε", week: "Αυτή την εβδομάδα", month: "Αυτόν τον μήνα", verified: "Τελευταίος έλεγχος", report: "Αναφορά λανθασμένων πληροφοριών σε αυτή την καταχώριση", back: "Επιστροφή στην κορυφή", cities: "Πόλεις", contribute: "Συνεισφορά", location: "Τοποθεσία", noGuides: "Δεν υπάρχουν ακόμη δημοσιευμένοι οδηγοί πόλεων." },
  ar: { contents: "في هذه الصفحة", quick: "ما الذي يجب فعله الآن", tonight: "الليلة", week: "هذا الأسبوع", month: "هذا الشهر", verified: "آخر تحقق", report: "الإبلاغ عن معلومات غير صحيحة في هذا الإدخال", back: "العودة إلى الأعلى", cities: "المدن", contribute: "المساهمة", location: "الموقع", noGuides: "لا توجد أدلة مدن منشورة بعد." },
  ur: { contents: "اس صفحے پر", quick: "اب کیا کریں", tonight: "آج رات", week: "اس ہفتے", month: "اس مہینے", verified: "آخری تصدیق", report: "اس اندراج میں غلط معلومات کی اطلاع دیں", back: "اوپر جائیں", cities: "شہر", contribute: "تعاون کریں", location: "مقام", noGuides: "ابھی کوئی شائع شدہ شہری رہنما نہیں ہے۔" },
  hi: { contents: "इस पृष्ठ पर", quick: "अब क्या करें", tonight: "आज रात", week: "इस सप्ताह", month: "इस महीने", verified: "अंतिम सत्यापन", report: "इस प्रविष्टि की गलत जानकारी की रिपोर्ट करें", back: "ऊपर जाएँ", cities: "शहर", contribute: "योगदान दें", location: "स्थान", noGuides: "अभी कोई प्रकाशित शहर मार्गदर्शिका नहीं है।" },
  bn: { contents: "এই পাতায়", quick: "এখন কী করবেন", tonight: "আজ রাতে", week: "এই সপ্তাহে", month: "এই মাসে", verified: "শেষ যাচাই", report: "এই এন্ট্রির ভুল তথ্য জানান", back: "উপরে ফিরুন", cities: "শহর", contribute: "অবদান রাখুন", location: "অবস্থান", noGuides: "এখনও কোনো প্রকাশিত শহর নির্দেশিকা নেই।" },
  fi: { contents: "Tällä sivulla", verified: "Viimeksi tarkistettu", report: "Ilmoita tämän tiedon virheestä", back: "Takaisin alkuun", cities: "Kaupungit", contribute: "Osallistu", location: "Sijainti", noGuides: "Julkaistuja kaupunkioppaita ei vielä ole." },
  no: { contents: "På denne siden", verified: "Sist kontrollert", report: "Meld fra om feil i denne oppføringen", back: "Tilbake til toppen", cities: "Byer", contribute: "Bidra", location: "Sted", noGuides: "Det finnes ingen publiserte byguider ennå." },
  ka: { contents: "ამ გვერდზე", verified: "ბოლოს გადამოწმდა", report: "შეატყობინეთ ამ ჩანაწერში არასწორი ინფორმაციის შესახებ", back: "ზემოთ დაბრუნება", cities: "ქალაქები", contribute: "წვლილის შეტანა", location: "მდებარეობა", noGuides: "ქალაქის გამოქვეყნებული გზამკვლევები ჯერ არ არის." },
  sq: { contents: "Në këtë faqe", verified: "Verifikuar së fundi", report: "Raporto informacion të pasaktë në këtë hyrje", back: "Kthehu lart", cities: "Qytete", contribute: "Kontribuo", location: "Vendndodhja", noGuides: "Nuk ka ende udhëzues qytetesh të publikuar." },
  hr: { contents: "Na ovoj stranici", verified: "Posljednja provjera", report: "Prijavite netočne podatke u ovom unosu", back: "Povratak na vrh", cities: "Gradovi", contribute: "Doprinesite", location: "Lokacija", noGuides: "Još nema objavljenih gradskih vodiča." },
  id: { contents: "Di halaman ini", quick: "Langkah berikutnya", tonight: "Malam ini", week: "Minggu ini", month: "Bulan ini", verified: "Terakhir diverifikasi", report: "Laporkan informasi yang salah pada entri ini", back: "Kembali ke atas", cities: "Kota", contribute: "Berkontribusi", location: "Lokasi", noGuides: "Belum ada panduan kota yang diterbitkan." },
  th: { contents: "ในหน้านี้", quick: "สิ่งที่ควรทำต่อไป", tonight: "คืนนี้", week: "สัปดาห์นี้", month: "เดือนนี้", verified: "ตรวจสอบล่าสุด", report: "รายงานข้อมูลที่ไม่ถูกต้องในรายการนี้", back: "กลับขึ้นด้านบน", cities: "เมือง", contribute: "ร่วมเพิ่มข้อมูล", location: "ตำแหน่ง", noGuides: "ยังไม่มีคู่มือเมืองที่เผยแพร่" },
  fil: { contents: "Sa pahinang ito", quick: "Susunod na gagawin", tonight: "Ngayong gabi", week: "Ngayong linggo", month: "Ngayong buwan", verified: "Huling beripikasyon", report: "Iulat ang maling impormasyon sa entry na ito", back: "Bumalik sa itaas", cities: "Mga lungsod", contribute: "Mag-ambag", location: "Lokasyon", noGuides: "Wala pang nailalathalang gabay sa lungsod." },
  ht: { contents: "Nan paj sa a", quick: "Sa pou fè kounye a", tonight: "Aswè a", week: "Semèn sa a", month: "Mwa sa a", verified: "Dènye verifikasyon", report: "Rapòte move enfòmasyon nan antre sa a", back: "Retounen anlè", cities: "Vil", contribute: "Kontribye", location: "Kote", noGuides: "Pa gen gid vil ki pibliye ankò." },
  az: { contents: "Bu səhifədə", quick: "İndi nə etməli", tonight: "Bu gecə", week: "Bu həftə", month: "Bu ay", verified: "Son yoxlama", report: "Bu qeyddə yanlış məlumatı bildir", back: "Yuxarı qayıt", cities: "Şəhərlər", contribute: "Töhfə ver", location: "Məkan", noGuides: "Hələ dərc edilmiş şəhər bələdçisi yoxdur." },
  be: { contents: "На гэтай старонцы", quick: "Што рабіць далей", tonight: "Сёння ўначы", week: "На гэтым тыдні", month: "У гэтым месяцы", verified: "Апошняя праверка", report: "Паведаміць пра памылковыя звесткі", back: "Наверх", cities: "Гарады", contribute: "Дапамагчы", location: "Месца", noGuides: "Апублікаваных гарадскіх даведнікаў пакуль няма." },
  mr: { contents: "या पृष्ठावर", quick: "आता काय करावे", tonight: "आज रात्री", week: "या आठवड्यात", month: "या महिन्यात", verified: "शेवटची पडताळणी", report: "या नोंदीतील चुकीची माहिती कळवा", back: "वर जा", cities: "शहरे", contribute: "योगदान द्या", location: "स्थान", noGuides: "अद्याप कोणतेही प्रकाशित शहर मार्गदर्शक नाहीत." }
  ,sw: { contents: "Katika ukurasa huu", verified: "Ilithibitishwa mwisho", report: "Ripoti taarifa isiyo sahihi katika huduma hii", back: "Rudi juu", cities: "Miji", contribute: "Changia", location: "Mahali", noGuides: "Bado hakuna mwongozo wa mji uliochapishwa." }
  ,rn: { contents: "Kuri uru rupapuro", verified: "Igenzura rya nyuma", report: "Menyesha amakuru atari yo muri iki gisata", back: "Subira hejuru", cities: "Ibisagara", contribute: "Terera", location: "Aho biri", noGuides: "Nta gitabu c’igisagara kiratangazwa." }
  ,ss: { contents: "Kulelikhasi", verified: "Kugcine kuhlolwa", report: "Bika lwati lolungakalungi kulokufakiwe", back: "Buyela etulu", cities: "Emadolobha", contribute: "Nikela", location: "Indzawo", noGuides: "Kute umhlahlandlela welidolobha loshicilelwe." }
  ,am: { contents: "በዚህ ገጽ", verified: "መጨረሻ የተረጋገጠው", report: "በዚህ መረጃ ውስጥ ስህተት ካለ ያሳውቁ", back: "ወደ ላይ ተመለስ", cities: "ከተሞች", contribute: "አስተዋጽኦ ያድርጉ", location: "ቦታ", noGuides: "ገና የታተመ የከተማ መመሪያ የለም።" }
  ,ti: { contents: "ኣብዛ ገጽ", verified: "መወዳእታ ዝተረጋገጸ", report: "ኣብዚ ሓበሬታ ዘሎ ጌጋ ሓብሩ", back: "ናብ ላዕሊ ተመለሱ", cities: "ከተማታት", contribute: "ኣበርክቱ", location: "ቦታ", noGuides: "ገና ዝተሓትመ መምርሒ ከተማ የለን።" }
  ,st: { contents: "Leqepheng lena", verified: "E netefaditswe la ho qetela", report: "Tlaleha tlhahisoleseding e fosahetseng mona", back: "Kgutlela hodimo", cities: "Ditoropo", contribute: "Kenya letsoho", location: "Sebaka", noGuides: "Ha ho tataiso ya toropo e phatlaladitsweng." }
  ,mg: { contents: "Amin’ity pejy ity", verified: "Fanamarinana farany", report: "Tatitrao ny vaovao diso amin’ity lisitra ity", back: "Miverina ambony", cities: "Tanàna", contribute: "Mandraisa anjara", location: "Toerana", noGuides: "Tsy mbola misy torolalana an-tanàna navoaka." }
  ,rw: { contents: "Kuri uru rupapuro", verified: "Byagenzuwe bwa nyuma", report: "Menyesha amakuru atari yo muri iyi serivisi", back: "Subira hejuru", cities: "Imijyi", contribute: "Tanga umusanzu", location: "Aho biri", noGuides: "Nta gitabo cy’umujyi kiratangazwa." }
  ,so: { contents: "Boggan", verified: "Markii ugu dambeysay la hubiyay", report: "Soo sheeg macluumaad khaldan", back: "Kor ugu noqo", cities: "Magaalooyin", contribute: "Ka qayb qaado", location: "Goobta", noGuides: "Weli ma jiro hagaha magaalo oo la daabacay." }
  ,fa: { contents: "در این صفحه", verified: "آخرین بررسی", report: "گزارش اطلاعات نادرست این مورد", back: "بازگشت به بالا", cities: "شهرها", contribute: "مشارکت", location: "مکان", noGuides: "هنوز راهنمای شهری منتشر نشده است." }
  ,dz: { contents: "ཤོག་ངོས་འདི་ནང་།", verified: "མཐའ་མཇུག་བདེན་དཔྱད།", report: "གནས་ཚུལ་ནོར་བ་སྙན་ཞུ།", back: "གོང་ལུ་ལོག", cities: "ཁྲོམ་སྡེ།", contribute: "མཉམ་འབྲེལ།", location: "ས་གནས།", noGuides: "ད་ལྟོ་ཁྲོམ་སྡེའི་ལམ་སྟོན་མེད།" }
  ,ms: { contents: "Pada halaman ini", verified: "Terakhir disahkan", report: "Laporkan maklumat salah dalam entri ini", back: "Kembali ke atas", cities: "Bandar", contribute: "Sumbang", location: "Lokasi", noGuides: "Belum ada panduan bandar yang diterbitkan." }
  ,km: { contents: "នៅលើទំព័រនេះ", verified: "បានផ្ទៀងផ្ទាត់ចុងក្រោយ", report: "រាយការណ៍ព័ត៌មានមិនត្រឹមត្រូវ", back: "ត្រឡប់ទៅខាងលើ", cities: "ទីក្រុង", contribute: "ចូលរួម", location: "ទីតាំង", noGuides: "មិនទាន់មានមគ្គុទ្ទេសក៍ទីក្រុងដែលបានបោះពុម្ពទេ។" }
  ,he: { contents: "בעמוד זה", verified: "אימות אחרון", report: "דיווח על מידע שגוי ברשומה זו", back: "חזרה למעלה", cities: "ערים", contribute: "תרומה לפרויקט", location: "מיקום", noGuides: "עדיין אין מדריכי ערים שפורסמו." }
  ,kk: { contents: "Осы бетте", verified: "Соңғы тексеру", report: "Осы жазбадағы қате ақпаратты хабарлау", back: "Жоғарыға қайту", cities: "Қалалар", contribute: "Үлес қосу", location: "Орналасқан жер", noGuides: "Әзірге жарияланған қала нұсқаулығы жоқ." }
  ,ky: { contents: "Бул баракта", verified: "Акыркы текшерүү", report: "Бул жазуудагы туура эмес маалыматты билдирүү", back: "Жогору кайтуу", cities: "Шаарлар", contribute: "Салым кошуу", location: "Жайгашкан жер", noGuides: "Азырынча жарыяланган шаардык колдонмо жок." }
  ,lo: { contents: "ໃນໜ້ານີ້", verified: "ກວດສອບຫຼ້າສຸດ", report: "ແຈ້ງຂໍ້ມູນທີ່ບໍ່ຖືກຕ້ອງ", back: "ກັບຄືນດ້ານເທິງ", cities: "ເມືອງ", contribute: "ຮ່ວມມື", location: "ສະຖານທີ່", noGuides: "ຍັງບໍ່ມີຄູ່ມືເມືອງທີ່ເຜີຍແຜ່." }
  ,dv: { contents: "މި ސަފުހާގައި", verified: "ފަހުން ޔަގީންކުރި", report: "މި އެންޓްރީގެ ނުބައި މަޢުލޫމާތު ރިޕޯޓްކުރައްވާ", back: "މަތިއަށް", cities: "ސިޓީތައް", contribute: "ބައިވެރިވާ", location: "ތަން", noGuides: "އާންމުކޮށް ޝާއިޢުކުރެވިފައިވާ ސިޓީ ގައިޑެއް ނެތް." }
  ,mn: { contents: "Энэ хуудсанд", verified: "Сүүлд шалгасан", report: "Энэ мэдээллийн алдааг мэдэгдэх", back: "Дээш буцах", cities: "Хотууд", contribute: "Хувь нэмэр оруулах", location: "Байршил", noGuides: "Одоогоор нийтэлсэн хотын гарын авлага алга." }
  ,my: { contents: "ဤစာမျက်နှာတွင်", verified: "နောက်ဆုံးစစ်ဆေးသည့်ရက်", report: "ဤအချက်အလက်၏ အမှားကို တိုင်ကြားရန်", back: "အပေါ်သို့ပြန်ရန်", cities: "မြို့များ", contribute: "ပါဝင်ကူညီရန်", location: "တည်နေရာ", noGuides: "ထုတ်ဝေထားသော မြို့လမ်းညွှန် မရှိသေးပါ။" }
  ,ne: { contents: "यस पृष्ठमा", verified: "अन्तिम जाँच", report: "यस प्रविष्टिको गलत जानकारी रिपोर्ट गर्नुहोस्", back: "माथि फर्कनुहोस्", cities: "सहरहरू", contribute: "योगदान गर्नुहोस्", location: "स्थान", noGuides: "अहिलेसम्म प्रकाशित सहर मार्गदर्शिका छैन।" }
  ,si: { contents: "මෙම පිටුවේ", verified: "අවසන් වරට තහවුරු කළේ", report: "මෙම සටහනේ වැරදි තොරතුරු වාර්තා කරන්න", back: "ඉහළට ආපසු", cities: "නගර", contribute: "දායක වන්න", location: "ස්ථානය", noGuides: "තවම ප්‍රකාශිත නගර මාර්ගෝපදේශ නොමැත." }
  ,tg: { contents: "Дар ин саҳифа", verified: "Санҷиши охирин", report: "Дар бораи маълумоти нодуруст хабар диҳед", back: "Ба боло", cities: "Шаҳрҳо", contribute: "Саҳм гузоред", location: "Ҷойгиршавӣ", noGuides: "Ҳоло роҳнамои нашршудаи шаҳр вуҷуд надорад." }
  ,tet: { contents: "Iha pájina ida-ne'e", verified: "Verifikasaun ikus", report: "Hato'o informasaun sala iha rejistu ida-ne'e", back: "Fila ba leten", cities: "Sidade sira", contribute: "Kontribui", location: "Lokalizasaun", noGuides: "Seidauk iha guia sidade publika." }
  ,tk: { contents: "Şu sahypada", verified: "Soňky barlag", report: "Bu ýazgydaky nädogry maglumat barada habar beriň", back: "Ýokary dolan", cities: "Şäherler", contribute: "Goşant goş", location: "Ýerleşýän ýeri", noGuides: "Häzirlikçe çap edilen şäher gollanmasy ýok." }
  ,uz: { contents: "Ushbu sahifada", verified: "Oxirgi tekshiruv", report: "Ushbu yozuvdagi noto‘g‘ri ma’lumotni bildiring", back: "Yuqoriga qaytish", cities: "Shaharlar", contribute: "Hissa qo‘shish", location: "Joylashuv", noGuides: "Hozircha e’lon qilingan shahar qo‘llanmasi yo‘q." }
  ,vi: { contents: "Trong trang này", verified: "Xác minh lần cuối", report: "Báo thông tin sai trong mục này", back: "Về đầu trang", cities: "Thành phố", contribute: "Đóng góp", location: "Địa điểm", noGuides: "Chưa có hướng dẫn thành phố nào được xuất bản." }
};

export function uiFor(language = "en") {
  const base = language.toLowerCase().split("-")[0];
  if (language.toLowerCase().startsWith("zh")) return translations.zh;
  return translations[base] ?? translations.en;
}

export function issueUrl(city, entryId = "page") {
  const location = city.location;
  const languageSuffix = city.locale.primary ? "" : `.${city.locale.language.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const dataFile = `data/cities/${location.country_slug}/${location.region_slug}/${location.city_slug}${languageSuffix}.json`;
  const pageUrl = `https://nohomehelp.com/${location.country_slug}/${location.region_slug}/${location.city_slug}${languageSuffix}.html`;
  const title = `Incorrect information: ${location.city_name} — ${entryId}`;
  const body = [
    `Data file: ${dataFile}`,
    `Entry ID: ${entryId}`,
    `Page: ${pageUrl}`,
    "",
    "What is incorrect or has changed?",
    "",
    "Source or evidence (if available):",
  ].join("\n");
  const parameters = new URLSearchParams({ template: "incorrect-information.md", title, body });
  return `${REPOSITORY_URL}/issues/new?${parameters.toString()}`;
}
