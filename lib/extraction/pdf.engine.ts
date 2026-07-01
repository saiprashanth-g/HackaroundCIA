// lib/extraction/pdf.engine.ts
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPDF(buffer: Buffer): Promise<string> {
  // Use data array directly; legacy build handles the Node environment gracefully
  const loadingTask = pdfjsLib.getDocument({ 
    data: new Uint8Array(buffer),
    useSystemArr: true,
    disableWorker: true // Prevents spinning up browser workers in a Node context
  });

  const pdf = await loadingTask.promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Extract text items and join them with spaces
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
      
    text += pageText + "\n";
  }

  return text;
}