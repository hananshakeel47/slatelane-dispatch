import fs from "fs";
import path from "path";

const FMCSA_URL =
  "https://ai.fmcsa.dot.gov/SMS/Tools/Downloads.aspx?download=SAFER";

export async function downloadFMCSAData() {
  const dataDir = path.join(process.cwd(), "data");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const zipPath = path.join(dataDir, "fmcsa.zip");

  console.log("Downloading FMCSA database...");

  const response = await fetch(FMCSA_URL);

  if (!response.ok) {
    throw new Error("Failed to download FMCSA database.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  fs.writeFileSync(zipPath, buffer);

  console.log("Download complete.");

  return zipPath;
}