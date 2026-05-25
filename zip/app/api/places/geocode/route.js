import { NextResponse } from 'next/server';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

function getKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '';
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get('address') || '').trim();
    const latlng = (searchParams.get('latlng') || '').trim();
    if (!address && !latlng) return NextResponse.json({ error: 'address or latlng required' }, { status: 400 });

    const key = getKey();
    if (!key) return NextResponse.json({ error: 'Google Maps API key missing in .env.local' }, { status: 400 });

    const params = new URLSearchParams({ key, language: 'en', region: 'in' });
    if (address) {
      params.set('address', address);
      params.set('components', 'country:IN');
    }
    if (latlng) params.set('latlng', latlng);

    const res = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok || data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      return NextResponse.json({ error: data.error_message || data.status || 'Google geocode failed' }, { status: 400 });
    }

    const first = data.results[0];
    return NextResponse.json({
      location: {
        location_text: first.formatted_address || address || latlng,
        place_name: '',
        place_id: first.place_id || '',
        latitude: first.geometry.location.lat,
        longitude: first.geometry.location.lng,
      },
      raw: first,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Geocode failed' }, { status: 500 });
  }
}
