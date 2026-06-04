import { NextResponse } from 'next/server';

const GOOGLE_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GOOGLE_QUERY_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/queryautocomplete/json';
const GOOGLE_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GOOGLE_FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const GOOGLE_PLACES_NEW_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const GOOGLE_PLACES_NEW_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

function getKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || '';
}

async function osmPredictions(input) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&extratags=1&limit=30&q=${encodeURIComponent(input)}`;
  const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json', 'User-Agent': 'Work2Wish-location-search' } });
  if (!res.ok) return [];
  const rows = await res.json();
  return (rows || []).map((item) => ({
    place_id: `osm-${item.osm_type || 'place'}-${item.osm_id}`,
    description: item.display_name,
    osm: true,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    structured_formatting: {
      main_text: item.namedetails?.name || item.name || item.display_name?.split(',')?.[0] || input,
      secondary_text: item.display_name,
    },
    types: item.type ? [item.type] : [],
  }));
}

function getText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj.text || obj.name || '';
}

async function googlePlacesNewAutocomplete(input, key) {
  const res = await fetch(GOOGLE_PLACES_NEW_AUTOCOMPLETE_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': [
        'suggestions.placePrediction.placeId',
        'suggestions.placePrediction.text',
        'suggestions.placePrediction.structuredFormat',
        'suggestions.placePrediction.types',
        'suggestions.queryPrediction.text',
      ].join(','),
    },
    body: JSON.stringify({
      input,
      languageCode: 'en',
      includeQueryPredictions: true,
      includePureServiceAreaBusinesses: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.suggestions)) return [];
  return data.suggestions.map((s, index) => {
    const p = s.placePrediction;
    const q = s.queryPrediction;
    if (p) {
      const main = getText(p.structuredFormat?.mainText) || getText(p.text) || input;
      const secondary = getText(p.structuredFormat?.secondaryText) || getText(p.text) || '';
      return {
        place_id: p.placeId,
        description: getText(p.text) || [main, secondary].filter(Boolean).join(', '),
        source: 'google-places-new',
        structured_formatting: { main_text: main, secondary_text: secondary },
        types: p.types || [],
      };
    }
    if (q) {
      const text = getText(q.text) || input;
      return {
        place_id: `query-${index}-${Buffer.from(text).toString('base64url')}`,
        description: text,
        source: 'google-query-new',
        is_query_prediction: true,
        structured_formatting: { main_text: text, secondary_text: 'Search this company, shop, landmark or address' },
        types: ['query'],
      };
    }
    return null;
  }).filter(Boolean);
}


async function googlePlacesNewTextSearch(input, key) {
  const res = await fetch(GOOGLE_PLACES_NEW_TEXT_SEARCH_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.types',
        'places.businessStatus',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: input,
      languageCode: 'en',
      maxResultCount: 20,
      includePureServiceAreaBusinesses: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.places)) return [];
  return data.places.map((place) => {
    const name = getText(place.displayName) || '';
    const address = place.formattedAddress || '';
    const description = name && address && !address.toLowerCase().startsWith(name.toLowerCase())
      ? `${name} - ${address}`
      : (address || name || input);
    return {
      place_id: place.id,
      description,
      source: 'google-places-new-text-search',
      structured_formatting: {
        main_text: name || description.split(',')[0] || input,
        secondary_text: address || description,
      },
      types: place.types || ['establishment'],
    };
  }).filter((p) => p.place_id || p.description);
}

async function googleAutocomplete(input, key, extra = {}) {
  const params = new URLSearchParams({ input, key, language: 'en', ...extra });
  const res = await fetch(`${GOOGLE_AUTOCOMPLETE_URL}?${params.toString()}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status))) return [];
  return (data.predictions || []).map((p) => ({ ...p, source: 'google-legacy-autocomplete' }));
}

