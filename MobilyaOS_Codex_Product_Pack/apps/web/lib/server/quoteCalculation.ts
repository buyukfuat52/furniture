import { createHash } from "node:crypto";
import type { QuoteConfigurationDraftRecord, QuoteRevisionRecord } from "./supabaseRepository";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type MeasurementInput = {
  unit: "mm";
  width_mm: number;
  height_mm: number;
  depth_mm: number;
};

export type ConfigurationDraftInput = {
  input_schema_version: "quote_configuration_draft_v1";
  template_code: "wardrobe";
  measurements: MeasurementInput;
  quantity: {
    unit: "piece";
    value: number;
  };
  options: {
    door_count: number;
    shelf_count: number;
    material_sku: string;
    edge_band_sku: string;
    notes: string | null;
  };
};

export type MaterialSpec = {
  sku: string;
  unit: "m2" | "m" | "piece";
  price_minor: number;
  currency: string;
  source: "demo_deterministic_default";
  source_ref: string;
};

export type PartSpec = {
  code: string;
  name: string;
  material_sku: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  area_mm2: number;
};

export type EdgeBandingSpec = {
  part_code: string;
  edge: "north" | "east" | "south" | "west";
  visibility: "front-visible" | "side-visible" | "interior-visible" | "hidden";
  band_sku: string;
  process: "straight";
  length_mm: number;
  part_quantity: number;
  base_length_mm: number;
  waste_bps: number;
  setup_mm: number;
  billable_mm: number;
};

export type LaborLine = {
  code: string;
  name: string;
  labor_type: "unit" | "setup";
  unit_labor_minor: number;
  quantity: number;
  total_minor: number;
  currency: string;
};

export type CostCategory = {
  category: "panel_material" | "edge_banding" | "hardware" | "unit_labor" | "setup_labor";
  amount_minor: number;
  currency: string;
};

export type QuoteTotalSnapshot = {
  pricing_method: "markup";
  markup_bps: number;
  vat_bps: number;
  subtotal_minor: number;
  markup_minor: number;
  vat_minor: number;
  grand_total_minor: number;
  currency: string;
};

export type CalculationProvenance = {
  calculation_version: string;
  source: "deterministic_service";
  input_schema_version: "quote_configuration_draft_v1";
  configuration_draft_id: string;
  configuration_version: number;
  quote_revision_id: string;
  bom_snapshot_hash: string;
  price_sources: MaterialSpec[];
  limitations: string[];
};

export type BOMSnapshot = {
  formula_version: string;
  parts: PartSpec[];
  edges: EdgeBandingSpec[];
  part_count: number;
  edge_count: number;
  snapshot_hash: string;
};

export type CostSnapshot = {
  formula_version: string;
  currency: string;
  subtotal_minor: number;
  markup_minor: number;
  vat_minor: number;
  grand_total_minor: number;
  categories: CostCategory[];
  labor: LaborLine[];
  quote_total: QuoteTotalSnapshot;
  provenance: CalculationProvenance;
  snapshot_hash: string;
};

export type QuoteCalculationResult = {
  calculation_status: "calculated";
  quote_revision: QuoteRevisionRecord;
  configuration_draft: QuoteConfigurationDraftRecord;
  bom_snapshot: BOMSnapshot;
  cost_snapshot: CostSnapshot;
  deferred_actions: string[];
};

const calculationVersion = "wardrobe-deterministic-v1.0.0";
const currency = "TRY";
const edgeWasteBps = 500;
const markupBps = 2500;
const vatBps = 2000;

const priceDefaults = {
  panelM2Minor: 45_000,
  edgeMeterMinor: 1_250,
  hingePieceMinor: 5_500,
  unitLaborMinor: 57_000,
  setupLaborMinor: 20_000
};

const deferredActions = ["quote_send", "quote_approve", "quote_pdf", "production_package"];

function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
  return `{${entries.join(",")}}`;
}

