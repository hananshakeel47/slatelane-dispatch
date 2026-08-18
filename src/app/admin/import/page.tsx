"use client";

import { useState } from "react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Ready");

  async function uploadFile() {
    if (!file) {
      setStatus("Select a ZIP file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setStatus("Uploading...");

    const res = await fetch("/api/fmcsa/import", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    setStatus(data.message);
  }

  return (
    <div className="space-y-6">

      <h1 className="text-4xl font-bold">
        FMCSA Import
      </h1>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8">

        <h2 className="text-2xl font-semibold">
          Upload FMCSA ZIP
        </h2>

        <p className="mt-2 text-zinc-400">
          Upload the official FMCSA ZIP database.
        </p>

        <input
          type="file"
          accept=".zip"
          className="mt-6 block"
          onChange={(e) => {
            if (e.target.files?.length) {
              setFile(e.target.files[0]);
            }
          }}
        />

        <button
          onClick={uploadFile}
          className="mt-6 rounded-lg bg-sky-500 px-6 py-3 font-medium hover:bg-sky-600"
        >
          Upload
        </button>

        <div className="mt-8 rounded-lg bg-black p-4">
          <p>Status</p>

          <p className="mt-2 font-semibold text-green-400">
            {status}
          </p>
        </div>

      </div>

    </div>
  );
}