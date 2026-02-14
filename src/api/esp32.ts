import { POD_HOLDER_URL } from "../utils/constants";

export const fetchCsvFiles = async (
  retries = 5,
  delayMs = 1500
): Promise<string[]> => {
  console.log("📡 fetchCsvFiles → calling Podholder /files");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8 seconds

  try {
    const res = await fetch(`${POD_HOLDER_URL}/files`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error("Podholder responded but not OK");
    }

    const text = await res.text();
    const parsed = JSON.parse(text);
    console.log("✅ Podholder files:", parsed);

    return parsed;
  } catch (e: any) {
    if (retries > 0) {
      console.log(`🔁 Podholder not ready, retrying (${retries})...`);
      await new Promise(r => setTimeout(() => r(undefined), delayMs));
      return fetchCsvFiles(retries - 1, delayMs);
    }

    console.log("❌ Podholder unreachable after retries");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
};

export const downloadCsv = async (filename: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // FIXED: Use query param ?file=
    const res = await fetch(`${POD_HOLDER_URL}/download?file=${encodeURIComponent(filename)}`, {
      signal: controller.signal
    });
    const text = await res.text();

    if (!res.ok || !text) {
      throw new Error("CSV download failed");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
};

export const uploadCsv = async (filename: string, csvText: string): Promise<void> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // FIXED: Use query param ?file=
    const res = await fetch(`${POD_HOLDER_URL}/upload?file=${encodeURIComponent(filename)}`, {
      method: "POST",
      body: csvText, // Sending raw text
      headers: {
        "Content-Type": "text/csv",
      },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error("CSV upload failed");
    }
  } finally {
    clearTimeout(timeout);
  }
};

export const sendTrigger = async (): Promise<void> => {
  console.log("📡 sendTrigger → calling Podholder GET /send");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 seconds (increased from 3s)

  try {
    const res = await fetch(`${POD_HOLDER_URL}/send`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Failed to send trigger to Podholder: ${res.status} ${res.statusText}`);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error("📡 Trigger Timed Out (10s)");
    } else {
      console.error("📡 Trigger failed:", err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

export const triggerDeviceProcessing = async (): Promise<string> => {
  console.log("⚡ triggerDeviceProcessing → calling Podholder POST /trigger");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 seconds (increased from 15s)

  try {
    const res = await fetch(`${POD_HOLDER_URL}/trigger`, {
      method: "POST",
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Trigger failed: ${text}`);
    }

    console.log("✅ Device response received");
    return text;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error("⚡ Processing Timed Out (30s)");
    } else {
      console.error("⚡ Trigger Error:", err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};
