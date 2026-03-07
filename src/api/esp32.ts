import { POD_HOLDER_URL } from "../utils/constants";

export const fetchCsvFiles = async (
  retries = 5,
  delayMs = 1500
): Promise<string[]> => {
  console.log("📡 fetchCsvFiles → calling Podholder /files");

  try {
    const res = await fetch(`${POD_HOLDER_URL}/files`);

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
  }
};

export const downloadCsv = async (filename: string): Promise<string> => {
  try {
    // FIXED: Use query param ?file=
    const res = await fetch(`${POD_HOLDER_URL}/download?file=${encodeURIComponent(filename)}`);
    const text = await res.text();

    if (!res.ok || !text) {
      throw new Error("CSV download failed");
    }

    return text;
  } catch (e: any) {
    throw e;
  }
};

export const uploadCsv = async (filename: string, csvText: string): Promise<void> => {
  try {
    // FIXED: Use query param ?file=
    const res = await fetch(`${POD_HOLDER_URL}/upload?file=${encodeURIComponent(filename)}`, {
      method: "POST",
      body: csvText, // Sending raw text
      headers: {
        "Content-Type": "text/csv",
      }
    });

    if (!res.ok) {
      throw new Error("CSV upload failed");
    }
  } catch (e: any) {
    throw e;
  }
};

export const sendTrigger = async (): Promise<void> => {
  console.log("📡 sendTrigger → calling Podholder GET /send");

  try {
    const res = await fetch(`${POD_HOLDER_URL}/send`, {
      method: "GET",
    });

    if (!res.ok) {
      console.error(`❌ Podholder response NOT OK: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to send trigger to Podholder: ${res.status} ${res.statusText}`);
    }

    console.log("✅ Podholder trigger message sent successfully");
  } catch (err: any) {
    console.error("📡 Trigger failed:", err);
    throw err;
  }
};

export const triggerDeviceProcessing = async (): Promise<string> => {
  console.log("⚡ triggerDeviceProcessing → calling Podholder POST /trigger");

  try {
    const res = await fetch(`${POD_HOLDER_URL}/trigger`, {
      method: "POST",
    });

    const text = await res.text();

    if (!res.ok) {
      console.error(`❌ Processing Trigger failed on device: ${text}`);
      throw new Error(`Trigger failed: ${text}`);
    }

    console.log("✅ Device response received:", text);
    return text;
  } catch (err: any) {
    console.error("⚡ Trigger Error:", err);
    throw err;
  }
};
