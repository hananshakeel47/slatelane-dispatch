const BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services";

export async function getCarrier(dot: string) {
  const apiKey = process.env.FMCSA_API_KEY;

  if (!apiKey) {
    throw new Error("FMCSA API key missing.");
  }

  const url =
    `${BASE_URL}/carriers/${dot}?webKey=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("FMCSA API request failed.");
  }

  return response.json();
}