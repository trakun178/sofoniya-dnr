import { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Link, useParams } from "react-router-dom";
import { CATALOG, coverOf, shadeOf } from "./data/catalog";
import type { FabricType, Collection } from "./data/catalog";

// ────────────────────────────────────────────────────────────
// КОНСТАНТЫ И ХЕЛПЕРЫ
// ────────────────────────────────────────────────────────────

const TG_BOT_TOKEN = import.meta.env.VITE_TG_BOT_TOKEN as string;
const TG_CHAT_ID = import.meta.env.VITE_TG_CHAT_ID as string;

async function sendToTelegram(data: {
  name: string;
  phone: string;
  comment: string;
  service: string;
}) {
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

async function sendPhotosToTelegram(files: File[], caption: string) {
  for (const f of files) {
    const fd = new FormData();
    fd.append("chat_id", TG_CHAT_ID);
    fd.append("caption", caption);
    fd.append("photo", f);
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: fd,
    });
  }
}

// ────────────────────────────────────────────────────────────
// КАЛЬКУЛЯТОР: честная формула «работа = 1000 ₽ за метр»
// Цифры ниже — твоя экономика, правь смело.
// ────────────────────────────────────────────────────────────

const CALC = {
  laborPerM: 1000,
  types: [
    { id: "straight", name: "Прямой диван", baseM: 9 },
    { id: "corner", name: "Угловой диван", baseM: 13 },
    { id: "armchair", name: "Кресло", baseM: 7 },
    { id: "chair", name: "Стул", baseM: 3 },
    { id: "kitchen", name: "Кухонный уголок", baseM: 10 },
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
  ],
  repairs: [
    { id: "frame", name: "Каркас", price: 3000 },
    { id: "legs", name: "Опоры", price: 3000 },
    { id: "mech", name: "Механизм", price: 3000 },
    { id: "ppu", name: "Замена ППУ", price: 3000 },
  ],
  materials: [
    { id: "own", name: "Своя ткань", rate: 0 },
    { id: "std", name: "Ткань стандарт", rate: 700 },
    { id: "prem", name: "Ткань премиум", rate: 1200 },
    { id: "eco", name: "Экокожа", rate: 1500 },
    { id: "leather", name: "Натуральная кожа", rate: 6500 },
  ],
};

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
      © {new Date().getFullYear()} SOFONIYA · Перетяжка мебели в ДНР ·{" "}
      <a href="tel:+79490983532">+7 949 098-35-32</a>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────