function sha256(value: JsonValue): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function assertInteger(value: number, label: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} is outside the supported deterministic wardrobe slice.`);
  }
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

function toSafeMinor(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the safe integer range.`);
  }
  return Number(value);
}

function areaCostMinor(areaMm2: number, pricePerM2Minor: number): number {
  return toSafeMinor(ceilDiv(BigInt(areaMm2) * BigInt(pricePerM2Minor), 1_000_000n), "panel material cost");
}

function lengthCostMinor(lengthMm: number, pricePerMeterMinor: number): number {
  return toSafeMinor(ceilDiv(BigInt(lengthMm) * BigInt(pricePerMeterMinor), 1_000n), "edge banding cost");
}

function bpsAmount(baseMinor: number, bps: number, label: string): number {
  return toSafeMinor(ceilDiv(BigInt(baseMinor) * BigInt(bps), 10_000n), label);
}

function part(code: string, name: string, materialSku: string, widthMm: number, heightMm: number, quantity: number): PartSpec {
  const area = BigInt(widthMm) * BigInt(heightMm) * BigInt(quantity);
  return {
    code,
    name,
    material_sku: materialSku,
    width_mm: widthMm,
    height_mm: heightMm,
    quantity,
    area_mm2: toSafeMinor(area, `${code} area`)
  };
}

function edge(input: {
  partCode: string;
  edge: EdgeBandingSpec["edge"];
  visibility: EdgeBandingSpec["visibility"];
  bandSku: string;
  lengthMm: number;
  partQuantity: number;
}): EdgeBandingSpec {
  const baseLength = input.lengthMm * input.partQuantity;
  const billable = toSafeMinor(ceilDiv(BigInt(baseLength) * BigInt(10_000 + edgeWasteBps), 10_000n), "edge billable length");
  return {
    part_code: input.partCode,
    edge: input.edge,
    visibility: input.visibility,
    band_sku: input.bandSku,
    process: "straight",
    length_mm: input.lengthMm,
    part_quantity: input.partQuantity,
    base_length_mm: baseLength,
    waste_bps: edgeWasteBps,
    setup_mm: 0,
    billable_mm: billable
  };
}

