import { useState, useRef } from "react";

// ────────────────────────────────────────────────────────────
// ЗАВИСИМОСТИ (перенесены из App.tsx)
// ────────────────────────────────────────────────────────────
const LEADS_WORKER = "https://sofoniya-leads.dnrsabbath.workers.dev";
const TG_BOT_TOKEN = import.meta.env.VITE_TG_BOT_TOKEN as string;
const TG_CHAT_ID = import.meta.env.VITE_TG_CHAT_ID as string;
const EMAIL_TO = "trakun178@yandex.ru";

const LINKS = {
  tg: "https://t.me/dnr_peretyajka_mebeli?direct",
  max: "https://max.ru/u/f9LHodD0cOIb2Tv0HZyO-NRT9UJWPvPj8e-2REW_Cnq5XCVdNIjvwyM0Otk",
};

type PhotoAtt = { filename: string; content: string };
type LeadData = {
  name: string;
  phone: string;
  comment: string;
  service: string;
  photos?: PhotoAtt[];
};

async function fileToAttachment(file: File): Promise<PhotoAtt | null> {
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.82),
    );
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return {
      filename: (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg",
      content: btoa(bin),
    };
  } catch {
    return null;
  }
}

async function sendViaWorker(data: LeadData) {
  const r = await fetch(LEADS_WORKER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("worker fail");
}

async function sendToTelegram(data: LeadData) {
  const text =
    `🛋 <b>Новая заявка с сайта!</b>\n` +
    `Услуга: ${data.service}\n` +
    `Имя: ${data.name || "—"}\n` +
    `Телефон: ${data.phone}\n` +
    (data.comment ? `Комментарий: ${data.comment}\n` : "") +
    ` ${new Date().toLocaleString("ru-RU")}`;
  const r = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
    },
  );
  if (!r.ok) throw new Error("TG send failed");
}

