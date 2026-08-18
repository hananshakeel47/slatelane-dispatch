import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

export async function extractFMCSAZip(
  zipPath: string
): Promise<string> {
  const extractPath = path.join(
    process.cwd(),
    "uploads",
    "extracted"
  );

  if (fs.existsSync(extractPath)) {
    fs.rmSync(extractPath, {
      recursive: true,
      force: true,
    });
  }

  fs.mkdirSync(extractPath, {
    recursive: true,
  });

  const zip = new AdmZip(zipPath);

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const entryName = entry.entryName.replace(
      /\\/g,
      "/"
    );

    const destination = path.resolve(
      extractPath,
      entryName
    );

    if (
      !destination.startsWith(
        path.resolve(extractPath) + path.sep
      )
    ) {
      throw new Error(
        `Unsafe ZIP entry detected: ${entryName}`
      );
    }

    fs.mkdirSync(
      path.dirname(destination),
      { recursive: true }
    );

    fs.writeFileSync(
      destination,
      entry.getData()
    );
  }

  return extractPath;
}