function distributeDoorWidths(widthMm: number, doorCount: number): number[] {
  const base = Math.floor(widthMm / doorCount);
  const remainder = widthMm % doorCount;
  return Array.from({ length: doorCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function supportedConfiguration(draft: QuoteConfigurationDraftRecord): ConfigurationDraftInput {
  const config = draft.configuration;
  if (config.template_code !== "wardrobe") {
    throw new Error("Only wardrobe configuration drafts are supported by this deterministic slice.");
  }
  assertInteger(config.width_mm, "width_mm", 600, 4000);
  assertInteger(config.height_mm, "height_mm", 1200, 3000);
  assertInteger(config.depth_mm, "depth_mm", 250, 800);
  assertInteger(config.quantity, "quantity", 1, 20);
  assertInteger(config.door_count, "door_count", 1, 12);
  assertInteger(config.shelf_count, "shelf_count", 0, 30);
  if (!config.material_sku || !config.edge_band_sku) {
    throw new Error("Material and edge-band SKUs are required for deterministic calculation.");
  }
  return {
    input_schema_version: "quote_configuration_draft_v1",
    template_code: "wardrobe",
    measurements: {
      unit: "mm",
      width_mm: config.width_mm,
      height_mm: config.height_mm,
      depth_mm: config.depth_mm
    },
    quantity: {
      unit: "piece",
      value: config.quantity
    },
    options: {
      door_count: config.door_count,
      shelf_count: config.shelf_count,
      material_sku: config.material_sku,
      edge_band_sku: config.edge_band_sku,
      notes: config.notes
    }
  };
}

export function calculateWardrobeQuoteSnapshot(input: {
  quoteRevision: QuoteRevisionRecord;
  configurationDraft: QuoteConfigurationDraftRecord;
}): QuoteCalculationResult {
  const config = supportedConfiguration(input.configurationDraft);
  const width = config.measurements.width_mm;
  const height = config.measurements.height_mm;
  const depth = config.measurements.depth_mm;
  const productQuantity = config.quantity.value;
  const materialSku = config.options.material_sku;
  const edgeBandSku = config.options.edge_band_sku;
  const doorWidths = distributeDoorWidths(width, config.options.door_count);
  const shelfWidth = Math.max(100, width - 36);

  const parts: PartSpec[] = [
    part("SIDE", "Yan panel", materialSku, depth, height, 2 * productQuantity),
    part("TOP_BOTTOM", "Ust/alt panel", materialSku, width, depth, 2 * productQuantity),
    part("BACK", "Arka panel", materialSku, width, height, productQuantity),
    part("SHELF", "Raf", materialSku, shelfWidth, depth, config.options.shelf_count * productQuantity)
  ].filter((item) => item.quantity > 0);

  const doorGroups = new Map<number, number>();
  for (const doorWidth of doorWidths) {
    doorGroups.set(doorWidth, (doorGroups.get(doorWidth) ?? 0) + productQuantity);
  }
  for (const [doorWidth, quantity] of [...doorGroups.entries()].sort(([left], [right]) => left - right)) {
    parts.push(part(`DOOR_${doorWidth}`, `Kapak ${doorWidth} mm`, materialSku, doorWidth, height, quantity));
  }

  const edges: EdgeBandingSpec[] = [];
  for (const item of parts) {
    if (item.code === "SIDE") {
      edges.push(edge({ partCode: item.code, edge: "east", visibility: "front-visible", bandSku: edgeBandSku, lengthMm: item.height_mm, partQuantity: item.quantity }));
    } else if (item.code === "TOP_BOTTOM" || item.code === "SHELF") {
      edges.push(edge({ partCode: item.code, edge: "south", visibility: "front-visible", bandSku: edgeBandSku, lengthMm: item.width_mm, partQuantity: item.quantity }));
    } else if (item.code.startsWith("DOOR_")) {
      edges.push(
        edge({ partCode: item.code, edge: "north", visibility: "front-visible", bandSku: edgeBandSku, lengthMm: item.width_mm, partQuantity: item.quantity }),
        edge({ partCode: item.code, edge: "east", visibility: "front-visible", bandSku: edgeBandSku, lengthMm: item.height_mm, partQuantity: item.quantity }),
        edge({ partCode: item.code, edge: "south", visibility: "front-visible", bandSku: edgeBandSku, lengthMm: item.width_mm, partQuantity: item.quantity }),
        edge({ partCode: item.code, edge: "west", visibility: "front-visible", bandSku: edgeBandSku, lengthMm: item.height_mm, partQuantity: item.quantity })
      );
    }
  }

  const totalAreaMm2 = parts.reduce((sum, item) => sum + item.area_mm2, 0);
  const billableEdgeMm = edges.reduce((sum, item) => sum + item.billable_mm, 0);
  const panelMaterialMinor = areaCostMinor(totalAreaMm2, priceDefaults.panelM2Minor);
  const edgeBandingMinor = lengthCostMinor(billableEdgeMm + 1_000, priceDefaults.edgeMeterMinor);
  const hardwareMinor = config.options.door_count * 2 * productQuantity * priceDefaults.hingePieceMinor;
  const unitLaborMinor = priceDefaults.unitLaborMinor * productQuantity;
  const setupLaborMinor = priceDefaults.setupLaborMinor;

  const labor: LaborLine[] = [
    {
      code: "WARDROBE_ASSEMBLY",
      name: "Vestiyer montaj isciligi",
      labor_type: "unit",
      unit_labor_minor: priceDefaults.unitLaborMinor,
      quantity: productQuantity,
      total_minor: unitLaborMinor,
      currency
    },
    {
      code: "WARDROBE_SETUP",
      name: "Kesim ve makine hazirlik isciligi",
      labor_type: "setup",
      unit_labor_minor: priceDefaults.setupLaborMinor,
      quantity: 1,
      total_minor: setupLaborMinor,
      currency
    }
  ];

  const categories: CostCategory[] = [
    { category: "panel_material", amount_minor: panelMaterialMinor, currency },
    { category: "edge_banding", amount_minor: edgeBandingMinor, currency },
    { category: "hardware", amount_minor: hardwareMinor, currency },
    { category: "unit_labor", amount_minor: unitLaborMinor, currency },
    { category: "setup_labor", amount_minor: setupLaborMinor, currency }
  ];
  const subtotal = categories.reduce((sum, item) => sum + item.amount_minor, 0);
  const markup = bpsAmount(subtotal, markupBps, "markup");
  const vat = bpsAmount(subtotal + markup, vatBps, "vat");
  const grandTotal = subtotal + markup + vat;

  const priceSources: MaterialSpec[] = [
    { sku: materialSku, unit: "m2", price_minor: priceDefaults.panelM2Minor, currency, source: "demo_deterministic_default", source_ref: "wardrobe_panel_m2_default_v1" },
    { sku: edgeBandSku, unit: "m", price_minor: priceDefaults.edgeMeterMinor, currency, source: "demo_deterministic_default", source_ref: "wardrobe_edge_meter_default_v1" },
    { sku: "HINGE_SOFT_CLOSE", unit: "piece", price_minor: priceDefaults.hingePieceMinor, currency, source: "demo_deterministic_default", source_ref: "wardrobe_hinge_default_v1" },
    { sku: "WARDROBE_ASSEMBLY", unit: "piece", price_minor: priceDefaults.unitLaborMinor, currency, source: "demo_deterministic_default", source_ref: "wardrobe_unit_labor_default_v1" },
    { sku: "WARDROBE_SETUP", unit: "piece", price_minor: priceDefaults.setupLaborMinor, currency, source: "demo_deterministic_default", source_ref: "wardrobe_setup_labor_default_v1" }
  ];
  const bomHash = sha256({
    calculation_version: calculationVersion,
    configuration: config as unknown as JsonValue,
    parts: parts as unknown as JsonValue,
    edges: edges as unknown as JsonValue
  });
  const provenance: CalculationProvenance = {
    calculation_version: calculationVersion,
    source: "deterministic_service",
    input_schema_version: "quote_configuration_draft_v1",
    configuration_draft_id: input.configurationDraft.id,
    configuration_version: input.configurationDraft.version,
    quote_revision_id: input.quoteRevision.id,
    bom_snapshot_hash: bomHash,
    price_sources: priceSources,
    limitations: [
      "P6 demo slice prices use deterministic demo defaults unless future price-observation adapters replace them.",
      "No sheet nesting, PDF generation, send, approval, or production package is activated by this calculation."
    ]
  };
  const quoteTotal: QuoteTotalSnapshot = {
    pricing_method: "markup",
    markup_bps: markupBps,
    vat_bps: vatBps,
    subtotal_minor: subtotal,
    markup_minor: markup,
    vat_minor: vat,
    grand_total_minor: grandTotal,
    currency
  };
  const costHash = sha256({
    calculation_version: calculationVersion,
    bom_snapshot_hash: bomHash,
    categories: categories as unknown as JsonValue,
    labor: labor as unknown as JsonValue,
    quote_total: quoteTotal as unknown as JsonValue,
    provenance: provenance as unknown as JsonValue
  });

  return {
    calculation_status: "calculated",
    quote_revision: input.quoteRevision,
    configuration_draft: input.configurationDraft,
    bom_snapshot: {
      formula_version: calculationVersion,
      parts,
      edges,
      part_count: parts.length,
      edge_count: edges.length,
      snapshot_hash: bomHash
    },
    cost_snapshot: {
      formula_version: calculationVersion,
      currency,
      subtotal_minor: subtotal,
      markup_minor: markup,
      vat_minor: vat,
      grand_total_minor: grandTotal,
      categories,
      labor,
      quote_total: quoteTotal,
      provenance,
      snapshot_hash: costHash
    },
    deferred_actions: deferredActions
  };
}
