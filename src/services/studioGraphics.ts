// Shared Vector Graphics, Fonts, Color Palettes, Offline Studio Photos & Multi-Page PDF Export Engine

import bgDawnSanctuary from '../assets/images/studio_bg_dawn_sanctuary_1794916315028.jpg';
import bgOliveLight from '../assets/images/studio_bg_olive_light_1794916314763.jpg';
import bgRoyalGoldWaves from '../assets/images/studio_bg_royal_gold_waves_1794916315803.jpg';
import bgLinenParchment from '../assets/images/studio_bg_linen_parchment_1794916316525.jpg';

import {
  SVG_VECTOR_CATALOG,
  StudioVectorElementKind,
  VectorCategory,
  buildSvgVectorMarkup,
  getSvgVectorDef,
  recolorArbitrarySvgMarkup,
  renderSvgVectorToCanvas,
} from './studios/svgVectors';

export type { StudioVectorElementKind, VectorCategory };
export {
  SVG_VECTOR_CATALOG,
  buildSvgVectorMarkup,
  getSvgVectorDef,
  recolorArbitrarySvgMarkup,
  renderSvgVectorToCanvas,
};

export interface StudioBackdropPhoto {
  id: string;
  nameFr: string;
  nameEn: string;
  src: string;
  theme: 'light' | 'dark' | 'editorial';
}

export const STUDIO_BACKDROP_PHOTOS: StudioBackdropPhoto[] = [
  {
    id: 'photo_dawn_sanctuary',
    nameFr: 'Sanctuaire Aurore',
    nameEn: 'Dawn Sanctuary',
    src: bgDawnSanctuary,
    theme: 'editorial',
  },
  {
    id: 'photo_olive_light',
    nameFr: 'Rameau d’Olivier',
    nameEn: 'Olive & Morning Light',
    src: bgOliveLight,
    theme: 'light',
  },
  {
    id: 'photo_royal_gold_waves',
    nameFr: 'Soie Bleu Royal & Or',
    nameEn: 'Royal Navy & Gold Silk',
    src: bgRoyalGoldWaves,
    theme: 'dark',
  },
  {
    id: 'photo_linen_parchment',
    nameFr: 'Lin & Parchemin Doux',
    nameEn: 'Fine Linen Parchment',
    src: bgLinenParchment,
    theme: 'light',
  },
];

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

export const VECTOR_ELEMENT_CATALOG = SVG_VECTOR_CATALOG.map((item) => ({
  id: item.id,
  labelFr: item.labelFr,
  labelEn: item.labelEn,
  category: item.category,
  tags: item.tags,
  defaultPrimary: item.defaultPrimary,
  defaultSecondary: item.defaultSecondary,
}));

export function drawStudioVectorElement(
  ctx: CanvasRenderingContext2D,
  shape: StudioVectorElementKind,
  width: number,
  height: number,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
  secondaryColor?: string
) {
  if (typeof Path2D !== 'undefined') {
    renderSvgVectorToCanvas(
      ctx,
      shape,
      width,
      height,
      fillColor,
      secondaryColor,
      strokeColor,
      strokeWidth
    );
    return;
  }

  // Ultra-rare fallback if Path2D is unavailable
  const hw = width / 2;
  const hh = height / 2;
  ctx.beginPath();
  ctx.rect(-hw, -hh, width, height);
  if (fillColor !== 'transparent') {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

// Pure-TS Multi-Page PDF generator wrapping high-res JPEG canvas pages (Zero dependencies, 100% offline)
export async function exportCanvasesToMultiPagePdfBlob(
  canvases: HTMLCanvasElement[]
): Promise<Blob> {
  if (!canvases || canvases.length === 0) {
    throw new Error('Aucune page à exporter en PDF.');
  }

  interface EncodedPage {
    jpegBytes: Uint8Array;
    w: number;
    h: number;
    pdfW: number;
    pdfH: number;
  }

  const encodedPages: EncodedPage[] = [];
  for (const canvas of canvases) {
    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Impossible de générer une page PDF.'))),
        'image/jpeg',
        0.92
      );
    });
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const w = Math.max(1, canvas.width);
    const h = Math.max(1, canvas.height);
    const pdfW = 595;
    const pdfH = Math.max(100, Math.round((h / w) * pdfW));
    encodedPages.push({ jpegBytes, w, h, pdfW, pdfH });
  }

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

  // Object 1: Catalog
  offsets.push(byteLength);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Compute Page object IDs: each page takes 3 objects (Page, Image XObject, Contents) starting at object 3
  const pageKids: string[] = [];
  for (let i = 0; i < encodedPages.length; i++) {
    const pageObjId = 3 + i * 3;
    pageKids.push(`${pageObjId} 0 R`);
  }

  // Object 2: Pages
  offsets.push(byteLength);
  pushStr(
    `2 0 obj\n<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${encodedPages.length} >>\nendobj\n`
  );

  for (let i = 0; i < encodedPages.length; i++) {
    const p = encodedPages[i];
    const pageObjId = 3 + i * 3;
    const imgObjId = pageObjId + 1;
    const contentObjId = pageObjId + 2;

    // Page object
    offsets.push(byteLength);
    pushStr(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.pdfW} ${p.pdfH}] /Resources << /XObject << /Im0 ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );

    // Image XObject
    offsets.push(byteLength);
    pushStr(
      `${imgObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushStr('\nendstream\nendobj\n');

    // Content stream
    const contentStream = `q\n${p.pdfW} 0 0 ${p.pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
    offsets.push(byteLength);
    pushStr(
      `${contentObjId} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
    );
  }

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

export async function exportCanvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return exportCanvasesToMultiPagePdfBlob([canvas]);
}
