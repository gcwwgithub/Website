import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const booksDirectory = path.resolve("public/books");
const sourceDataDirectory = path.resolve("data");
const publicDataDirectory = path.resolve("public/data");
const manifestPath = path.join(booksDirectory, "manifest.json");
const supportedExtensions = new Map([
  [".txt", "TXT"],
  [".epub", "EPUB"],
  [".pdf", "PDF"],
]);

function titleFromFile(file) {
  return path
    .basename(file, path.extname(file))
    .replace(/[+_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function idFromFile(file) {
  return encodeURIComponent(file)
    .replace(/%/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const files = await readdir(booksDirectory);
const books = files
  .filter((file) => file.toLowerCase() !== "manifest.json")
  .flatMap((file) => {
    const extension = path.extname(file).toLowerCase();
    const format = supportedExtensions.get(extension);
    if (!format) return [];

    return [{
      id: idFromFile(file),
      title: titleFromFile(file),
      format,
      file,
    }];
  })
  .sort((left, right) => left.title.localeCompare(right.title));

await writeFile(manifestPath, `${JSON.stringify(books, null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(process.cwd(), manifestPath)} with ${books.length} book${books.length === 1 ? "" : "s"}.`);

await mkdir(publicDataDirectory, { recursive: true });
for (const file of ["CN.csv", "CV.csv", "translations.json", "translation.json"]) {
  try {
    await copyFile(path.join(sourceDataDirectory, file), path.join(publicDataDirectory, file));
    console.log(`Copied ${path.join("data", file)} to ${path.join("public", "data", file)}.`);
  } catch {
    // Optional fallback filenames are skipped when absent.
  }
}
