import JSZip from "jszip";

export type BookSection = {
  id: string;
  title: string;
  text: string;
  images?: BookImage[];
};

export type BookImage = {
  id: string;
  src: string;
  alt: string;
  offset: number;
};

export type ParsedBook = {
  title: string;
  format: "TXT" | "EPUB" | "PDF";
  sections: BookSection[];
  notice?: string;
  assetUrls?: string[];
};

const normalizeText = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const stripExtension = (name: string) => name.replace(/\.[^.]+$/, "");

function decodeText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const utf8Errors = (utf8.match(/�/g) || []).length;
  if (utf8Errors < 3) return utf8;
  try {
    const gb = new TextDecoder("gb18030").decode(bytes);
    return (gb.match(/�/g) || []).length < utf8Errors ? gb : utf8;
  } catch {
    return utf8;
  }
}

function splitTextSections(text: string): BookSection[] {
  const normalized = normalizeText(text);
  const chapterPattern = /(?:^|\n)(第[零〇一二三四五六七八九十百千万两\d]+[章节回卷][^\n]*)/g;
  const matches = [...normalized.matchAll(chapterPattern)];
  if (matches.length < 2) {
    const chunks: BookSection[] = [];
    const targetSize = 12000;
    for (let start = 0; start < normalized.length; start += targetSize) {
      const textChunk = normalized.slice(start, start + targetSize);
      chunks.push({
        id: `part-${chunks.length + 1}`,
        title: chunks.length ? `Part ${chunks.length + 1}` : "Text",
        text: textChunk,
      });
    }
    return chunks.length ? chunks : [{ id: "text", title: "Text", text: "" }];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? normalized.length;
    return {
      id: `chapter-${index + 1}`,
      title: match[1].trim().slice(0, 70),
      text: normalized.slice(start, end).trim(),
    };
  });
}

function resolveZipPath(baseFile: string, relative: string) {
  const base = baseFile.split("/").slice(0, -1);
  for (const part of relative.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") base.pop();
    else base.push(part);
  }
  return base.join("/");
}

async function parseEpub(file: File): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const container = await zip.file("META-INF/container.xml")?.async("string");
  if (!container) throw new Error("This EPUB has no container file.");
  const xml = new DOMParser().parseFromString(container, "application/xml");
  const rootPath = xml.querySelector("rootfile")?.getAttribute("full-path");
  if (!rootPath) throw new Error("This EPUB does not identify its package document.");
  const packageText = await zip.file(rootPath)?.async("string");
  if (!packageText) throw new Error("The EPUB package document could not be read.");

  const packageXml = new DOMParser().parseFromString(packageText, "application/xml");
  const title =
    packageXml.querySelector("metadata title, dc\\:title")?.textContent?.trim() ||
    stripExtension(file.name);
  const manifest = new Map<string, { href: string; mediaType: string }>();
  const mediaTypes = new Map<string, string>();
  packageXml.querySelectorAll("manifest item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") || "application/octet-stream";
    if (id && href) {
      const cleanHref = href.split(/[?#]/)[0];
      manifest.set(id, { href: cleanHref, mediaType });
      mediaTypes.set(resolveZipPath(rootPath, decodeURIComponent(cleanHref)), mediaType);
    }
  });

  const sections: BookSection[] = [];
  const assetUrls: string[] = [];
  let illustrationCount = 0;
  const spineItems = Array.from(packageXml.querySelectorAll("spine itemref"));
  try {
    for (const [index, item] of spineItems.entries()) {
      const manifestItem = manifest.get(item.getAttribute("idref") || "");
      if (!manifestItem) continue;
      const path = resolveZipPath(rootPath, decodeURIComponent(manifestItem.href));
      const markup = await zip.file(path)?.async("string");
      if (!markup) continue;
      const document = new DOMParser().parseFromString(markup, "text/html");
      document.querySelectorAll("script, style, nav").forEach((node) => node.remove());

      const pendingImages: Omit<BookImage, "offset">[] = [];
      document.querySelectorAll("img, image").forEach((image, imageIndex) => {
        const relativeSource = image.getAttribute("src") || image.getAttribute("href") || image.getAttribute("xlink:href") || "";
        if (!relativeSource || /^(?:data:|https?:)/i.test(relativeSource)) {
          image.remove();
          return;
        }
        const imagePath = resolveZipPath(path, decodeURIComponent(relativeSource.split(/[?#]/)[0]));
        const imageFile = zip.file(imagePath);
        if (!imageFile) {
          image.remove();
          return;
        }
        const marker = document.createTextNode("\uFFFC");
        image.replaceWith(marker);
        pendingImages.push({
          id: `epub-${index + 1}-image-${imageIndex + 1}`,
          src: imagePath,
          alt: image.getAttribute("alt")?.trim() || `Illustration ${illustrationCount + pendingImages.length + 1}`,
        });
      });

      const markedText = normalizeText(document.body?.innerText || document.body?.textContent || "");
      const images: BookImage[] = [];
      let bodyText = "";
      let pendingIndex = 0;
      for (const character of markedText) {
        if (character === "\uFFFC") {
          const pending = pendingImages[pendingIndex];
          pendingIndex += 1;
          if (!pending) continue;
          const bytes = await zip.file(pending.src)?.async("uint8array");
          if (!bytes) continue;
          const imageBytes = new Uint8Array(bytes.byteLength);
          imageBytes.set(bytes);
          const blobUrl = URL.createObjectURL(new Blob([imageBytes.buffer], { type: mediaTypes.get(pending.src) || "application/octet-stream" }));
          assetUrls.push(blobUrl);
          images.push({ ...pending, src: blobUrl, offset: bodyText.length });
          illustrationCount += 1;
        } else {
          bodyText += character;
        }
      }
      if (!bodyText && !images.length) continue;
      const heading = document.querySelector("h1, h2, h3")?.textContent?.trim();
      sections.push({
        id: `epub-${index + 1}`,
        title: heading?.slice(0, 70) || `Section ${sections.length + 1}`,
        text: bodyText,
        images,
      });
    }

    if (!sections.length) throw new Error("No readable text or illustrations were found in this EPUB.");
    return {
      title,
      format: "EPUB",
      sections,
      assetUrls,
      notice: illustrationCount
        ? `${illustrationCount.toLocaleString()} inline illustration${illustrationCount === 1 ? "" : "s"} loaded with the EPUB.`
        : "EPUB loaded. No inline illustrations were found.",
    };
  } catch (error) {
    assetUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
}

async function parsePdf(file: File): Promise<ParsedBook> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const sections: BookSection[] = [];
  let emptyPages = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = normalizeText(
      content.items
        .flatMap((item) => {
          if (!("str" in item)) return [];
          return [`${item.str}${item.hasEOL ? "\n" : " "}`];
        })
        .join(""),
    );
    if (!text) emptyPages += 1;
    sections.push({ id: `page-${pageNumber}`, title: `Page ${pageNumber}`, text });
  }

  const notice = emptyPages
    ? `${emptyPages} page${emptyPages === 1 ? "" : "s"} contained no selectable text. Scanned pages require OCR, which is not included yet.`
    : undefined;
  return { title: stripExtension(file.name), format: "PDF", sections, notice };
}

export async function parseBookFile(file: File): Promise<ParsedBook> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt") {
    const text = decodeText(await file.arrayBuffer());
    return {
      title: stripExtension(file.name),
      format: "TXT",
      sections: splitTextSections(text),
    };
  }
  if (extension === "epub") return parseEpub(file);
  if (extension === "pdf") return parsePdf(file);
  throw new Error("Supported formats are TXT, EPUB, and PDF.");
}
