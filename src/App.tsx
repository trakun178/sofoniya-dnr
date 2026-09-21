import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

/* ============ SOFONIYA · лендинг v3 (наш проект) ============
   ФОТО: положи в /public файлы hero.jpg, before.jpg, after.jpg
   БИТРИКС24: вставь свой вебхук в BITRIX_WEBHOOK — заявки уйдут в CRM
============================================================= */

const BITRIX_WEBHOOK = '' // пример: 'https://xxx.bitrix24.ru/rest/1/xxxxx/'

const LINKS = {
  vk: 'https://vk.ru/dnr_peretyajka_mebeli',
  tg: 'https://t.me/dnr_peretyajka_mebeli',
  max: 'https://max.ru/channel_peretyajka',
  phone: '+7 949 098-35-32',
  phoneHref: 'tel:+79490983532',
}

const SERVICES = [
  { icon: 'sofa', title: 'Диван', text: 'Перетяжка диванов любых форм и размеров. Донецк, Макеевка.', price: 'от 25 000 ₽', badge: 'Популярно' },
  { icon: 'armchair', title: 'Кресло', text: 'Реставрация кресел — от классических до современных моделей.', price: 'от 15 000 ₽' },
  { icon: 'corner', title: 'Угловой диван', text: 'Перетяжка угловых диванов с заменой наполнителя. Горловка, весь регион.', price: 'от 45 000 ₽', badge: 'Выгодно' },
  { icon: 'kitchen', title: 'Кухонный уголок', text: 'Обновление кухонных уголков — влагостойкие ткани и экокожа.', price: 'от 15 000 ₽' },
  { icon: 'office', title: 'Офисная мебель', text: 'Реставрация офисных кресел и диванов. Корпоративные заказы.', price: 'от 9 000 ₽' },
  { icon: 'chair', title: 'Стулья', text: 'Обивка стульев любых конфигураций. Быстро и качественно.', price: 'от 3 000 ₽' },
]

const FABRICS = [
  { name: 'Велюр серый', cls: 'f-gray' },
  { name: 'Экокожа синяя', cls: 'f-navy' },
  { name: 'Букле оранжевое', cls: 'f-orange' },
  { name: 'Велюр красный', cls: 'f-red' },
  { name: 'Рогожка беж', cls: 'f-beige' },
  { name: 'Шенилл зелёный', cls: 'f-green' },
]

const STEPS = [
  { t: 'Заявка', d: 'Позвоните или оставьте заявку на сайте — предварительная цена за 15 минут.' },
  { t: 'Выезд мастера', d: 'Бесплатно приедем с образцами тканей, замерим и назовём точную цену.' },
  { t: 'Реставрация', d: 'Каркас, наполнитель и обивка в нашем цеху. Фотоотчёт на каждом этапе.' },
  { t: 'Доставка', d: 'Бесплатный вывоз и доставка — привезём, соберём и расставим.' },
]

