const restrictedGeminiRegions = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'CH', 'GB'
]);

export function geminiRegionAllowed(request) {
  const country = String(request.cf?.country || '').toUpperCase();
  return Boolean(country && country !== 'XX' && !restrictedGeminiRegions.has(country));
}

export function ageConfirmationReceived(value) {
  return value === true || value === 'true' || value === 'on';
}
