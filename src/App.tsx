import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Link, useParams } from "react-router-dom";
import { CATALOG, coverOf, shadeOf } from "./data/catalog";
import type { FabricType, Collection } from "./data/catalog";

// ────────────────────────────────────────────────────────────
// КОНСТАНТЫ
// ────────────────────────────────────────────────────────────
const TG_BOT_TOKEN = import.meta.env.VITE_TG_BOT_TOKEN as string;
const TG_CHAT_ID = import.meta.env.VITE_TG_CHAT_ID as string;
const LEADS_WORKER = "https://sofoniya-leads.dnrsabbath.workers.dev";
const EMAIL_TO = "trakun178@yandex.ru";

const LEGAL = {
  name: "ИП Тракун Д.М.",
  ogrnip: "325930100020396",
  inn: "101102624468",
  address: "ДНР, г. Донецк — адрес производства уточняется по телефону",
  mapSrc: "https://yandex.ru/map-widget/v1/?ll=37.804662%2C48.007367&z=12",
};

const LINKS = {
  tg: "https://t.me/dnr_peretyajka_mebeli?direct",
  max: "https://max.ru/u/f9LHodD0cOIb2Tv0HZyO-NRT9UJWPvPj8e-2REW_Cnq5XCVdNIjvwyM0Otk",
  vk: "https://vk.ru/gim226964069?entrypoint=community_page",
};

const PHONE_PATH = (
  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
);
const TG_PATH = <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />;