/* ---------- Иконки (line-art: тёмно-синий контур + оранжевый акцент) ---------- */
const ICONS: Record<string, ReactNode> = {
  sofa: (<><path d="M14 32V20a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v12" /><path d="M14 32a5 5 0 0 0-5 5v7a4 4 0 0 0 4 4h38a4 4 0 0 0 4-4v-7a5 5 0 0 0-5-5" /><path d="M14 37h36M32 37v11M13 48v5M51 48v5" /><path className="acc" d="M50 32a5 5 0 0 1 5 5" /></>),
  armchair: (<><path d="M22 32V20a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v12" /><path d="M22 32a5 5 0 0 0-5 5v7a4 4 0 0 0 4 4h22a4 4 0 0 0 4-4v-7a5 5 0 0 0-5-5" /><path d="M22 37h20M21 48v5M43 48v5" /><path className="acc" d="M42 32a5 5 0 0 1 5 5" /></>),
  corner: (<><path d="M12 34V16a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v18" /><path d="M12 34a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h36a4 4 0 0 0 4-4v-6a4 4 0 0 0-4-4H34" /><path d="M34 34v18M12 52v4M52 52v4" /><path className="acc" d="M52 38v6" /></>),
  kitchen: (<><path d="M10 30V18a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v12" /><path d="M10 30a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h26" /><path d="M14 52v4M34 52v4" /><path className="acc" d="M34 30h16a4 4 0 0 1 4 4v14" /></>),
  office: (<><path d="M26 8h12v14H26z" /><path d="M20 20v8M44 20v8M32 28v12" /><path d="M32 40l-11 9M32 40l11 9M32 40v11" /><path className="acc" d="M22 26h20" /></>),
  chair: (<><path d="M26 8h12v16H26z" /><path d="M26 16h12M22 26l-2 26M42 26l2 26M23 40h18" /><path className="acc" d="M20 26h24" /></>),
  phone: (<path d="M14 10h10l4 12-7 5a30 30 0 0 0 16 16l5-7 12 4v10a4 4 0 0 1-4 4C28 54 10 36 10 14a4 4 0 0 1 4-4z" />),
  tg: (<><path d="M56 10L8 30l14 6 4 16 8-10 12 8z" /><path d="M22 36L56 10" /></>),
  chat: (<path d="M12 12h40v28H28L18 50V40h-6z" />),
  pin: (<><path d="M32 8c-9 0-16 7-16 16 0 12 16 32 16 32s16-20 16-32c0-9-7-16-16-16z" /><circle cx="32" cy="24" r="6" /></>),
  clock: (<><circle cx="32" cy="32" r="22" /><path d="M32 18v14l10 8" /></>),
  check: (<path d="M12 34l14 14 26-30" />),
  arrow: (<path d="M12 32h36M36 20l12 12-12 12" />),
}

function Icon({ name, size = 64 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

function LogoMark() {
  return (
    <svg width="42" height="42" viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#8D99AE" d="M30 12H18a6 6 0 0 0-6 6v12a6 6 0 0 0-6 6v10a6 6 0 0 0 6 6h18z" />
      <path fill="#E63946" d="M34 12h12a6 6 0 0 1 6 6v12a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H34z" />
    </svg>
  )
}

/* ---------- Плавающая кнопка связи (FAB) ---------- */
function Fab({ onChat }: { onChat: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`fab ${open ? 'open' : ''}`}>
      <div className="fab-menu">
        <button className="fab-item" onClick={() => { setOpen(false); onChat() }}>
          <span className="ico" style={{ background: '#27AE60' }}><Icon name="chat" size={18} /></span> Чат на сайте
        </button>
        <a className="fab-item" href={LINKS.vk} target="_blank" rel="noreferrer">
          <span className="ico" style={{ background: '#4A76A8' }}><b style={{ fontSize: 11 }}>VK</b></span> Мы во ВКонтакте
        </a>
        <a className="fab-item" href={LINKS.tg} target="_blank" rel="noreferrer">
          <span className="ico" style={{ background: '#0088CC' }}><Icon name="tg" size={18} /></span> Telegram
        </a>
        <a className="fab-item" href={LINKS.phoneHref}>
          <span className="ico" style={{ background: '#FF6B00' }}><Icon name="phone" size={18} /></span> {LINKS.phone}
        </a>
      </div>
      <button className="fab-btn" style={{ background: '#FF6B00' }}
        onClick={() => setOpen(o => !o)} aria-label="Связаться с нами">
        {open ? <span className="fab-txt" style={{ fontSize: 18 }}>✕</span> : <Icon name="phone" size={26} />}
      </button>
    </div>
  )
}

/* ---------- Модальная форма заявки (заглушка Битрикс24) ---------- */
function LeadModal({ service, onClose }: { service: string; onClose: () => void }) {
  const [sent, setSent] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (BITRIX_WEBHOOK) {
      const q = new URLSearchParams({
        'fields[TITLE]': `Заявка с сайта: ${service}`,
        'fields[NAME]': String(f.get('name') || ''),
        'fields[PHONE][0][VALUE]': String(f.get('phone') || ''),
        'fields[COMMENTS]': `${service}. ${f.get('msg') || ''}`,
      })
      await fetch(`${BITRIX_WEBHOOK}crm.lead.add?${q}`).catch(() => {})
    }
    setSent(true)
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>✕</button>
        {sent ? (
          <div className="modal-ok">
            <Icon name="check" size={48} />
            <h3>Заявка отправлена!</h3>
            <p>Мастер свяжется с вами в течение 15 минут в рабочее время.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>{service}</h3>
            <input name="name" placeholder="Ваше имя" required />
            <input name="phone" type="tel" placeholder="Телефон" required />
            <textarea name="msg" placeholder="Опишите мебель (необязательно)" rows={3} />
            <button className="btn btn-primary" type="submit">Отправить заявку <Icon name="arrow" size={18} /></button>
            <small>Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности</small>
          </form>
        )}
      </div>
    </div>
  )
}

