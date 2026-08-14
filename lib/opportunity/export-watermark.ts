import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import sharp from 'sharp';

const WATERMARK_ROTATION_DEGREES = -18;
const WATERMARK_ROTATION_RADIANS = (Math.abs(WATERMARK_ROTATION_DEGREES) * Math.PI) / 180;

export function buildExportWatermarkText(email: string, _title: string, _exportedAt = new Date()) {
  const viewer = email.trim() || 'unknown';
  return `Confidential — Harpoon Ventures — ${viewer}`;
}

function watermarkTileSteps(textWidth: number, fontSize: number) {
  const stepX = textWidth + Math.max(64, fontSize * 5);
  const rotatedHeight = textWidth * Math.sin(WATERMARK_ROTATION_RADIANS) + fontSize * Math.cos(WATERMARK_ROTATION_RADIANS);
  const stepY = Math.max(fontSize * 5.5, rotatedHeight * 0.4 + fontSize * 2.4);
  return { stepX, stepY };
}

async function stampPdfBytes(bytes: Uint8Array, text: string) {
  const document = await PDFDocument.load(bytes);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const size = 20;
    const textWidth = font.widthOfTextAtSize(text, size);
    const { stepX, stepY } = watermarkTileSteps(textWidth, size);

    for (let y = -stepY; y < height + stepY; y += stepY) {
      for (let x = -stepX; x < width + stepX; x += stepX) {
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0.16, 0.18, 0.22),
          opacity: 0.128,
          rotate: degrees(WATERMARK_ROTATION_DEGREES),
        });
      }
    }
  }

  return document.save();
}

export async function watermarkPdf(bytes: Uint8Array, text: string) {
  return stampPdfBytes(bytes, text);
}

export async function createConfidentialCoverPdf(title: string, watermarkText: string) {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  page.drawText('CONFIDENTIAL', {
    x: 72,
    y: 700,
    size: 22,
    font: bold,
    color: rgb(0.16, 0.18, 0.22),
  });
  page.drawText(title, {
    x: 72,
    y: 660,
    size: 14,
    font: regular,
    color: rgb(0.16, 0.18, 0.22),
  });
  page.drawText(
    'The accompanying Word document is confidential and intended only for the recipient.',
    {
      x: 72,
      y: 620,
      size: 11,
      font: regular,
      color: rgb(0.25, 0.27, 0.3),
    },
  );

  return stampPdfBytes(await document.save(), watermarkText);
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function watermarkImage(bytes: Buffer, text: string) {
  const image = sharp(bytes, { failOn: 'none' });
  const metadata = await image.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 800;
  const fontSize = Math.round(Math.min(56, Math.max(32, width / 32)));
  const textWidth = text.length * fontSize * 0.58;
  const { stepX, stepY } = watermarkTileSteps(textWidth, fontSize);
  const escaped = escapeXml(text);

  const svg = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<defs><pattern id="wm" patternUnits="userSpaceOnUse" width="${stepX}" height="${stepY}" patternTransform="rotate(${WATERMARK_ROTATION_DEGREES})">`,
    `<text x="0" y="${fontSize}" fill="rgba(28,36,44,0.144)" font-size="${fontSize}" font-weight="400" font-family="Helvetica, Arial, sans-serif" letter-spacing="0.04em">${escaped}</text>`,
    `</pattern></defs>`,
    `<rect width="100%" height="100%" fill="url(#wm)"/>`,
    `</svg>`,
  ].join('');

  const output = image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);

  if (metadata.format === 'jpeg') {
    return output.jpeg({ quality: 88 }).toBuffer();
  }

  if (metadata.format === 'webp') {
    return output.webp({ quality: 88 }).toBuffer();
  }

  return output.png().toBuffer();
}
