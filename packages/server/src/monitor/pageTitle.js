export function extractPageTitle(html) {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? match[1].trim() : null;
}