// LEAD-МОДАЛКА (фото + антиспам)
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
    if (hp.trim() !== "" || Date.now() - openedAt.current < 4000) {
      setState("done"); // бот верит в успех, заявка не уходит
      return;
    }
    setState("sending");
    try {
      await sendToTelegram({ name, phone, comment, service });
      if (photos.length) {
        await sendPhotosToTelegram(
          photos,
          `📎 Фото к заявке: ${service}, ${phone}`,
        ).catch(() => {});
      }
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
                  Не удалось отправить. Позвоните{" "}
                  <a href="tel:+79490983532">+7 949 098-35-32</a> или напишите в{" "}
                  <a
                    href="https://t.me/dnr_peretyajka_mebeli"
                    target="_blank"
                    rel="noreferrer"
                  >
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
// КАЛЬКУЛЯТОР (фото + антиспам)
// ────────────────────────────────────────────────────────────

function Calculator() {
  const [typeId, setTypeId] = useState("straight");
  const [width, setWidth] = useState(2000);
  const [mechId, setMechId] = useState("none");
  const [back, setBack] = useState(0);
  const [seat, setSeat] = useState(0);
  const [tuft, setTuft] = useState(false);
  const [fins, setFins] = useState<string[]>([]);
  const [reps, setReps] = useState<string[]>([]);
  const [matId, setMatId] = useState("std");
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
  const raw = type.baseM * scale + mech.m + (back + seat) * CALC.cushionM;
  const meters = Math.round(raw * (tuft ? CALC.tuftMult : 1) * 10) / 10;
  const finSum = CALC.finishes
    .filter((f) => fins.includes(f.id))
    .reduce((s, f) => s + f.price, 0);
  const repSum = CALC.repairs
    .filter((r) => reps.includes(r.id))
    .reduce((s, r) => s + r.price, 0);
  const labor = Math.round(meters * CALC.laborPerM + finSum + repSum);
  const material = Math.round(meters * mat.rate);
  const total = labor + material;

  const toggle = (arr: string[], id: string, set: (v: string[]) => void) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const summary =
    `Тип: ${type.name}; ширина ${width} мм; механизм: ${mech.name}; подушки: ${back}+${seat}; ` +
    `стяжка: ${tuft ? "да" : "нет"}; отделка: ${fins.map((i) => CALC.finishes.find((f) => f.id === i)!.name).join(", ") || "—"}; ` +
    `ремонт: ${reps.map((i) => CALC.repairs.find((r) => r.id === i)!.name).join(", ") || "—"}; материал: ${mat.name}; расход ≈ ${meters} м`;

  const send = async () => {
    if (hp.trim() !== "" || Date.now() - openedAt.current < 4000) {
      setSent(true);
      return;
    }
    try {
      await sendToTelegram({
        name,
        phone,
        comment: summary + `; итог ≈ ${total.toLocaleString("ru-RU")} ₽`,
        service: "Калькулятор: " + type.name,
      });
      if (photos.length) {
        await sendPhotosToTelegram(
          photos,
          `📎 Фото к расчёту: ${type.name}, ${phone}`,
        ).catch(() => {});
      }
      setSent(true);
    } catch {
      setSent(false);
    }
  };

  const chip = (on: boolean) => "calc-chip" + (on ? " on" : "");

  return (
    <div className="calc">
      <div className="calc-step">
        <h4>01 · Что перетягиваем</h4>
        <div className="calc-chips">
          {CALC.types.map((t) => (
            <button
              key={t.id}
              className={chip(typeId === t.id)}
              onClick={() => setTypeId(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {typeId !== "chair" && (
        <div className="calc-step">
          <h4>02 · Ширина: {width} мм</h4>
          <input
            className="calc-range"
            type="range"
            min={1200}
            max={3200}
            step={50}
            value={width}
            onChange={(e) => setWidth(+e.target.value)}
          />
        </div>
      )}

      <div className="calc-step">
        <h4>03 · Механизм</h4>
        <div className="calc-chips">
          {CALC.mechanisms.map((m) => (
            <button
              key={m.id}
              className={chip(mechId === m.id)}
              onClick={() => setMechId(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="calc-step">
        <h4>04 · Съёмные подушки</h4>
        <div className="calc-chips">
          <span className="calc-stepper">
            Спинки{" "}
            <button onClick={() => setBack(Math.max(0, back - 1))}>−</button>
            <b>{back}</b>
            <button onClick={() => setBack(back + 1)}>+</button>
          </span>
          <span className="calc-stepper">
            Сиденья{" "}
            <button onClick={() => setSeat(Math.max(0, seat - 1))}>−</button>
            <b>{seat}</b>
            <button onClick={() => setSeat(seat + 1)}>+</button>
          </span>
          <button className={chip(tuft)} onClick={() => setTuft(!tuft)}>
            Каретная стяжка ×1,5
          </button>
        </div>
      </div>

      <div className="calc-step">
        <h4>05 · Отделка и ремонт</h4>
        <div className="calc-chips">
          {CALC.finishes.map((f) => (
            <button
              key={f.id}
              className={chip(fins.includes(f.id))}
              onClick={() => toggle(fins, f.id, setFins)}
            >
              {f.name} +{f.price.toLocaleString("ru-RU")} ₽
            </button>
          ))}
          {CALC.repairs.map((r) => (
            <button
              key={r.id}
              className={chip(reps.includes(r.id))}
              onClick={() => toggle(reps, r.id, setReps)}
            >
              {r.name} +{r.price.toLocaleString("ru-RU")} ₽
            </button>
          ))}
        </div>
      </div>

      <div className="calc-step">
        <h4>06 · Материал</h4>
        <div className="calc-chips">
          {CALC.materials.map((m) => (
            <button
              key={m.id}
              className={chip(matId === m.id)}
              onClick={() => setMatId(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="calc-result">
        <small>
          Расход ≈ {meters} м · работа {labor.toLocaleString("ru-RU")} ₽ ·
          материал {material.toLocaleString("ru-RU")} ₽
        </small>
        <span className="total">от {total.toLocaleString("ru-RU")} ₽</span>
        <small>
          Предварительно по фабричным нормам. Точную цену зафиксируем после
          замера.
        </small>
      </div>

      <div className="calc-send">
        <input
          className="lm-input"
          placeholder="Ваше имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="lm-input"
          placeholder="Телефон"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
          className="btn btn-primary"
          onClick={send}
          disabled={!phone || sent}
        >
          {sent ? "Расчёт отправлен мастеру ✓" : "Отправить расчёт мастеру →"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// FAB: 4 контакта (VK, TG, MAX, телефон), БЕЗ чата
// ────────────────────────────────────────────────────────────

function ContactFab() {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) return;
    const t = setInterval(() => setI((v) => (v + 1) % 4), 3000);
    return () => clearInterval(t);
  }, [open]);

  const svg = (d: React.ReactNode, size = 22) => (
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

  const phonePath = (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  );
  const tgPath = <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />;

  const main = [
    { title: "Telegram", bg: "#0088CC", icon: svg(tgPath) },
    {
      title: "MAX",
      bg: "#7A5AF8",
      icon: <span style={{ fontWeight: 800, fontSize: 13 }}>MAX</span>,
    },
    {
      title: "ВКонтакте",
      bg: "#4A76A8",
      icon: <span style={{ fontWeight: 800, fontSize: 12 }}>VK</span>,
    },
    { title: "Позвонить", bg: "#FF6B00", icon: svg(phonePath) },
  ];
  const s = main[i];

  return (
    <div className={`cfab ${open ? "cfab-open" : ""}`}>
      <div className="cfab-menu">
        <a
          className="cfab-item"
          style={{ background: "#4A76A8" }}
          title="Мы во ВКонтакте"
          href="https://vk.ru/dnr_peretyajka_mebeli"
          target="_blank"
          rel="noreferrer"
        >
          <span style={{ fontWeight: 800, fontSize: 12 }}>VK</span>
        </a>
        <a
          className="cfab-item"
          style={{ background: "#0088CC" }}
          title="Telegram"
          href="https://t.me/dnr_peretyajka_mebeli"
          target="_blank"
          rel="noreferrer"
        >
          {svg(tgPath, 18)}
        </a>
        <a
          className="cfab-item"
          style={{ background: "#7A5AF8" }}
          title="MAX"
          href="https://max.ru/channel_peretyajka"
          target="_blank"
          rel="noreferrer"
        >
          <span style={{ fontWeight: 800, fontSize: 11 }}>MAX</span>
        </a>
        <a
          className="cfab-item"
          style={{ background: "#FF6B00" }}
          title="+7 949 098-35-32"
          href="tel:+79490983532"
        >
          {svg(phonePath, 18)}
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

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setNavOpen(false);
  };

  const SERVICES = [
    { name: "Перетяжка дивана", desc: "Прямые, угловые, модульные" },
    { name: "Перетяжка кресла", desc: "Вольтеровские, офисные, каминные" },
    { name: "Стулья и банкетки", desc: "Обеденные группы комплектом" },
    { name: "Изголовья и панели", desc: "Мягкие стеновые панели" },
    { name: "Каретная стяжка", desc: "Капитоне, пуговицы, кант" },
    { name: "Ремонт мебели", desc: "Каркас, механизм, пружины" },
  ];

  return (
    <>
      {/* ШАПКА */}
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
            className="btn btn-ghost"
            href="https://t.me/dnr_peretyajka_mebeli"
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

      {/* HERO */}
      <section className="hero">
        <img
          className="hero-img"
          src="/works/hero.jpg"
          alt="Мастер за работой"
        />
        <div className="hero-inner">
          <span className="hero-tag">Перетяжка мебели в ДНР</span>
          <h1>
            Ваш диван станет <span className="accent">лучше нового</span>
          </h1>
          <p>
            Собственное производство. Фиксированная цена в договоре. Гарантия на
            работы.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              onClick={() => setModal("Рассчитать стоимость")}
            >
              Рассчитать стоимость
            </button>
            <a className="btn btn-ghost" href="tel:+79490983532">
              +7 949 098-35-32
            </a>
          </div>
        </div>
      </section>

      {/* УСЛУГИ */}
      <section className="section" id="services">
        <h2 className="section-title">Что мы перетягиваем</h2>
        <div className="services-grid">
          {SERVICES.map((s) => (
            <div
              className="svc-card"
              key={s.name}
              onClick={() => setModal(s.name)}
            >
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <span className="svc-more">Узнать стоимость →</span>
            </div>
          ))}
        </div>
      </section>

      {/* ТКАНИ */}
      <section className="section" id="fabrics">
        <h2 className="section-title">Выберите идеальную ткань</h2>
        <p className="section-sub">
          10 типов материалов. Нажмите на круг — покажем все коллекции этого
          типа.
        </p>
        <div className="swatches">
          {CATALOG.map((f) => (
            <Link to={`/t/${f.id}`} className="swatch" key={f.id}>
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
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <a
            className="btn btn-primary"
            href="https://t.me/dnr_peretyajka_mebeli"
            target="_blank"
            rel="noreferrer"
          >
            Привезти образцы бесплатно
          </a>
        </div>
      </section>

      {/* ВИТРИНА КОЛЛЕКЦИЙ */}
      <section
        id="collections"
        className="section"
        style={{ background: "#fff" }}
      >
        <h2 className="section-title">Витрина коллекций</h2>
        <p className="section-sub">
          По одной представительной коллекции от каждого типа материала. Нажмите
          на кружок выше, чтобы открыть все коллекции типа.
        </p>
        <div className="showcase">
          {CATALOG.filter((t) => t.collections.length > 0).map((t) => {
            const c = t.collections[0];
            return (
              <Link className="show-card" key={t.id} to={`/t/${t.id}/${c.id}`}>
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

      {/* КАЛЬКУЛЯТОР */}
      <section id="calc" className="section" style={{ background: "#F7F6F3" }}>
        <h2 className="section-title">Рассчитайте стоимость за минуту</h2>
        <p className="section-sub">
          Честная формула: работа считается по расходу ткани, материал — по
          категории. Без скрытых «+» в конце.
        </p>
        <Calculator />
      </section>

      {/* ДО / ПОСЛЕ */}
      <section className="section" id="works">
        <h2 className="section-title">До и после</h2>
        <p className="section-sub">
          Потяните ползунок или просто наблюдайте — он дышит сам.
        </p>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <AutoBeforeAfter
            before="/works/before.jpg"
            after="/works/after.jpg"
            alt="Перетяжка дивана: до и после"
          />
        </div>
      </section>

      {/* ПРОЦЕСС */}
      <section id="process" className="section" style={{ background: "#fff" }}>
        <h2 className="section-title">Как мы работаем</h2>
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
            <div className="process-card" key={s.n}>
              <div className="process-num">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <h2 className="section-title">Частые вопросы</h2>
        <div className="faq-list">
          {[
            {
              q: "Сколько стоит перетяжка?",
              a: "Стул от 2 000 ₽, кресло от 9 000 ₽, диван от 11 000 ₽. Точную цену назовём по фото или замере.",
            },
            {
              q: "Можно ли своей тканью?",
              a: "Да, тогда платите только за работу. Образцы можно привезти свои или выбрать из наших.",
            },
            {
              q: "Сколько времени занимает?",
              a: "Обычно 7–14 дней. С каретной стяжкой и нестандартной геометрией — дольше.",
            },
            {
              q: "Даёте гарантию?",
              a: "Да, гарантия на работы прописывается в договоре.",
            },
            {
              q: "Забираете и привозите мебель?",
              a: "Да, организуем вывоз на производство и доставку обратно.",
            },
          ].map((f, i) => (
            <details className="faq-item" key={i}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section className="section contacts" id="contacts">
        <h2 className="section-title" style={{ color: "#fff" }}>
          Связаться с нами
        </h2>
        <div className="contacts-grid">
          <div>
            <div className="contacts-label">Телефон</div>
            <a href="tel:+79490983532" className="contacts-value">
              +7 949 098-35-32
            </a>
          </div>
          <div>
            <div className="contacts-label">Telegram</div>
            <a
              href="https://t.me/dnr_peretyajka_mebeli"
              target="_blank"
              rel="noreferrer"
              className="contacts-value"
            >
              @dnr_peretyajka_mebeli
            </a>
          </div>
          <div>
            <div className="contacts-label">Соцсети</div>
            <a
              href="https://vk.ru/dnr_peretyajka_mebeli"
              target="_blank"
              rel="noreferrer"
              className="contacts-value"
            >
              ВКонтакте
            </a>
          </div>
        </div>
      </section>

      {/* ФУТЕР */}
      <footer className="footer">
        © {new Date().getFullYear()} SOFONIYA · Перетяжка мебели в ДНР
      </footer>

      {/* FAB */}
      <ContactFab />

      {/* МОДАЛКА */}
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
            href="https://t.me/dnr_peretyajka_mebeli"
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
            href="https://t.me/dnr_peretyajka_mebeli"
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
// ────────────────────────────────────────────────────────────

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
