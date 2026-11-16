// Shared Vector Graphics, Fonts, Color Palettes, Templates & PDF Export Engine for SHALOM Studios

export type StudioVectorElementKind =
  | 'rect'
  | 'roundRect'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'cross'
  | 'dove'
  | 'crown'
  | 'bible'
  | 'rays'
  | 'heart'
  | 'diamond'
  | 'arrow'
  | 'ribbon'
  | 'frame'
  | 'line';

export const STUDIO_FONTS = [
  { label: 'Outfit (Moderne)', value: '"Outfit", sans-serif' },
  { label: 'Plus Jakarta Sans', value: '"Plus Jakarta Sans", sans-serif' },
  { label: 'Classique Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Éditorial Garamond', value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { label: 'Impact Titre', value: '"Arial Black", Impact, sans-serif' },
  { label: 'Manuscrite', value: 'cursive' },
  { label: 'Machine à écrire', value: '"Courier New", monospace' },
];

export const SHALOM_COLOR_PALETTES = [
  { name: 'Bleu Royal & Or', colors: ['#0b1f42', '#1d4ed8', '#fbbf24', '#ffffff'] },
  { name: 'Paix Émeraude', colors: ['#064e3b', '#10b981', '#fef3c7', '#ffffff'] },
  { name: 'Coucher de Grâce', colors: ['#4c1d95', '#db2777', '#fbbf24', '#fff7ed'] },
  { name: 'Minimaliste Pur', colors: ['#0f172a', '#475569', '#e2e8f0', '#ffffff'] },
  { name: 'Terre & Lumière', colors: ['#451a03', '#b45309', '#fde68a', '#fffbeb'] },
];

export const VECTOR_ELEMENT_CATALOG: Array<{
  id: StudioVectorElementKind;
  labelFr: string;
  labelEn: string;
  symbol: string;
  category: 'spiritual' | 'basic' | 'badge';
}> = [
  { id: 'cross', labelFr: 'Croix', labelEn: 'Cross', symbol: '✝', category: 'spiritual' },
  { id: 'dove', labelFr: 'Colombe', labelEn: 'Dove', symbol: '🕊', category: 'spiritual' },
  { id: 'bible', labelFr: 'Bible', labelEn: 'Bible', symbol: '📖', category: 'spiritual' },
  { id: 'crown', labelFr: 'Couronne', labelEn: 'Crown', symbol: '👑', category: 'spiritual' },
  { id: 'rays', labelFr: 'Lumière', labelEn: 'Light Rays', symbol: '☀', category: 'spiritual' },
  { id: 'heart', labelFr: 'Cœur', labelEn: 'Heart', symbol: '♥', category: 'spiritual' },
  { id: 'star', labelFr: 'Étoile', labelEn: 'Star', symbol: '★', category: 'spiritual' },
  { id: 'rect', labelFr: 'Rectangle', labelEn: 'Rectangle', symbol: '▭', category: 'basic' },
  { id: 'roundRect', labelFr: 'Arrondi', labelEn: 'Rounded', symbol: '▢', category: 'basic' },
  { id: 'circle', labelFr: 'Cercle', labelEn: 'Circle', symbol: '●', category: 'basic' },
  { id: 'triangle', labelFr: 'Triangle', labelEn: 'Triangle', symbol: '▲', category: 'basic' },
  { id: 'diamond', labelFr: 'Losange', labelEn: 'Diamond', symbol: '◆', category: 'basic' },
  { id: 'line', labelFr: 'Ligne', labelEn: 'Line', symbol: '―', category: 'basic' },
  { id: 'arrow', labelFr: 'Flèche', labelEn: 'Arrow', symbol: '➜', category: 'badge' },
  { id: 'ribbon', labelFr: 'Bannière', labelEn: 'Banner', symbol: '⚑', category: 'badge' },
  { id: 'frame', labelFr: 'Cadre', labelEn: 'Frame', symbol: '回', category: 'badge' },
];

export function drawStudioVectorElement(
  ctx: CanvasRenderingContext2D,
  shape: StudioVectorElementKind,
  width: number,
  height: number,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number
) {
  const hw = width / 2;
  const hh = height / 2;
  ctx.beginPath();

  switch (shape) {
    case 'rect':
      ctx.rect(-hw, -hh, width, height);
      break;
    case 'roundRect': {
      const r = Math.min(36, hw, hh);
      ctx.moveTo(-hw + r, -hh);
      ctx.lineTo(hw - r, -hh);
      ctx.quadraticCurveTo(hw, -hh, hw, -hh + r);
      ctx.lineTo(hw, hh - r);
      ctx.quadraticCurveTo(hw, hh, hw - r, hh);
      ctx.lineTo(-hw + r, hh);
      ctx.quadraticCurveTo(-hw, hh, -hw, hh - r);
      ctx.lineTo(-hw, -hh + r);
      ctx.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
      break;
    }
    case 'circle':
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw, hh);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, 0);
      ctx.lineTo(0, hh);
      ctx.lineTo(-hw, 0);
      ctx.closePath();
      break;
    case 'star': {
      const spikes = 5;
      const outerR = Math.min(hw, hh);
      const innerR = outerR * 0.45;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'cross': {
      const armW = width * 0.24;
      const barY = -height * 0.16;
      const barH = height * 0.22;
      ctx.moveTo(-armW / 2, -hh);
      ctx.lineTo(armW / 2, -hh);
      ctx.lineTo(armW / 2, barY);
      ctx.lineTo(hw * 0.85, barY);
      ctx.lineTo(hw * 0.85, barY + barH);
      ctx.lineTo(armW / 2, barY + barH);
      ctx.lineTo(armW / 2, hh);
      ctx.lineTo(-armW / 2, hh);
      ctx.lineTo(-armW / 2, barY + barH);
      ctx.lineTo(-hw * 0.85, barY + barH);
      ctx.lineTo(-hw * 0.85, barY);
      ctx.lineTo(-armW / 2, barY);
      ctx.closePath();
      break;
    }
    case 'heart': {
      const topCurveH = height * 0.3;
      ctx.moveTo(0, hh * 0.85);
      ctx.bezierCurveTo(-hw * 1.15, hh * 0.1, -hw, -hh * 0.72, 0, -hh + topCurveH);
      ctx.bezierCurveTo(hw, -hh * 0.72, hw * 1.15, hh * 0.1, 0, hh * 0.85);
      ctx.closePath();
      break;
    }
    case 'dove': {
      // Graceful stylized dove silhouette
      ctx.moveTo(-hw * 0.75, hh * 0.15);
      ctx.quadraticCurveTo(-hw * 0.25, -hh * 0.95, hw * 0.15, -hh * 0.18);
      ctx.quadraticCurveTo(hw * 0.55, -hh * 0.6, hw * 0.82, -hh * 0.22);
      ctx.quadraticCurveTo(hw * 0.55, hh * 0.05, hw * 0.25, hh * 0.15);
      ctx.quadraticCurveTo(hw * 0.5, hh * 0.55, hw * 0.1, hh * 0.65);
      ctx.quadraticCurveTo(-hw * 0.2, hh * 0.45, -hw * 0.65, hh * 0.68);
      ctx.quadraticCurveTo(-hw * 0.45, hh * 0.3, -hw * 0.75, hh * 0.15);
      ctx.closePath();
      break;
    }
    case 'crown': {
      ctx.moveTo(-hw * 0.85, hh * 0.65);
      ctx.lineTo(-hw * 0.95, -hh * 0.45);
      ctx.lineTo(-hw * 0.35, hh * 0.1);
      ctx.lineTo(0, -hh * 0.75);
      ctx.lineTo(hw * 0.35, hh * 0.1);
      ctx.lineTo(hw * 0.95, -hh * 0.45);
      ctx.lineTo(hw * 0.85, hh * 0.65);
      ctx.closePath();
      break;
    }
    case 'bible': {
      // Open book silhouette
      ctx.moveTo(0, -hh * 0.55);
      ctx.quadraticCurveTo(-hw * 0.45, -hh * 0.82, -hw * 0.92, -hh * 0.55);
      ctx.lineTo(-hw * 0.92, hh * 0.68);
      ctx.quadraticCurveTo(-hw * 0.45, hh * 0.42, 0, hh * 0.72);
      ctx.quadraticCurveTo(hw * 0.45, hh * 0.42, hw * 0.92, hh * 0.68);
      ctx.lineTo(hw * 0.92, -hh * 0.55);
      ctx.quadraticCurveTo(hw * 0.45, -hh * 0.82, 0, -hh * 0.55);
      ctx.closePath();
      break;
    }
    case 'rays': {
      const rays = 12;
      const outer = Math.min(hw, hh);
      const inner = outer * 0.36;
      for (let i = 0; i < rays * 2; i++) {
        const rad = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / rays;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'arrow': {
      ctx.moveTo(-hw, -hh * 0.32);
      ctx.lineTo(hw * 0.25, -hh * 0.32);
      ctx.lineTo(hw * 0.25, -hh * 0.85);
      ctx.lineTo(hw, 0);
      ctx.lineTo(hw * 0.25, hh * 0.85);
      ctx.lineTo(hw * 0.25, hh * 0.32);
      ctx.lineTo(-hw, hh * 0.32);
      ctx.closePath();
      break;
    }
    case 'ribbon': {
      ctx.moveTo(-hw, -hh * 0.65);
      ctx.lineTo(hw, -hh * 0.65);
      ctx.lineTo(hw * 0.78, 0);
      ctx.lineTo(hw, hh * 0.65);
      ctx.lineTo(-hw, hh * 0.65);
      ctx.lineTo(-hw * 0.78, 0);
      ctx.closePath();
      break;
    }
    case 'frame': {
      // Outer rectangle + inner cutout
      ctx.rect(-hw, -hh, width, height);
      const inset = Math.min(width, height) * 0.12;
      if (width > inset * 2.5 && height > inset * 2.5) {
        ctx.rect(-hw + inset, -hh + inset, width - inset * 2, height - inset * 2);
      }
      break;
    }
    case 'line':
      ctx.moveTo(-hw, 0);
      ctx.lineTo(hw, 0);
      break;
  }

  if (shape !== 'line' && fillColor !== 'transparent') {
    ctx.fillStyle = fillColor;
    if (shape === 'frame') {
      ctx.fill('evenodd');
    } else {
      ctx.fill();
    }
  }
  if (strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

// Pure-TS single-page PDF generator wrapping a high-res JPEG canvas image (Zero dependencies, 100% offline)
export async function exportCanvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Impossible de générer l’aperçu PDF.'))),
      'image/jpeg',
      0.92
    );
  });
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const w = canvas.width;
  const h = canvas.height;
  // Scale to fit A4 / poster dimensions in PDF points (72 dpi)
  const pdfW = 595;
  const pdfH = Math.round((h / Math.max(1, w)) * pdfW);

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    byteLength += b.byteLength;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteLength += b.byteLength;
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  offsets.push(byteLength);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets.push(byteLength);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets.push(byteLength);
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets.push(byteLength);
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  const contentStream = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets.push(byteLength);
  pushStr(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = byteLength;
  pushStr(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const total = new Uint8Array(byteLength);
  let pos = 0;
  for (const c of chunks) {
    total.set(c, pos);
    pos += c.byteLength;
  }
  return new Blob([total], { type: 'application/pdf' });
}
