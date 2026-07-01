import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Missing file payload in request." },
        { status: 400 }
      );
    }

    if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Invalid file type. This endpoint only accepts PDFs." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bufferView = new Uint8Array(arrayBuffer);
    const pdfDocument = await getDocumentProxy(bufferView);
    const { text } = await extractText(pdfDocument, { mergePages: true });

    let parsedText = "";
    if (Array.isArray(text)) {
      parsedText = text.join("\n");
    } else if (typeof text === "string") {
      parsedText = text;
    }

    return NextResponse.json({ 
      success: true,
      text: parsedText 
    });

  } catch (error: any) {
    console.error("❌ [CRITICAL ENGINE FAILURE]:", error);
    return NextResponse.json(
      { 
        error: "Internal extraction engine crash.", 
        details: error.message || String(error) 
      },
      { status: 500 }
    );
  }
}
