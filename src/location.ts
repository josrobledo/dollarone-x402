export type ResolvedLocation = {
  input: string;
  normalizedInput: string;
  country: "Mexico";
  state: string | null;
  stateCode: string | null;
  municipality: string | null;
  locality: string | null;
  postalCode: string | null;
  coordinates: { lat: number; lng: number } | null;
  confidence: number;
  matchedBy: string[];
  warnings: string[];
  sources: Array<{ name: string; license?: string; url: string }>;
};

type StateDef = {
  code: string;
  name: string;
  aliases: string[];
};

const STATES: StateDef[] = [
  { code: "01", name: "Aguascalientes", aliases: ["AGS", "AGUASCALIENTES"] },
  { code: "02", name: "Baja California", aliases: ["BC", "BAJA CALIFORNIA"] },
  { code: "03", name: "Baja California Sur", aliases: ["BCS", "BAJA CALIFORNIA SUR"] },
  { code: "04", name: "Campeche", aliases: ["CAMP", "CAMPECHE"] },
  { code: "05", name: "Coahuila", aliases: ["COAH", "COAHUILA", "COAHUILA DE ZARAGOZA"] },
  { code: "06", name: "Colima", aliases: ["COL", "COLIMA"] },
  { code: "07", name: "Chiapas", aliases: ["CHIS", "CHIAPAS"] },
  { code: "08", name: "Chihuahua", aliases: ["CHIH", "CHIHUAHUA"] },
  { code: "09", name: "Ciudad de Mexico", aliases: ["CDMX", "CIUDAD DE MEXICO", "DISTRITO FEDERAL", "DF"] },
  { code: "10", name: "Durango", aliases: ["DGO", "DURANGO"] },
  { code: "11", name: "Guanajuato", aliases: ["GTO", "GUANAJUATO"] },
  { code: "12", name: "Guerrero", aliases: ["GRO", "GUERRERO"] },
  { code: "13", name: "Hidalgo", aliases: ["HGO", "HIDALGO"] },
  { code: "14", name: "Jalisco", aliases: ["JAL", "JALISCO"] },
  { code: "15", name: "Mexico", aliases: ["EDOMEX", "ESTADO DE MEXICO", "MEXICO"] },
  { code: "16", name: "Michoacan", aliases: ["MICH", "MICHOACAN", "MICHOACAN DE OCAMPO"] },
  { code: "17", name: "Morelos", aliases: ["MOR", "MORELOS"] },
  { code: "18", name: "Nayarit", aliases: ["NAY", "NAYARIT"] },
  { code: "19", name: "Nuevo Leon", aliases: ["NL", "NUEVO LEON"] },
  { code: "20", name: "Oaxaca", aliases: ["OAX", "OAXACA"] },
  { code: "21", name: "Puebla", aliases: ["PUE", "PUEBLA"] },
  { code: "22", name: "Queretaro", aliases: ["QRO", "QUERETARO"] },
  { code: "23", name: "Quintana Roo", aliases: ["QROO", "QR", "QUINTANA ROO"] },
  { code: "24", name: "San Luis Potosi", aliases: ["SLP", "SAN LUIS POTOSI"] },
  { code: "25", name: "Sinaloa", aliases: ["SIN", "SINALOA"] },
  { code: "26", name: "Sonora", aliases: ["SON", "SONORA"] },
  { code: "27", name: "Tabasco", aliases: ["TAB", "TABASCO"] },
  { code: "28", name: "Tamaulipas", aliases: ["TAMPS", "TAMAULIPAS"] },
  { code: "29", name: "Tlaxcala", aliases: ["TLAX", "TLAXCALA"] },
  { code: "30", name: "Veracruz", aliases: ["VER", "VERACRUZ", "VERACRUZ DE IGNACIO DE LA LLAVE"] },
  { code: "31", name: "Yucatan", aliases: ["YUC", "YUCATAN"] },
  { code: "32", name: "Zacatecas", aliases: ["ZAC", "ZACATECAS"] }
];

// Temporary seed for the first x402 MVP. Nationwide municipality/locality
// enrichment will be loaded from open government catalogs in the next iteration.
const MUNICIPALITY_SEEDS = [
  { state: "Durango", municipality: "Vicente Guerrero", aliases: ["VICENTE GUERRERO", "VG", "VICENTE G"] },
  { state: "Durango", municipality: "Durango", aliases: ["DURANGO", "VICTORIA DE DURANGO"] },
  { state: "Durango", municipality: "Guadalupe Victoria", aliases: ["GUADALUPE VICTORIA", "GUVI"] },
  { state: "Durango", municipality: "Lerdo", aliases: ["LERDO"] },
  { state: "Durango", municipality: "Gomez Palacio", aliases: ["GOMEZ PALACIO"] }
];

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findState(normalized: string): StateDef | null {
  const ordered = [...STATES].sort(
    (a, b) => Math.max(...b.aliases.map(x => x.length)) - Math.max(...a.aliases.map(x => x.length)),
  );

  for (const state of ordered) {
    const aliases = [...state.aliases].sort((a, b) => b.length - a.length);
    if (aliases.some(alias => normalized.includes(normalizeText(alias)))) return state;
  }
  return null;
}

function findMunicipality(normalized: string, state: StateDef | null): string | null {
  const candidates = state
    ? MUNICIPALITY_SEEDS.filter(x => normalizeText(x.state) === normalizeText(state.name))
    : MUNICIPALITY_SEEDS;

  for (const candidate of candidates) {
    if (candidate.aliases.some(alias => normalized.includes(normalizeText(alias)))) {
      return candidate.municipality;
    }
  }
  return null;
}

export function resolveLocation(input: string): ResolvedLocation {
  const normalizedInput = normalizeText(input);
  const postalCode = normalizedInput.match(/\b\d{5}\b/)?.[0] ?? null;
  const state = findState(normalizedInput);
  const municipality = findMunicipality(normalizedInput, state);

  const matchedBy: string[] = [];
  let score = 0.2;

  if (state) {
    matchedBy.push("state_alias");
    score += 0.35;
  }
  if (municipality) {
    matchedBy.push("municipality_alias");
    score += 0.35;
  }
  if (postalCode) {
    matchedBy.push("postal_code_pattern");
    score += 0.1;
  }

  const warnings: string[] = [];
  if (!state) warnings.push("State could not be resolved from the current catalog.");
  if (!municipality) warnings.push("Municipality enrichment is still limited in this MVP.");
  if (postalCode) warnings.push("Postal code was detected syntactically but has not yet been cross-validated.");

  return {
    input,
    normalizedInput,
    country: "Mexico",
    state: state?.name ?? null,
    stateCode: state?.code ?? null,
    municipality,
    locality: municipality,
    postalCode,
    coordinates: null,
    confidence: Math.min(Number(score.toFixed(2)), 0.99),
    matchedBy,
    warnings,
    sources: [
      {
        name: "Mexico Open Data Portal — municipality catalog",
        license: "CC BY 4.0",
        url: "https://www.datos.gob.mx/dataset/catalogo_municipios"
      }
    ]
  };
}
