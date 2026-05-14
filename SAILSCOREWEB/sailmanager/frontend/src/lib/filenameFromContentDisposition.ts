/**
 * Extract attachment filename from a Content-Disposition header (RFC 2183 / 5987).
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const mStar = header.match(/filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;\s]+)/i);
  if (mStar?.[1]) {
    const raw = mStar[1].trim().replace(/^["']|["']$/g, '');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  const mQuoted = header.match(/filename\s*=\s*"((?:\\.|[^"\\])*)"/i);
  if (mQuoted?.[1]) {
    return mQuoted[1].replace(/\\(.)/g, '$1');
  }
  // Unquoted filename=… (may contain spaces until ';')
  const mUnquoted = header.match(/filename\s*=\s*([^;]+)/i);
  if (mUnquoted?.[1]) {
    return mUnquoted[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}
