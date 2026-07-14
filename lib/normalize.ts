import { House } from "./types";

function formatLotSize(raw: any): string | null {
  const lotSize = raw.lotAreaValue ?? raw.lotSize;
  const lotUnits = raw.lotAreaUnits;
  if (lotSize == null) return null;
  if (lotUnits === "Acres") {
    return `${Number(lotSize).toFixed(2)} acres`;
  }
  if (lotUnits === "Square Feet") {
    const acres = Number(lotSize) / 43560;
    if (acres >= 0.1) return `${acres.toFixed(2)} acres`;
    return `${Number(lotSize).toLocaleString()} sqft`;
  }
  return String(lotSize);
}

function joinArray(val: any): string | null {
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "string") return val;
  return null;
}

export function normalize(raw: any): House {
  const lat: number | null = raw.latitude ?? raw.lat ?? null;
  const lng: number | null = raw.longitude ?? raw.lng ?? null;

  // Primary: Google Street View Static API, fallback: Zillow CDN
  let photo: string | null = null;
  if (lat != null && lng != null) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      photo = `https://maps.googleapis.com/maps/api/streetview?size=800x450&location=${lat},${lng}&key=${apiKey}&source=outdoor`;
    }
  }
  if (!photo) {
    photo = raw.hiResImageLink ?? raw.desktopWebHdpImageLink ?? null;
  }

  return {
    address: raw.address?.streetAddress ?? raw.abbreviatedAddress ?? "—",
    price: raw.price ?? null,
    status: raw.homeStatus ?? null,
    beds: raw.bedrooms ?? null,
    baths: raw.bathrooms ?? null,
    sqft: raw.livingArea ?? raw.livingAreaValue ?? null,
    lotSize: formatLotSize(raw),
    yearBuilt: raw.yearBuilt ?? null,
    homeType: raw.homeType ?? null,
    stories: raw.resoFacts?.stories ?? raw.stories ?? null,
    pricePerSqft: raw.resoFacts?.pricePerSquareFoot ?? null,
    hoaMonthly: raw.monthlyHoaFee ?? raw.resoFacts?.hoaFee ?? null,
    propertyTaxRate: raw.propertyTaxRate ?? null,
    zestimate: raw.zestimate ?? null,
    rentZestimate: raw.rentZestimate ?? null,
    schools: (raw.schools ?? []).map((s: any) => ({
      name: s.name ?? "—",
      rating: s.rating ?? null,
      level: s.level ?? "—",
    })),
    garage: raw.resoFacts?.garageParkingCapacity ?? raw.parkingCapacity ?? null,
    hasPool: raw.resoFacts?.hasPrivatePool ?? null,
    hasFireplace: raw.resoFacts?.hasFireplace ?? raw.hasFireplace ?? null,
    heating: joinArray(raw.resoFacts?.heating) ?? raw.heating ?? null,
    cooling: joinArray(raw.resoFacts?.cooling) ?? raw.cooling ?? null,
    daysOnZillow: raw.daysOnZillow ?? null,
    photo,
    listingUrl: raw.hdpUrl ? `https://www.zillow.com${raw.hdpUrl}` : "—",
    lat,
    lng,
  };
}
