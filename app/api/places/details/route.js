import { NextResponse } from 'next/server';

const GOOGLE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GOOGLE_PLACES_NEW_DETAILS_BASE = 'https://places.googleapis.com/v1/places';

function getKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || '';
}

function toLocationFromNew(place, fallbackId) {
  const name = place.displayName?.text || '';
  const address = place.formattedAddress || name;
  const text = name && address && !address.toLowerCase().startsWith(name.toLowerCase()) ? `${name} - ${address}` : (address || name || 'Selected location');
  return {
    location_text: text,
    place_name: name,
    place_id: place.id || fallbackId,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
  };
}

function toLocationFromLegacy(place, fallbackId) {
  const name = place.name || '';
  const address = place.formatted_address || name;
  const text = name && address && !address.toLowerCase().startsWith(name.toLowerCase()) ? `${name} - ${address}` : (address || name || 'Selected location');
  return {
    location_text: text,
    place_name: name,
    place_id: place.place_id || fallbackId,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = (searchParams.get('place_id') || '').trim();
    const fallbackText = (searchParams.get('fallback') || '').trim();
    if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 });

    const key = getKey();
    if (!key) return NextResponse.json({ error: 'Google Maps API key missing in .env.local' }, { status: 400 });

    // Query predictions do not have a real place id. Resolve them through Geocoding/Text Search on the client/server side.
    if (placeId.startsWith('query-')) {
      return NextResponse.json({ error: 'query_prediction_needs_geocode', fallback: fallbackText }, { status: 400 });
    }

    // Try Places API (New) first. It supports IDs returned by the new autocomplete API.
    try {
      const newRes = await fetch(`${GOOGLE_PLACES_NEW_DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
        cache: 'no-store',
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types,businessStatus',
        },
      });
      const newData = await newRes.json().catch(() => ({}));
      if (newRes.ok && newData?.location?.latitude !== undefined && newData?.location?.longitude !== undefined) {
        return NextResponse.json({ location: toLocationFromNew(newData, placeId), raw: newData, source: 'google-places-new' });
      }
    } catch {}

    const params = new URLSearchParams({
      place_id: placeId,
      key,
      fields: 'place_id,name,formatted_address,geometry,type,business_status',
      language: 'en',
    });

    const res = await fetch(`${GOOGLE_DETAILS_URL}?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok || data.status !== 'OK' || !data.result?.geometry?.location) {
      return NextResponse.json({ error: data.error_message || data.status || 'Google place details failed' }, { status: 400 });
    }

    return NextResponse.json({ location: toLocationFromLegacy(data.result, placeId), raw: data.result, source: 'google-legacy-details' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Place details failed' }, { status: 500 });
  }
}
