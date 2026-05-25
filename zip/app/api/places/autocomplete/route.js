import { NextResponse } from 'next/server';

const GOOGLE_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

function getKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '';
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const input = (searchParams.get('input') || '').trim();
    if (input.length < 2) return NextResponse.json({ predictions: [] });

    const key = getKey();
    if (!key) return NextResponse.json({ error: 'Google Maps API key missing in .env.local' }, { status: 400 });

    const params = new URLSearchParams({
      input,
      key,
      components: 'country:in',
      language: 'en',
      region: 'in',
    });

    // Bias around Bengaluru so company/place searches like DFAB, Peenya, etc. appear better.
    params.set('location', '12.9716,77.5946');
    params.set('radius', '80000');

    const res = await fetch(`${GOOGLE_AUTOCOMPLETE_URL}?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok || (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status))) {
      return NextResponse.json({ error: data.error_message || data.status || 'Google autocomplete failed' }, { status: 400 });
    }

    return NextResponse.json({ predictions: data.predictions || [], status: data.status });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Autocomplete failed' }, { status: 500 });
  }
}
