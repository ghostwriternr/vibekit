import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  console.log("Checking URL", url);

  try {
    const response = await fetch(url);
    console.log("Response", response.status);
    const available = response.status >= 200 && response.status < 400;
    return NextResponse.json({ available });
  } catch (error) {
    console.error("Error fetching URL:", error);
    return NextResponse.json(
      {
        available: false,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
