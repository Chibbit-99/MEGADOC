// Reject obviously oversized or malformed ZIP directories before office import.
// These limits are a precaution, not a guarantee against malicious archives.
function checkOfficeArchive(buffer) {
  const view = new DataView(buffer), length = view.byteLength;
  let end = -1;
  for (let i = length - 22, min = Math.max(0, length - 65557); i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === length) { end = i; break; }
  }
  if (end < 0) throw new Error('Invalid ZIP archive');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count || count === 0xffff || size === 0xffffffff || start === 0xffffffff || count > 2000 || start + size > end) throw new Error('Unsupported or oversized ZIP archive');
  let pos = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > start + size || view.getUint32(pos, true) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const flags = view.getUint16(pos + 8, true), compressed = view.getUint32(pos + 20, true), expanded = view.getUint32(pos + 24, true);
    const next = pos + 46 + view.getUint16(pos + 28, true) + view.getUint16(pos + 30, true) + view.getUint16(pos + 32, true);
    if ((flags & 1) || compressed === 0xffffffff || expanded === 0xffffffff || next > start + size) throw new Error('Unsupported ZIP entry');
    total += expanded;
    if (expanded > 30 * 1024 * 1024 || total > 50 * 1024 * 1024) throw new Error('Expanded document exceeds the import limit');
    pos = next;
  }
  if (pos !== start + size) throw new Error('Invalid ZIP directory');
}
