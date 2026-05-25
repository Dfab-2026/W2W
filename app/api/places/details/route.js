import { NextResponse } from 'next/server';

const GOOGLE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

function getKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '';
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = (searchParams.get('place_id') || '').trim();
    if (!placeId) return NextResponse.json({ error: 'place_id required' }, { status: 400 });

    const key = getKey();
    if (!key) return NextResponse.json({ error: 'Google Maps API key missing in .env.local' }, { status: 400 });

    const params = new URLSearchParams({
      place_id: placeId,
      key,
      fields: 'place_id,name,formatted_address,geometry,type,business_status',
      language: 'en',
      region: 'in',
    });

    const res = await fetch(`${GOOGLE_DETAILS_URL}?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok || data.status !== 'OK' || !data.result?.geometry?.location) {
      return NextResponse.json({ error: data.error_message || data.status || 'Google place details failed' }, { status: 400 });
    }

    const place = data.result;
    const name = place.name || '';
    const address = place.formatted_address || name;
    const text = name && address && !address.toLowerCase().startsWith(name.toLowerCase())
      ? `${name} - ${address}`
      : (address || name || 'Selected location');

    return NextResponse.json({
      location: {
        location_text: text,
        place_name: name,
        place_id: place.place_id || placeId,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      },
      raw: place,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Place details failed' }, { status: 500 });
  }
}
