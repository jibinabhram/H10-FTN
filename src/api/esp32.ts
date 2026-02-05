const ESP32_IP = "192.168.4.1";

export const fetchCsvFiles = async (
  retries = 5,
  delayMs = 1000
): Promise<string[]> => {
  console.log("📡 fetchCsvFiles → calling ESP32 /receive");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(`http://${ESP32_IP}/receive`, {
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error("ESP32 responded but not OK");
    }

    const parsed = JSON.parse(text);
    console.log("✅ ESP32 files:", parsed);

    return parsed;
  } catch (e: any) {
    if (retries > 0) {
      console.log(`🔁 ESP32 not ready, retrying (${retries})`);
      await new Promise(r => setTimeout(() => r(undefined), delayMs));
      return fetchCsvFiles(retries - 1, delayMs);
    }

    console.log("❌ ESP32 unreachable after retries");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
};

export const downloadCsv = async (filename: string): Promise<string> => {
  const res = await fetch(
    `http://${ESP32_IP}/download?file=${encodeURIComponent(filename)}`
  );
  const text = await res.text();

  if (!res.ok || !text) {
    throw new Error("CSV download failed");
  }

  return text;
};
export const uploadCsv = async (filename: string, csvText: string): Promise<void> => {
  const res = await fetch(
    `http://${ESP32_IP}/upload?file=${encodeURIComponent(filename)}`,
    {
      method: "POST",
      body: csvText,
      headers: {
        "Content-Type": "text/csv",
      },
    }
  );

  if (!res.ok) {
    throw new Error("CSV upload failed");
  }
};
export const sendTrigger = async (): Promise<void> => {
  console.log("📡 sendTrigger → calling ESP32 GET /send");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000); // 3-second timeout

  try {
    const res = await fetch(`http://${ESP32_IP}/send`, {
      method: "GET", // Matches server.on("/send", HTTP_GET...)
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error("Failed to send trigger to ESP32");
    }
  } catch (err) {
    console.error("📡 Trigger failed:", err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};