async function sendEmailFallback(data: LeadData) {
  const r = await fetch(`https://formsubmit.co/ajax/${EMAIL_TO}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      _subject: `Заявка SOFONIYA: ${data.service}`,
      Имя: data.name || "—",
      Телефон: data.phone,
      Комментарий: data.comment || "—",
    }),
  });
  if (!r.ok) throw new Error("email send failed");
}

async function sendLead(data: LeadData) {
  try {
    await sendViaWorker(data);
    return;
  } catch {}
  try {
    await sendToTelegram(data);
    return;
  } catch {}
  await sendEmailFallback(data);
}

async function sendPhotosToTelegram(files: File[], caption: string) {
  if (!files.length) return;
  if (files.length === 1) {
    const fd = new FormData();
    fd.append("chat_id", TG_CHAT_ID);
    fd.append("caption", caption);
    fd.append("photo", files[0], "photo.jpg");
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: fd,
    });
    return;
  }
  const fd = new FormData();
  const media = files.map((f, i) => ({
    type: "photo",
    media: `attach://photo${i}`,
    ...(i === 0 ? { caption, parse_mode: "HTML" } : {}),
  }));
  fd.append("chat_id", TG_CHAT_ID);
  fd.append("media", JSON.stringify(media));
  files.forEach((f, i) => fd.append(`photo${i}`, f, `photo${i}.jpg`));
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMediaGroup`, {
    method: "POST",
    body: fd,
  });
}

// ────────────────────────────────────────────────────────────
// ЭКОНОМИКА
// ────────────────────────────────────────────────────────────
const CALC = {
  laborPerM: 1000,
  types: [
    { id: "straight", name: "Прямой диван", baseM: 9, work: 25000 },
    { id: "corner", name: "Угловой диван", baseM: 13, work: 45000 },
    { id: "armchair", name: "Кресло", baseM: 7, work: 15000 },
    { id: "chair", name: "Стул", baseM: 3, work: 3000 },
    { id: "kitchen", name: "Кухонный уголок", baseM: 10, work: 20000 },
  ],
  mechanisms: [
    { id: "none", name: "Без механизма", m: 0 },
    { id: "book", name: "Книжка", m: 3 },
    { id: "euro", name: "Еврокнижка", m: 4 },
    { id: "dolphin", name: "Дельфин", m: 4 },
    { id: "tick", name: "Тик-так", m: 4 },
  ],
  cushionM: 2,
  tuftMult: 1.5,
  finishes: [
    { id: "stitch", name: "Отстрочка", price: 1000 },
    { id: "kant", name: "Кант", price: 1500 },
    { id: "nails", name: "Декор. гвозди", price: 2000 },
    { id: "buttons", name: "Пуговицы", price: 1500 },
    { id: "tuft", name: "Каретная стяжка", price: 5000 },
  ],
  repairs: [
    { id: "frame", name: "Каркас", price: 3000 },
    { id: "legs", name: "Опоры", price: 3000 },
    { id: "mech", name: "Механизм", price: 3000 },
    { id: "ppu", name: "Замена ППУ", price: 3000 },
  ],
  materials: [
    { id: "own", name: "Своя ткань", rate: 0 },
    { id: "cat1", name: "Ткань 1 кат.", rate: 1500 },
    { id: "cat2", name: "Ткань 2 кат.", rate: 2500 },
    { id: "cat3", name: "Ткань 3 кат.", rate: 3000 },
    { id: "cat4", name: "Ткань 4 кат.", rate: 4000 },
    { id: "eco", name: "Экокожа", rate: 5000 },
    { id: "leather", name: "Натуральная кожа", rate: 10000 },
  ],
};

// ────────────────────────────────────────────────────────────
// ИКОНКИ
// ────────────────────────────────────────────────────────────
const SOFA_ICON = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="8" y="28" width="48" height="20" rx="2" />
    <path d="M8 28V20a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v8" />
    <line x1="16" y1="48" x2="16" y2="56" />
    <line x1="48" y1="48" x2="48" y2="56" />
  </svg>
);
const CORNER_ICON = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 48V20a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v28" />
    <rect x="8" y="40" width="20" height="16" rx="2" />
    <rect x="36" y="20" width="20" height="36" rx="2" />
  </svg>
);
const ARMCHAIR_ICON = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="16" y="32" width="32" height="20" rx="2" />
    <path d="M16 32V24a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v8" />
    <line x1="20" y1="52" x2="20" y2="58" />
    <line x1="44" y1="52" x2="44" y2="58" />
  </svg>
);
const CHAIR_ICON = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="20" y="28" width="24" height="20" rx="2" />
    <path d="M20 28V22a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v6" />
    <line x1="24" y1="48" x2="24" y2="56" />
    <line x1="40" y1="48" x2="40" y2="56" />
  </svg>
);
const KITCHEN_ICON = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 36 L20 24 L44 24 L56 36 L56 48 L8 48 Z" />
    <path d="M20 24 L20 48" />
    <path d="M44 24 L44 48" />
  </svg>
);

// ────────────────────────────────────────────────────────────
// КОМПОНЕНТ
// ────────────────────────────────────────────────────────────
export default function Calculator() {
  const [step, setStep] = useState(0);
  const [typeId, setTypeId] = useState("straight");
  const [width, setWidth] = useState(2000);
  const [depth, setDepth] = useState(950);
  const [height, setHeight] = useState(850);
  const [armrests, setArmrests] = useState("two");
  const [mechId, setMechId] = useState("none");
  const [back, setBack] = useState(3);
  const [seat, setSeat] = useState(3);
  const [tuft, setTuft] = useState(false);
  const [fins, setFins] = useState<string[]>([]);
  const [reps, setReps] = useState<string[]>([]);
  const [matId, setMatId] = useState("cat1");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [hp, setHp] = useState("");
  const openedAt = useRef(Date.now());
  const [sent, setSent] = useState(false);

  const type = CALC.types.find((t) => t.id === typeId)!;
  const mech = CALC.mechanisms.find((m) => m.id === mechId)!;
  const mat = CALC.materials.find((m) => m.id === matId)!;

  const scale = typeId === "chair" ? 1 : width / 2000;
  const baseMeters = type.baseM * scale;
  const raw = baseMeters + mech.m + (back + seat) * CALC.cushionM;
  const meters = Math.round(raw * (tuft ? CALC.tuftMult : 1) * 10) / 10;
  const extraM = Math.max(0, meters - baseMeters);
  const finSum = CALC.finishes
    .filter((f) => fins.includes(f.id))
    .reduce((s, f) => s + f.price, 0);
  const repSum = CALC.repairs
    .filter((r) => reps.includes(r.id))
    .reduce((s, r) => s + r.price, 0);
  const labor = Math.round(
    type.work + extraM * CALC.laborPerM + finSum + repSum,
  );
  const material = Math.round(meters * mat.rate);
  const total = labor + material;

  const toggle = (arr: string[], id: string, set: (v: string[]) => void) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const furnitureTypes = [
    { id: "straight", name: "Прямой диван", icon: SOFA_ICON },
    { id: "corner", name: "Угловой диван", icon: CORNER_ICON },
    { id: "armchair", name: "Кресло", icon: ARMCHAIR_ICON },
    { id: "chair", name: "Стул", icon: CHAIR_ICON },
    { id: "kitchen", name: "Кухонный уголок", icon: KITCHEN_ICON },
  ];

  const send = async () => {
    if (hp.trim() !== "" || Date.now() - openedAt.current < 1500) {
      setSent(true);
      return;
    }
    try {
      const att = photos.length
        ? (await Promise.all(photos.map(fileToAttachment))).filter(
            (x): x is PhotoAtt => x !== null,
          )
        : [];
      const summary = `Тип: ${type.name}; ${width}×${depth}×${height}мм; мех: ${mech.name}; подлок: ${armrests}; подушки: ${back}+${seat}; стяжка: ${tuft ? "да" : "нет"}; ткань: ${mat.name}; расход: ≈${meters}м; работа: ${labor.toLocaleString()}₽; материал: ${material.toLocaleString()}₽`;
      await sendLead({
        name,
        phone,
        comment: summary,
        service: "Калькулятор: " + type.name,
        photos: att,
      });
      if (photos.length)
        await sendPhotosToTelegram(
          photos,
          ` Фото к расчёту: ${type.name}, ${phone}`,
        ).catch(() => {});
      setSent(true);
    } catch {
      setSent(false);
    }
  };

  return (
    <div className="calc-new">
      <div className="calc-header">
        <span className="calc-label">КАЛЬКУЛЯТОР ПЕРЕТЯЖКИ</span>
        <h2 className="calc-title">
          Посчитайте <span className="accent">за минуту</span>
        </h2>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">01 Что перетягиваем</h3>
        <div className="calc-grid">
          {furnitureTypes.map((t) => (
            <button
              key={t.id}
              className={`calc-card ${typeId === t.id ? "active" : ""}`}
              onClick={() => setTypeId(t.id)}
            >
              <span className="card-icon">{t.icon}</span>
              <span className="card-name">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">02 Размеры</h3>
        <div className="calc-sliders">
          <div className="slider-group">
            <label>
              Ширина{" "}
              <span>
                {width} <small>мм</small>
              </span>
            </label>
            <input
              type="range"
              min="400"
              max="4000"
              step="50"
              value={width}
              onChange={(e) => setWidth(+e.target.value)}
            />
          </div>
          <div className="slider-group">
            <label>
              Глубина{" "}
              <span>
                {depth} <small>мм</small>
              </span>
            </label>
            <input
              type="range"
              min="400"
              max="1200"
              step="50"
              value={depth}
              onChange={(e) => setDepth(+e.target.value)}
            />
          </div>
          <div className="slider-group">
            <label>
              Высота{" "}
              <span>
                {height} <small>мм</small>
              </span>
            </label>
            <input
              type="range"
              min="400"
              max="1200"
              step="50"
              value={height}
              onChange={(e) => setHeight(+e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">03 Подлокотники</h3>
        <div className="calc-chips">
          <button
            className={`chip ${armrests === "two" ? "active" : ""}`}
            onClick={() => setArmrests("two")}
          >
            Два
          </button>
          <button
            className={`chip ${armrests === "one" ? "active" : ""}`}
            onClick={() => setArmrests("one")}
          >
            Один
          </button>
          <button
            className={`chip ${armrests === "none" ? "active" : ""}`}
            onClick={() => setArmrests("none")}
          >
            Без
          </button>
        </div>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">04 Механизм</h3>
        <div className="calc-chips">
          {CALC.mechanisms.map((m) => (
            <button
              key={m.id}
              className={`chip ${mechId === m.id ? "active" : ""}`}
              onClick={() => setMechId(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">05 Подушки</h3>
        <div className="calc-counters">
          <div className="counter">
            <span>Спинки</span>
            <div className="counter-controls">
              <button onClick={() => setBack(Math.max(0, back - 1))}>−</button>
              <b>{back}</b>
              <button onClick={() => setBack(back + 1)}>+</button>
            </div>
          </div>
          <div className="counter">
            <span>Сиденья</span>
            <div className="counter-controls">
              <button onClick={() => setSeat(Math.max(0, seat - 1))}>−</button>
              <b>{seat}</b>
              <button onClick={() => setSeat(seat + 1)}>+</button>
            </div>
          </div>
          <button
            className={`chip ${tuft ? "active" : ""}`}
            onClick={() => setTuft(!tuft)}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Каретная стяжка ×1,5
          </button>
        </div>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">06 Обивка</h3>
        <div className="calc-fabric">
          {CALC.materials.map((m) => (
            <button
              key={m.id}
              className={`fabric-card ${matId === m.id ? "active" : ""}`}
              onClick={() => setMatId(m.id)}
            >
              <span>{m.name}</span>
              <strong>
                {(labor + Math.round(meters * m.rate)).toLocaleString("ru-RU")}{" "}
                ₽
              </strong>
            </button>
          ))}
        </div>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">07 Отделка</h3>
        <div className="calc-finish">
          {CALC.finishes.map((f) => (
            <button
              key={f.id}
              className={`finish-btn ${fins.includes(f.id) ? "active" : ""}`}
              onClick={() => toggle(fins, f.id, setFins)}
            >
              <span>+</span> {f.name}
            </button>
          ))}
        </div>
      </div>

      <div className="calc-section">
        <h3 className="calc-section-title">08 Ремонт</h3>
        <p className="repair-note">по 3 000 ₽ за работу</p>
        <div className="calc-repair">
          {CALC.repairs.map((r) => (
            <button
              key={r.id}
              className={`repair-btn ${reps.includes(r.id) ? "active" : ""}`}
              onClick={() => toggle(reps, r.id, setReps)}
            >
              <span>+</span> {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="calc-summary-block">
        <div className="summary-card">
          <span className="summary-label">ОРИЕНТИРОВОЧНАЯ СТОИМОСТЬ</span>
          <div className="summary-price">
            <span className="price-prefix">≈</span>
            <span className="price-value">
              {total.toLocaleString("ru-RU")} ₽
            </span>
          </div>
          <p className="summary-desc">
            {type.name} · {width}×{depth}×{height} мм · {mat.name}
          </p>
          <div className="summary-details">
            <div className="detail-row">
              <span>Расход ткани</span>
              <strong>{meters} м</strong>
            </div>
            <div className="detail-row">
              <span>Работа</span>
              <strong>{labor.toLocaleString("ru-RU")} ₽</strong>
            </div>
            <div className="detail-row">
              <span>Материал</span>
              <strong>{material.toLocaleString("ru-RU")} ₽</strong>
            </div>
          </div>
          <div className="summary-form">
            <input
              className="summary-input"
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="summary-input"
              placeholder="Телефон"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <label className="summary-file">
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) =>
                  setPhotos(Array.from(e.target.files || []).slice(0, 3))
                }
              />
              {photos.length
                ? `📎 Фото: ${photos.length}`
                : "📎 Прикрепить фото (до 3 шт)"}
            </label>
            <input
              className="lm-hp"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              placeholder="Не заполняйте"
            />
            <div className="summary-actions">
              <button
                className="btn-send"
                onClick={send}
                disabled={!phone || sent}
              >
                {sent ? "Отправлено ✓" : "Отправить расчёт менеджеру"}
              </button>
              <a
                className="btn-photo"
                href={LINKS.tg}
                target="_blank"
                rel="noreferrer"
              >
                Или расчёт по фото в Telegram
              </a>
            </div>
            <p className="summary-note">
              Точную цену назовём по фото и зафиксируем в договоре.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
