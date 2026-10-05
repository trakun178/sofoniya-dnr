export type Shade = { name: string; hex: string; photo?: string };
export type Collection = {
  id: string;
  name: string;
  kind: string;
  thick?: string;
  shades: Shade[];
};
export type FabricType = {
  id: string;
  name: string;
  cls: string;
  collections: Collection[];
};

const C = (
  id: string,
  name: string,
  kind: string,
  thick?: string,
): Collection => ({ id, name, kind, thick, shades: [] });

export const CATALOG: FabricType[] = [
  {
    id: "velour",
    name: "Велюр",
    cls: "f-gray",
    collections: [C("loft", "Loft", "Велюр")],
  },
  { id: "flock", name: "Флок", cls: "f-red", collections: [] },
  {
    id: "chenille",
    name: "Шенилл",
    cls: "f-green",
    collections: [C("lotos", "Lotos", "Шенилл")],
  },
  { id: "rogozhka", name: "Рогожка", cls: "f-beige", collections: [] },
  { id: "boucle", name: "Букле", cls: "f-orange", collections: [] },
  { id: "jacquard", name: "Жаккард", cls: "f-jacquard", collections: [] },
  { id: "corduroy", name: "Вельвет", cls: "f-cord", collections: [] },
  {
    id: "suede",
    name: "Искусственный замш",
    cls: "f-suede",
    collections: [C("gucci", "Gucci", "Иск. замша")],
  },
  {
    id: "eco-leather",
    name: "Экокожа (иск. кожа)",
    cls: "f-navy",
    collections: [
      C("madras-eco", "Madras", "Искусственная", "0,85 мм"),
      C("ravenna-eco", "Ravenna", "Искусственная", "0,85 мм"),
      C("grifon", "Grifon", "Искусственная"),
      C("nitro", "Nitro", "Полиуретан (PU)"),
      C("phantom", "Phantom", "Полиэстер (PL)"),
      C("uruguay-eco", "Uruguay Eco", "Экокожа"),
    ],
  },
  {
    id: "natural-leather",
    name: "Натуральная кожа",
    cls: "f-leather",
    collections: [
      C("madras", "Madras", "Пигментированная", "0,9–1,1 мм"),
      C("ravenna", "Ravenna", "Пигментированная", "1,2–1,4 мм"),
      C("simphony", "Simphony", "Полуанилиновая", "1.3–1,5 мм"),
      C("lusso", "Lusso", "Полуанилиновая", "0,9–1,1 мм"),
      C("estoril", "Estoril", "Полуанилиновая", "1,2–1,4 мм"),
      C("royalton", "Royalton", "Полуанилиновая", "1,3–1,5 мм"),
      C("corinne", "Corinne", "Полуанилиновая", "0,9–1,1 мм"),
      C("misty", "Misty", "Полуанилиновая", "1,1–1,3 мм"),
      C("scottsdale", "Scottsdale", "Анилиновая", "0,9–1,1 мм"),
      C("dollaro", "Dollaro", "Натуральная кожа"),
      C("uruguay", "Uruguay", "Натуральная кожа"),
    ],
  },
];
