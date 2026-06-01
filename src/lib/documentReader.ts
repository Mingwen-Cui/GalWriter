import * as mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_DOCUMENT_CHARS = 24000;
const MAX_PDF_PAGES = 80;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;

export type AssistantDocument = {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'text';
  objectUrl: string;
  mimeType: string;
  text: string;
  charCount: number;
  truncated: boolean;
};

const isPdfFile = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

const isDocxFile = (file: File) =>
  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
  file.name.toLowerCase().endsWith('.docx');

const isXlsxFile = (file: File) =>
  file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
  file.name.toLowerCase().endsWith('.xlsx');

const isPptxFile = (file: File) =>
  file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
  file.name.toLowerCase().endsWith('.pptx');

const isTextFile = (file: File) => {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith('text/') ||
    /\.(txt|md|markdown|csv|tsv|json|xml|html|htm|rtf)$/i.test(name)
  );
};

const getDocumentType = (file: File): AssistantDocument['type'] | null => {
  if (isPdfFile(file)) return 'pdf';
  if (isDocxFile(file)) return 'docx';
  if (isXlsxFile(file)) return 'xlsx';
  if (isPptxFile(file)) return 'pptx';
  if (isTextFile(file)) return 'text';
  return null;
};

const cleanExtractedText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

const limitDocumentText = (text: string) => {
  const cleaned = cleanExtractedText(text);
  if (cleaned.length <= MAX_DOCUMENT_CHARS) {
    return { text: cleaned, truncated: false };
  }

  return {
    text: `${cleaned.slice(0, MAX_DOCUMENT_CHARS)}\n\n[Document text truncated for AI context.]`,
    truncated: true,
  };
};

const extractPdfText = async (file: File) => {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');

    if (text.trim()) pageTexts.push(`Page ${pageNumber}\n${text}`);
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    pageTexts.push(`[Only the first ${MAX_PDF_PAGES} pages were read.]`);
  }

  return pageTexts.join('\n\n');
};

const extractDocxText = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const decodeXmlText = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const stripXmlTags = (value: string) => decodeXmlText(value.replace(/<[^>]+>/g, ' '));

const readZipText = async (zip: JSZip, path: string) => {
  const file = zip.file(path);
  return file ? file.async('text') : '';
};

const extractXlsxText = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sharedStringsXml = await readZipText(zip, 'xl/sharedStrings.xml');
  const sharedStrings = Array.from(sharedStringsXml.matchAll(/<si[\s\S]*?<\/si>/g)).map((match) =>
    stripXmlTags(match[0]).replace(/\s+/g, ' ').trim(),
  );

  const sheets = zip
    .file(/^xl\/worksheets\/sheet\d+\.xml$/)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const sheetTexts = await Promise.all(
    sheets.map(async (sheet, index) => {
      const xml = await sheet.async('text');
      const cells = Array.from(xml.matchAll(/<c\b[^>]*?r="([^"]+)"[^>]*?>([\s\S]*?)<\/c>/g));
      const values = cells
        .map((cell) => {
          const ref = cell[1];
          const cellXml = cell[0];
          const isSharedString = /\bt="s"/.test(cellXml);
          const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
          const text = isSharedString ? sharedStrings[Number(value)] || '' : decodeXmlText(value);
          return text ? `${ref}: ${text}` : '';
        })
        .filter(Boolean);

      return values.length > 0 ? `Sheet ${index + 1}\n${values.join('\n')}` : '';
    }),
  );

  return sheetTexts.filter(Boolean).join('\n\n');
};

const extractPptxText = async (file: File) => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = zip
    .file(/^ppt\/slides\/slide\d+\.xml$/)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const slideTexts = await Promise.all(
    slides.map(async (slide, index) => {
      const xml = await slide.async('text');
      const runs = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
        .map((match) => decodeXmlText(match[1]).trim())
        .filter(Boolean);

      return runs.length > 0 ? `Slide ${index + 1}\n${runs.join('\n')}` : '';
    }),
  );

  return slideTexts.filter(Boolean).join('\n\n');
};

const extractTextFile = async (file: File) => {
  if (file.size > MAX_TEXT_FILE_BYTES) {
    throw new Error('Text files larger than 2 MB are not read for safety.');
  }

  return file.text();
};

const extractDocumentText = async (file: File, type: AssistantDocument['type']) => {
  if (type === 'pdf') return extractPdfText(file);
  if (type === 'docx') return extractDocxText(file);
  if (type === 'xlsx') return extractXlsxText(file);
  if (type === 'pptx') return extractPptxText(file);
  return extractTextFile(file);
};

export const readAssistantDocument = async (file: File): Promise<AssistantDocument> => {
  const type = getDocumentType(file);
  if (!type) {
    throw new Error(
      'This file type is not supported yet. Please use PDF, DOCX, XLSX, PPTX, CSV, TXT, MD, JSON, XML, HTML, or RTF.',
    );
  }

  const rawText = await extractDocumentText(file, type);
  const { text, truncated } = limitDocumentText(rawText);

  if (!text) {
    throw new Error('No readable text was found in this document.');
  }

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    type,
    objectUrl: URL.createObjectURL(file),
    mimeType: file.type,
    text,
    charCount: cleanExtractedText(rawText).length,
    truncated,
  };
};

export const buildAssistantDocumentContext = (documents: AssistantDocument[]) =>
  documents
    .map(
      (document, index) =>
        `#${index + 1} ${document.name} (${document.type.toUpperCase()}, ${document.charCount} characters${
          document.truncated ? ', truncated' : ''
        })\n${document.text}`,
    )
    .join('\n\n---\n\n');