async function googleQueryAutocomplete(input, key) {
  const params = new URLSearchParams({ input, key, language: 'en' });
  const res = await fetch(`${GOOGLE_QUERY_AUTOCOMPLETE_URL}?${params.toString()}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status))) return [];
  return (data.predictions || []).map((p, i) => ({
    ...p,
    place_id: p.place_id || `query-legacy-${i}-${Buffer.from(p.description || input).toString('base64url')}`,
    source: 'google-query-legacy',
    is_query_prediction: !p.place_id,
    structured_formatting: p.structured_formatting || { main_text: p.description || input, secondary_text: 'Search this place' },
  }));
}

function normalizeSearchPlace(place, input, source) {
  const name = place.name || '';
  const address = place.formatted_address || place.vicinity || '';
  const description = name && address && !address.toLowerCase().startsWith(name.toLowerCase())
    ? `${name} - ${address}`
    : (address || name || input);
  return {
    place_id: place.place_id,
    description,
    source,
    structured_formatting: {
      main_text: name || description.split(',')[0] || input,
      secondary_text: address || description,
    },
    types: place.types || ['establishment'],
  };
}

async function googleFindPlace(input, key) {
  const params = new URLSearchParams({
    input,
    inputtype: 'textquery',
    key,
    language: 'en',
    fields: 'place_id,name,formatted_address,geometry,types,business_status',
  });
  const res = await fetch(`${GOOGLE_FIND_PLACE_URL}?${params.toString()}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status))) return [];
  return (data.candidates || []).slice(0, 10).map((p) => normalizeSearchPlace(p, input, 'google-find-place')).filter((p) => p.place_id || p.description);
}

async function googleTextSearch(input, key) {
  const params = new URLSearchParams({ query: input, key, language: 'en' });
  const res = await fetch(`${GOOGLE_TEXT_SEARCH_URL}?${params.toString()}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status))) return [];
  return (data.results || []).slice(0, 20).map((place) => normalizeSearchPlace(place, input, 'google-text-search')).filter((p) => p.place_id || p.description);
}

function uniquePredictions(lists) {
  const seen = new Set();
  const out = [];
  for (const item of lists.flat()) {
    const key = item.place_id || item.description;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 50) break;
  }
  return out;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get('input') || '').trim();
    if (input.length < 2) return NextResponse.json({ predictions: [] });

    const key = getKey();
    if (!key) return NextResponse.json({ predictions: await osmPredictions(input), status: 'OSM_FALLBACK_NO_GOOGLE_KEY' });

    const [findPlaces, newTextSearchPlaces, textSearchPlaces, newPlaces, establishments, queryPlaces, allPlaces, addresses, geocodePlaces, regions] = await Promise.all([
      googleFindPlace(input, key),
      googlePlacesNewTextSearch(input, key),
      googleTextSearch(input, key),
      googlePlacesNewAutocomplete(input, key),
      googleAutocomplete(input, key, { types: 'establishment' }),
      googleQueryAutocomplete(input, key),
      googleAutocomplete(input, key),
      googleAutocomplete(input, key, { types: 'address' }),
      googleAutocomplete(input, key, { types: 'geocode' }),
      googleAutocomplete(input, key, { types: '(regions)' }),
    ]);

    // Google Maps-like ordering: exact business/shop/company/landmark matches first,
    // then Places autocomplete, then full addresses and areas.
    const googlePredictions = uniquePredictions([
      findPlaces,
      newTextSearchPlaces,
      textSearchPlaces,
      establishments,
      newPlaces,
      queryPlaces,
      allPlaces,
      addresses,
      geocodePlaces,
      regions,
    ]);
    if (googlePredictions.length) return NextResponse.json({ predictions: googlePredictions, status: 'OK' });

    return NextResponse.json({ predictions: await osmPredictions(input), status: 'OSM_FALLBACK_ZERO_GOOGLE_RESULTS' });
  } catch (error) {
    const input = (new URL(req.url)).searchParams.get('input') || '';
    return NextResponse.json({ predictions: await osmPredictions(input), error: error.message || 'Autocomplete failed' }, { status: 200 });
  }
}