/* ---------- Слайдер До / После ---------- */
function BeforeAfter() {
  const [pos, setPos] = useState(50)
  return (
    <div className="ba">
      <div className="ba-img ba-after" />
      <div className="ba-img ba-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="ba-handle" style={{ left: `${pos}%` }} />
      <span className="ba-label left">До</span>
      <span className="ba-label right">После</span>
      <input type="range" min={0} max={100} value={pos} aria-label="Сравнение до и после"
        onChange={e => setPos(+e.target.value)} />
    </div>
  )
}

export default function App() {
  const [modal, setModal] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

  return (
    <div id="top">
      {/* ШАПКА */}
      <header className="header">
        <a className="logo" href="#top">
          <LogoMark />
          <span>SOFONIYA<small>реставрация мебели</small></span>
        </a>
        <nav className={`nav ${menu ? 'show' : ''}`} onClick={() => setMenu(false)}>
          <a href="#services">Услуги</a>
          <a href="#works">Работы</a>
          <a href="#fabrics">Ткани</a>
          <a href="#process">О нас</a>
          <a href="#contacts">Контакты</a>
        </nav>
        <div className="header-cta">
          <a className="btn btn-outline" href={LINKS.tg} target="_blank" rel="noreferrer"><Icon name="tg" size={18} /> Telegram</a>
          <a className="btn btn-outline" href={LINKS.max} target="_blank" rel="noreferrer"><span className="max-badge">MAX</span> MAX</a>
          <button className="burger" onClick={() => setMenu(m => !m)} aria-label="Меню">☰</button>
        </div>
      </header>

      {/* ПЕРВЫЙ ЭКРАН */}
      <section className="hero">
        <div className="hero-left">
          <span className="geo-pill">● ДНР · ДОНЕЦК · МАКЕЕВКА</span>
          <h1>Профессиональная <em>перетяжка мебели</em> в ДНР с бесплатным выездом</h1>
          <p>Подарите любимому дивану вторую жизнь за <b>7 дней</b>. Цена без накруток — только материал и работа.</p>
          <div className="hero-badges">
            <span><Icon name="check" size={16} /> Гарантия 2 года</span>
            <span><Icon name="check" size={16} /> Бесплатный замер</span>
            <span><Icon name="check" size={16} /> Вывоз и доставка 0 ₽</span>
          </div>
          <div className="hero-btns">
            <button className="btn btn-primary" onClick={() => setModal('Расчёт стоимости')}>Рассчитать стоимость <Icon name="arrow" size={18} /></button>
            <a className="btn btn-ghost" href="#works">Наши работы</a>
          </div>
        </div>
        <div className="hero-photo" style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1631396326646-c06a935ff3a6?w=900&h=900&fit=crop&auto=format')",
        }} />
      </section>

      {/* УСЛУГИ */}
      <section className="section" id="services">
        <h2>Что мы перетягиваем</h2>
        <div className="grid-services">
          {SERVICES.map(s => (
            <div className="card" key={s.title}>
              {s.badge && <span className="card-badge">{s.badge}</span>}
              <Icon name={s.icon} size={64} />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <div className="card-row">
                <b>{s.price}</b>
                <button className="link" onClick={() => setModal(`Расчёт: ${s.title}`)}>Рассчитать <Icon name="arrow" size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ДО / ПОСЛЕ */}
      <section className="section" id="works">
        <h2>Выполненные работы: до и после</h2>
        <BeforeAfter />
        <p className="ba-caption">Заменили поролон, усилили каркас, обили антивандальным велюром. Срок: 4 дня. Донецк.</p>
      </section>

      {/* ТКАНИ */}
      <section className="section" id="fabrics">
        <h2>Выберите идеальную ткань</h2>
        <div className="grid-fabrics">
          {FABRICS.map(f => (
            <div className="swatch" key={f.name}>
              <span className={`sw ${f.cls}`} />
              <small>{f.name}</small>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setModal('Привезти образцы тканей')}>Привезти образцы бесплатно</button>
      </section>

      {/* ЭТАПЫ */}
      <section className="section" id="process">
        <h2>Как мы работаем</h2>
        <div className="steps">
          {STEPS.map((s, n) => (
            <div className="step" key={s.t}>
              <span className="step-num">{n + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GEO-SEO БЛОК */}
      <section className="section seo">
        <h2>Перетяжка мебели в ДНР и Донецкой области</h2>
        <p>Мастерская SOFONIYA выполняет перетяжку и ремонт мягкой мебели по всей Республике: <b>Донецк, Макеевка, Горловка, Енакиево, Харцызск, Торез, Шахтёрск, Мариуполь</b> и другие населённые пункты Донецкой области. Бесплатный выезд замерщика с образцами тканей, бесплатный вывоз и доставка мебели, договор и гарантия 2 года.</p>
      </section>

      {/* ПОДВАЛ (без формы, с картой) */}
      <footer className="footer" id="contacts">
        <div className="footer-grid">
          <div>
            <div className="logo light"><LogoMark /><span>SOFONIYA</span></div>
            <p>Профессиональная перетяжка и реставрация мебели в ДНР. Работаем по всему Донецкому региону.</p>
            <div className="socials">
              <a href={LINKS.vk} target="_blank" rel="noreferrer" aria-label="VK">VK</a>
              <a href={LINKS.tg} target="_blank" rel="noreferrer" aria-label="Telegram"><Icon name="tg" size={16} /></a>
              <a href={LINKS.max} target="_blank" rel="noreferrer" aria-label="MAX">MAX</a>
            </div>
          </div>
          <div>
            <h4>Контакты</h4>
            <p><Icon name="phone" size={18} /> <a href={LINKS.phoneHref}>{LINKS.phone}</a></p>
            <p><Icon name="pin" size={18} /> Донецк, ул. Артёма, 123</p>
            <p><Icon name="clock" size={18} /> Пн–Сб: 9:00–19:00</p>
          </div>
          <div>
            <h4>Мы на карте</h4>
            {/* Вставь сюда iframe виджета Яндекс.Карт / 2GIS */}
            <div className="map">
              <Icon name="pin" size={32} />
              <small>Встроенная карта (Яндекс.Карты / 2GIS)</small>
              <a href="https://yandex.ru/maps/?text=Донецк%20улица%20Артёма%20123" target="_blank" rel="noreferrer">Открыть маршрут →</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} SOFONIYA. Все права защищены. Работаем в ДНР.</span>
          <span><a href="#">Политика конфиденциальности</a> · <a href="#">Оферта</a></span>
        </div>
      </footer>

      <Fab onChat={() => setModal('Чат с сайта')} />
      {modal && <LeadModal service={modal} onClose={() => setModal(null)} />}
    </div>
  )
}