function svgIcon(d: React.ReactNode, size = 22) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d}
    </svg>
  );
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".rev");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("on");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ────────────────────────────────────────────────────────────
// ОТПРАВКА ЗАЯВОК
// ────────────────────────────────────────────────────────────
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
    `⏰ ${new Date().toLocaleString("ru-RU")}`;
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
// ЭКОНОМИКА: базовая работа (без ткани) + материал отдельно
// ────────────────────────────────────────────────────────────
const CALC = {
  laborPerM: 1000,
  types: [
    { id: "straight", name: "Прямой диван", baseM: 9, work: 16000 },
    { id: "corner", name: "Угловой диван", baseM: 13, work: 32000 },
    { id: "armchair", name: "Кресло", baseM: 7, work: 8000 },
    { id: "chair", name: "Стул", baseM: 3, work: 0 },
    { id: "kitchen", name: "Кухонный уголок", baseM: 10, work: 10000 },
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

// ───────────────────────────────────────────────────────────
// ИКОНКИ МЕБЕЛИ
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
// МАЛЫЕ КОМПОНЕНТЫ
// ────────────────────────────────────────────────────────────
function CoverImg({ t, c }: { t: FabricType; c: Collection }) {
  return (
    <span className={`show-media ${t.cls}`}>
      <img
        src={coverOf(t, c)}
        alt={`${c.name} — ${t.name}`}
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </span>
  );
}

function AutoBeforeAfter({
  before,
  after,
  alt,
}: {
  before: string;
  after: string;
  alt: string;
}) {
  const [pos, setPos] = useState(50);
  const [hold, setHold] = useState(false);
  const dir = useRef(1);

  useEffect(() => {
    if (hold) return;
    const t = setInterval(() => {
      setPos((p) => {
        let n = p + dir.current * 0.4;
        if (n >= 100) {
          n = 100;
          dir.current = -1;
        }
        if (n <= 0) {
          n = 0;
          dir.current = 1;
        }
        return n;
      });
    }, 30);
    return () => clearInterval(t);
  }, [hold]);

  const move = (x: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  };

  return (
    <div
      className="aba"
      onPointerDown={(e) => {
        setHold(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX, e.currentTarget);
      }}
      onPointerMove={(e) => {
        if (hold) move(e.clientX, e.currentTarget);
      }}
      onPointerUp={() => setHold(false)}
      onPointerCancel={() => setHold(false)}
    >
      <img className="aba-img" src={after} alt={alt} draggable={false} />
      <img
        className="aba-img"
        src={before}
        alt={alt + " — до"}
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className="aba-line" style={{ left: pos + "%" }}>
        <span className="aba-handle">⇔</span>
      </div>
      <span className="aba-tag" style={{ left: 12 }}>
        До
      </span>
      <span className="aba-tag" style={{ right: 12 }}>
        После
      </span>
    </div>
  );
}

function MiniHeader() {
  return (
    <header className="mini-header">
      <Link to="/" className="mini-logo">
        SOFONIYA
      </Link>
      <Link to="/" className="back">
        ← На главную
      </Link>
    </header>
  );
}

function MiniFooter() {
  return (
    <footer className="mini-footer">
      © {new Date().getFullYear()} SOFONIYA · {LEGAL.name} · ОГРНИП{" "}
      {LEGAL.ogrnip}
    </footer>
  );
}

function MaskedPhone() {
  const [show, setShow] = useState(false);
  return show ? (
    <a className="footer-phone" href="tel:+79490983532">
      +7 949 098-35-32
    </a>
  ) : (
    <button className="footer-phone masked" onClick={() => setShow(true)}>
      +7 949 098-••-•• <i>показать</i>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// LEAD-МОДАЛКА
// ────────────────────────────────────────────────────────────
function LeadModal({
  service,
  onClose,
}: {
  service: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [hp, setHp] = useState("");
  const openedAt = useRef(Date.now());
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hp.trim() !== "" || Date.now() - openedAt.current < 1500) {
      setState("done");
      return;
    }
    setState("sending");
    try {
      const att = photos.length
        ? (await Promise.all(photos.map(fileToAttachment))).filter(
            (x): x is PhotoAtt => x !== null,
          )
        : [];
      await sendLead({ name, phone, comment, service, photos: att });
      if (photos.length)
        await sendPhotosToTelegram(
          photos,
          `📎 Фото к заявке: ${service}, ${phone}`,
        ).catch(() => {});
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="lm-overlay" onClick={onClose}>
      <div className="lm-card" onClick={(e) => e.stopPropagation()}>
        <button className="lm-close" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
        {state === "done" ? (
          <div className="lm-done">
            <h3>Заявка отправлена!</h3>
            <p>Перезвоним в течение 15 минут в рабочее время.</p>
            <button className="btn btn-primary" onClick={onClose}>
              Отлично
            </button>
          </div>
        ) : (
          <>
            <h3 className="lm-title">Расчёт: {service}</h3>
            <form onSubmit={submit} className="lm-form">
              <input
                className="lm-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                required
              />
              <input
                className="lm-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон"
                type="tel"
                required
              />
              <textarea
                className="lm-input lm-area"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Опишите мебель (необязательно)"
              />
              <label className="lm-file">
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
                  ? `📎 Фото прикреплено: ${photos.length}`
                  : "📎 Прикрепить фото мебели (до 3 шт)"}
              </label>
              <input
                className="lm-hp"
                tabIndex={-1}
                autoComplete="off"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="Не заполняйте это поле"
              />
              <button
                className="btn btn-primary lm-submit"
                type="submit"
                disabled={state === "sending"}
              >
                {state === "sending" ? "Отправляем…" : "Отправить заявку →"}
              </button>
              {state === "error" && (
                <p className="lm-error">
                  Не удалось отправить. Позвоните мастеру или напишите в{" "}
                  <a href={LINKS.max} target="_blank" rel="noreferrer">
                    MAX
                  </a>
                  {" / "}
                  <a href={LINKS.tg} target="_blank" rel="noreferrer">
                    Telegram
                  </a>
                  .
                </p>
              )}
              <small className="lm-note">
                Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
              </small>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// КАЛЬКУЛЯТОР (НОВЫЙ ДИЗАЙН: тёмная тема, иконки, слайдеры)
// ────────────────────────────────────────────────────────────
function Calculator() {
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

  const steps = [
    { id: "type", title: "Что перетягиваем" },
    { id: "size", title: "Размеры" },
    { id: "armrests", title: "Подлокотники" },
    { id: "mech", title: "Механизм" },
    { id: "cushions", title: "Подушки" },
    { id: "fabric", title: "Обивка" },
    { id: "finish", title: "Отделка" },
    { id: "repair", title: "Ремонт" },
  ];

  const furnitureTypes = [
    { id: "straight", name: "Прямой", icon: SOFA_ICON },
    { id: "corner", name: "Угловой", icon: CORNER_ICON },
    { id: "armchair", name: "Кресло", icon: ARMCHAIR_ICON },
    { id: "chair", name: "Стул", icon: CHAIR_ICON },
    { id: "kitchen", name: "Кухонный", icon: KITCHEN_ICON },
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
          `📎 Фото к расчёту: ${type.name}, ${phone}`,
        ).catch(() => {});
      setSent(true);
    } catch {
      setSent(false);
    }
  };

  return (
    <div className="calc-new rev">
      <div className="calc-header">
        <span className="calc-label">КАЛЬКУЛЯТОР ПЕРЕТЯЖКИ</span>
        <h2 className="calc-title">
          Посчитайте <span className="accent">за минуту</span>
        </h2>
      </div>

      <div className="calc-steps">
        {steps.map((s, i) => (
          <button
            key={s.id}
            className={`calc-step ${i === step ? "active" : i < step ? "done" : ""}`}
            onClick={() => setStep(i)}
          >
            <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="step-title">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="calc-content">
        {step === 0 && (
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
        )}

        {step === 1 && (
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
                min="1200"
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
                min="600"
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
                min="600"
                max="1200"
                step="50"
                value={height}
                onChange={(e) => setHeight(+e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
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
        )}

        {step === 3 && (
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
        )}

        {step === 4 && (
          <div className="calc-counters">
            <div className="counter">
              <span>Спинки</span>
              <div className="counter-controls">
                <button onClick={() => setBack(Math.max(0, back - 1))}>
                  −
                </button>
                <b>{back}</b>
                <button onClick={() => setBack(back + 1)}>+</button>
              </div>
            </div>
            <div className="counter">
              <span>Сиденья</span>
              <div className="counter-controls">
                <button onClick={() => setSeat(Math.max(0, seat - 1))}>
                  −
                </button>
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
        )}

        {step === 5 && (
          <div className="calc-fabric">
            {CALC.materials.map((m) => (
              <button
                key={m.id}
                className={`fabric-card ${matId === m.id ? "active" : ""}`}
                onClick={() => setMatId(m.id)}
              >
                <span>{m.name}</span>
                <strong>
                  {(labor + Math.round(meters * m.rate)).toLocaleString(
                    "ru-RU",
                  )}{" "}
                  ₽
                </strong>
              </button>
            ))}
          </div>
        )}

        {step === 6 && (
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
        )}

        {step === 7 && (
          <div className="calc-repair">
            <p className="repair-note">по 3 000 ₽ за работу</p>
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
        )}
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

      <div className="calc-nav-buttons">
        <button
          className="nav-prev"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          ← Назад
        </button>
        <button
          className="nav-next"
          onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
          disabled={step === steps.length - 1}
        >
          Далее →
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// FAB
// ────────────────────────────────────────────────────────────
function ContactFab() {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) return;
    const t = setInterval(() => setI((v) => (v + 1) % 4), 3000);
    return () => clearInterval(t);
  }, [open]);

  const main = [
    {
      title: "MAX",
      bg: "#7A5AF8",
      icon: <span style={{ fontWeight: 800, fontSize: 13 }}>MAX</span>,
    },
    { title: "Позвонить", bg: "#FF6B00", icon: svgIcon(PHONE_PATH) },
    { title: "Telegram", bg: "#0088CC", icon: svgIcon(TG_PATH) },
    {
      title: "ВКонтакте",
      bg: "#4A76A8",
      icon: <span style={{ fontWeight: 800, fontSize: 12 }}>VK</span>,
    },
  ];
  const s = main[i];

  return (
    <div className={`cfab ${open ? "cfab-open" : ""}`}>
      <div className="cfab-menu">
        <a
          className="cfab-item"
          style={{ background: "#7A5AF8" }}
          title="MAX"
          href={LINKS.max}
          target="_blank"
          rel="noreferrer"
        >
          <span style={{ fontWeight: 800, fontSize: 11 }}>MAX</span>
        </a>
        <a
          className="cfab-item"
          style={{ background: "#0088CC" }}
          title="Telegram"
          href={LINKS.tg}
          target="_blank"
          rel="noreferrer"
        >
          {svgIcon(TG_PATH, 18)}
        </a>
        <a
          className="cfab-item"
          style={{ background: "#4A76A8" }}
          title="Мы во ВКонтакте"
          href={LINKS.vk}
          target="_blank"
          rel="noreferrer"
        >
          <span style={{ fontWeight: 800, fontSize: 12 }}>VK</span>
        </a>
        <a
          className="cfab-item"
          style={{ background: "#FF6B00" }}
          title="Позвонить"
          href="tel:+79490983532"
        >
          {svgIcon(PHONE_PATH, 18)}
        </a>
      </div>
      <button
        className="cfab-btn"
        style={{ background: s.bg }}
        title={s.title}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <span style={{ fontSize: 22 }}>✕</span> : s.icon}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ГЛАВНАЯ
// ────────────────────────────────────────────────────────────
function Home() {
  const [modal, setModal] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [videoOk, setVideoOk] = useState(true);
  useReveal();

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setNavOpen(false);
  };

  const SERVICES = [
    {
      name: "Перетяжка дивана",
      desc: "Прямые, угловые, модульные",
      price: "от 25 000 ₽",
    },
    {
      name: "Угловой диван",
      desc: "С сопряжением секций и кантом",
      price: "от 45 000 ₽",
    },
    {
      name: "Перетяжка кресла",
      desc: "Вольтеровские, офисные, каминные",
      price: "от 15 000 ₽",
    },
    {
      name: "Стулья и банкетки",
      desc: "Обеденные группы комплектом",
      price: "от 3 000 ₽",
    },
    {
      name: "Каретная стяжка",
      desc: "Капитоне, пуговицы, кант",
      price: "оценка по фото",
    },
    {
      name: "Ремонт мебели",
      desc: "Каркас, механизм, пружины",
      price: "от 3 000 ₽",
    },
  ];

  const MARQUEE = [
    "Перетяжка диванов",
    "Кресла и стулья",
    "Каретная стяжка",
    "Ремонт каркаса",
    "Бесплатный замер",
    "Гарантия 1 год",
    "Донецк · Макеевка · ДНР",
  ];

  return (
    <>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i}>{m} ✦</span>
          ))}
        </div>
      </div>

      <header className="header">
        <Link to="/" className="logo">
          <span>SOFONIYA</span>
          <small>реставрация мебели</small>
        </Link>
        <nav className={`nav ${navOpen ? "show" : ""}`}>
          <button className="nav-link" onClick={() => go("services")}>
            Услуги
          </button>
          <button className="nav-link" onClick={() => go("fabrics")}>
            Ткани
          </button>
          <button className="nav-link" onClick={() => go("calc")}>
            Калькулятор
          </button>
          <button className="nav-link" onClick={() => go("works")}>
            Работы
          </button>
          <button className="nav-link" onClick={() => go("contacts")}>
            Контакты
          </button>
        </nav>
        <div className="header-cta">
          <a
            className="btn btn-primary btn-sm"
            href={LINKS.max}
            target="_blank"
            rel="noreferrer"
          >
            MAX
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href={LINKS.tg}
            target="_blank"
            rel="noreferrer"
          >
            Telegram
          </a>
          <button
            className="burger"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Меню"
          >
            ☰
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-left">
          <span className="overline">ДНР · Донецк · Макеевка</span>
          <h1>Перетяжка мягкой мебели</h1>
          <h2>
            Ваш диван станет <em>лучше нового</em>
          </h2>
          <p className="hero-lead">
            Мастерская перетяжки с собственным цехом. Фиксированная цена в
            договоре, фабричный наполнитель, гарантия 1 год.
          </p>
          <div className="hero-btns">
            <button
              className="btn btn-primary glow"
              onClick={() => setModal("Рассчитать стоимость")}
            >
              Рассчитать стоимость
            </button>
            <a className="btn btn-ghost" href="tel:+79490983532">
              {svgIcon(PHONE_PATH, 18)} Позвонить
            </a>
          </div>
          <div className="stamps">
            <span className="stamp r1">
              <b>15</b> дней срок
            </span>
            <span className="stamp r2">
              <b>1</b> год гарантия
            </span>
            <span className="stamp r1">
              <b>0 ₽</b> вывоз и доставка
            </span>
          </div>
        </div>
        <div className="hero-art">
          {videoOk ? (
            <video
              className="hero-video"
              src="/works/master.mp4"
              autoPlay
              muted
              loop
              playsInline
              poster="/works/hero.jpg"
              onError={() => setVideoOk(false)}
            />
          ) : (
            <img
              className="hero-photo"
              src="/works/hero.jpg"
              alt="Мастер за работой"
            />
          )}
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-head rev" data-num="01">
          <span className="overline">Услуги</span>
          <h2>Что мы перетягиваем</h2>
        </div>
        <div className="rows">
          {SERVICES.map((s, i) => (
            <button
              className="row rev"
              key={s.name}
              onClick={() => setModal(s.name)}
            >
              <span className="row-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="row-title">{s.name}</span>
              <span className="row-desc">{s.desc}</span>
              <span className="row-price">{s.price}</span>
              <span className="row-arrow">→</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section" id="fabrics">
        <div className="section-head rev" data-num="02">
          <span className="overline">Материалы</span>
          <h2>Атлас тканей</h2>
          <p className="section-sub">
            Структура каждого материала — под увеличением. Нажмите на круг,
            чтобы открыть коллекции.
          </p>
        </div>
        <div className="fabric-grid">
          {CATALOG.map((f) => (
            <Link to={`/t/${f.id}`} className="swatch rev" key={f.id}>
              <span className={`sw ${f.cls}`}>
                <img
                  src="/sketches/weave.jpg"
                  alt={`Структура материала: ${f.name}`}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              </span>
              <small>{f.name}</small>
              {f.collections.length > 0 && (
                <small className="sw-sub">
                  {f.collections.length} коллекций
                </small>
              )}
            </Link>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <a
            className="btn btn-primary"
            href={LINKS.max}
            target="_blank"
            rel="noreferrer"
          >
            Привезти образцы бесплатно
          </a>
        </div>
      </section>

      <section className="section" id="collections">
        <div className="section-head rev" data-num="03">
          <span className="overline">Коллекции</span>
          <h2>Витрина коллекций</h2>
          <p className="section-sub">
            По одной представительной коллекции от каждого типа материала.
          </p>
        </div>
        <div className="showcase">
          {CATALOG.filter((t) => t.collections.length > 0).map((t) => {
            const c = t.collections[0];
            return (
              <Link
                className="show-card rev"
                key={t.id}
                to={`/t/${t.id}/${c.id}`}
              >
                <CoverImg t={t} c={c} />
                <span className="show-body">
                  <b>{c.name}</b>
                  <small>{t.name}</small>
                  <small className="show-kind">
                    {c.kind}
                    {c.thick ? " · " + c.thick : ""}
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section" id="calc">
        <div className="section-head rev" data-num="04">
          <span className="overline">Калькулятор</span>
          <h2>Стоимость за минуту</h2>
          <p className="section-sub">
            Работа — фикс за тип мебели. Материал — по категории, своей тканью —
            только работа.
          </p>
        </div>
        <Calculator />
      </section>

      <section className="section" id="works">
        <div className="section-head rev" data-num="05">
          <span className="overline">Работы</span>
          <h2>До и после</h2>
          <p className="section-sub">
            Потяните ползунок или наблюдайте — он дышит сам.
          </p>
        </div>
        <div className="works-grid">
          <div className="aba-wrap rev">
            <AutoBeforeAfter
              before="/works/before.jpg"
              after="/works/after.jpg"
              alt="Перетяжка изголовья: до и после"
            />
          </div>
          <div className="works-story rev">
            <h3>Изголовье кровати, каретная стяжка</h3>
            <p>
              Хозяйка думала выбросить: стяжка просела, ткань выцвела и местами
              отклеилась. Мы сохранили родной каркас и форму — заменили всё
              остальное.
            </p>
            <ul className="works-list">
              <li>Демонтаж старой обивки и пуговиц</li>
              <li>Новый поролон, перетяжка утяжек по ромбам</li>
              <li>Экокожа премиум, пуговицы в тон</li>
              <li>Срок 9 дней · гарантия 1 год</li>
            </ul>
            <button
              className="btn btn-primary"
              onClick={() => setModal("Перетяжка изголовья")}
            >
              Хочу так же
            </button>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="cta-inner">
          <div>
            <h2>Пришлите фото — назовём точную цену за 15 минут</h2>
            <p>
              Бесплатно и без обязательств. Подскажем 2–3 варианта ткани под ваш
              бюджет.
            </p>
          </div>
          <div className="cta-actions">
            <a
              className="btn btn-primary"
              href={LINKS.max}
              target="_blank"
              rel="noreferrer"
            >
              Фото в MAX
            </a>
            <a
              className="btn btn-ghost"
              href={LINKS.tg}
              target="_blank"
              rel="noreferrer"
            >
              Фото в Telegram
            </a>
          </div>
        </div>
      </section>

      <section className="section" id="process">
        <div className="section-head rev" data-num="06">
          <span className="overline">Процесс</span>
          <h2>Как мы работаем</h2>
        </div>
        <div className="process-grid">
          {[
            {
              n: "01",
              t: "Заявка и расчёт",
              d: "Пришлите фото — назовём точную стоимость бесплатно",
            },
            {
              n: "02",
              t: "Замер и образцы",
              d: "Привозим ткани и кожу, помогаем с выбором",
            },
            {
              n: "03",
              t: "Договор и фикс-цена",
              d: "Стоимость не меняется после начала работ",
            },
            {
              n: "04",
              t: "Демонтаж и диагностика",
              d: "Проверяем каркас, ремни, наполнитель",
            },
            {
              n: "05",
              t: "Пошив и сборка",
              d: "Лекала, чехол, фабричный наполнитель",
            },
            {
              n: "06",
              t: "Доставка и гарантия",
              d: "Привозим обратно и выдаём гарантию",
            },
          ].map((s) => (
            <div className="process-card rev" key={s.n}>
              <div className="process-num">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="faq">
        <div className="faq-wrap">
          <div className="faq-left rev">
            <span className="overline">Вопросы</span>
            <h2>Частые вопросы</h2>
            <p className="section-sub" style={{ textAlign: "left", margin: 0 }}>
              Не нашли ответ — напишите в MAX, ответим за 15 минут.
            </p>
          </div>
          <div className="faq-list">
            {[
              {
                q: "Сколько стоит перетяжка?",
                a: "Стул от 3 000 ₽, кресло от 15 000 ₽, диван от 25 000 ₽, угловой диван от 45 000 ₽. Точную цену назовём по фото или замере.",
              },
              {
                q: "Можно ли своей тканью?",
                a: "Да, тогда платите только за работу. Образцы можно привезти свои или выбрать из наших.",
              },
              {
                q: "Сколько времени занимает?",
                a: "Обычно до 15 дней. С каретной стяжкой и нестандартной геометрией — дольше.",
              },
              {
                q: "Даёте гарантию?",
                a: "Да, 1 год. Гарантия на работы прописывается в договоре.",
              },
              {
                q: "Забираете и привозите мебель?",
                a: "Да, вывоз и доставка обратно — бесплатно по Донецку и Макеевке.",
              },
            ].map((f, i) => (
              <details className="faq-item rev" key={i}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer" id="contacts">
        <div className="footer-grid">
          <div>
            <div className="logo light">
              <span>SOFONIYA</span>
              <small>реставрация мебели</small>
            </div>
            <p className="footer-tag">
              Вторая жизнь вашей мебели за 15 дней. Донецк, Макеевка и весь
              регион ДНР.
            </p>
            <div className="socials">
              <a
                className="soc soc-max"
                href="https://max.ru/channel_peretyajka"
                target="_blank"
                rel="noreferrer"
                title="MAX"
              >
                MAX
              </a>
              <a
                className="soc soc-tg"
                href="https://t.me/dnr_peretyajka_mebeli"
                target="_blank"
                rel="noreferrer"
                title="Telegram"
              >
                {svgIcon(TG_PATH, 18)}
              </a>
              <a
                className="soc soc-vk"
                href="https://vk.ru/dnr_peretyajka_mebeli"
                target="_blank"
                rel="noreferrer"
                title="ВКонтакте"
              >
                VK
              </a>
            </div>
          </div>
          <nav className="footer-nav">
            <h4>Разделы</h4>
            <button onClick={() => go("services")}>Услуги</button>
            <button onClick={() => go("fabrics")}>Ткани</button>
            <button onClick={() => go("calc")}>Калькулятор</button>
            <button onClick={() => go("works")}>Работы</button>
            <button onClick={() => go("faq")}>Вопросы</button>
          </nav>
          <div>
            <h4>Связаться</h4>
            <MaskedPhone />
            <p className="footer-note">
              Звоните 9:00–19:00 или пишите в мессенджеры — ответим за 15 минут.
            </p>
          </div>
          <div>
            <h4>Реквизиты</h4>
            <p className="footer-legal">{LEGAL.name}</p>
            <p className="footer-legal">ОГРНИП {LEGAL.ogrnip}</p>
            <p className="footer-legal">ИНН {LEGAL.inn}</p>
            <p className="footer-legal">{LEGAL.address}</p>
          </div>
        </div>
        <div className="footer-map">
          <iframe title="SOFONIYA на карте" src={LEGAL.mapSrc} loading="lazy" />
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} SOFONIYA · Перетяжка мебели в ДНР
        </div>
      </footer>

      <ContactFab />
      {modal && <LeadModal service={modal} onClose={() => setModal(null)} />}
    </>
  );
}

// ────────────────────────────────────────────────────────────
// СТРАНИЦА ТИПА ТКАНИ
// ────────────────────────────────────────────────────────────
function TypePage() {
  const { typeId } = useParams();
  const t = CATALOG.find((x) => x.id === typeId);
  if (!t) return <MiniHeader />;
  return (
    <div>
      <MiniHeader />
      <section className="section">
        <span className="overline">Материал</span>
        <h1 className="page-title">{t.name}</h1>
        {t.collections.length === 0 ? (
          <p className="empty-note">
            Коллекции этого материала наполняем. На замере мастер привезёт
            образцы и поможет с выбором.
          </p>
        ) : (
          <div className="cols-grid">
            {t.collections.map((c) => (
              <Link className="col-card" key={c.id} to={`/t/${t.id}/${c.id}`}>
                <div className="col-photo">
                  <img
                    src={coverOf(t, c)}
                    alt={c.name}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                </div>
                <h3>{c.name}</h3>
                <p className="col-type">{c.kind}</p>
                {c.thick && <p className="col-meta">Толщина: {c.thick}</p>}
              </Link>
            ))}
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <a
            className="btn btn-primary"
            href={LINKS.max}
            target="_blank"
            rel="noreferrer"
          >
            Привезти образцы бесплатно
          </a>
        </div>
      </section>
      <MiniFooter />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// СТРАНИЦА КОЛЛЕКЦИИ
// ────────────────────────────────────────────────────────────
function CollectionPage() {
  const { typeId, colId } = useParams();
  const t = CATALOG.find((x) => x.id === typeId);
  const c = t?.collections.find((x) => x.id === colId);
  if (!t || !c) return <MiniHeader />;
  return (
    <div>
      <MiniHeader />
      <section className="section">
        <Link to={`/t/${t.id}`} className="back">
          ← {t.name}: все коллекции
        </Link>
        <h1 className="page-title">{c.name}</h1>
        <p className="col-type">
          {c.kind}
          {c.thick ? " · толщина " + c.thick : ""}
        </p>
        <div className="shades-grid">
          {c.shades.length === 0 ? (
            <p className="empty-note">
              Фото цветов готовим. Напишите в Telegram — пришлём палитру
              оттенков за 5 минут.
            </p>
          ) : (
            c.shades.map((s) => (
              <div className="shade" key={s.name}>
                {s.photo ? (
                  <img
                    className="shade-photo"
                    src={shadeOf(t, c, s.photo)}
                    alt={`${c.name} — ${s.name}`}
                    loading="lazy"
                  />
                ) : (
                  <span className="shade-photo" style={{ background: s.hex }} />
                )}
                <small>{s.name}</small>
              </div>
            ))
          )}
        </div>
        <ul className="specs">
          {c.thick && <li>Толщина: {c.thick}</li>}
          {c.width && <li>Ширина: {c.width}</li>}
          {c.roll && <li>В рулоне: {c.roll}</li>}
          {c.effect && <li>Эффект: {c.effect}</li>}
        </ul>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <a
            className="btn btn-primary"
            href={LINKS.max}
            target="_blank"
            rel="noreferrer"
          >
            Рассчитать перетяжку в этой коллекции
          </a>
        </div>
      </section>
      <MiniFooter />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// РОУТЕР
// ───────────────────────────────────────────────────────────
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:typeId" element={<TypePage />} />
        <Route path="/t/:typeId/:colId" element={<CollectionPage />} />
      </Routes>
    </HashRouter>
  );
}
