// app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';

// VERY IMPORTANT: Change this to your own strong secret!
// Put THE SAME VALUE in Meta Developers → Verify token field
const VERIFY_TOKEN = "mysecret123";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta!");
    // Must return the challenge value as plain text
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.log("Verification failed - wrong token or mode");
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // For debugging - you will see this in terminal / Vercel logs
    console.log("Incoming WhatsApp webhook:", JSON.stringify(body, null, 2));

    // Basic structure check (WhatsApp Cloud API format)
    if (body?.object === "whatsapp_business_account") {
      const change = body.entry?.[0]?.changes?.[0];

      if (change?.field === "messages") {
        const message = change.value.messages?.[0];

        if (message) {
          const from = message.from; // customer's phone number (e.g. "919876543210")
          const type = message.type || "unknown";
          const text = message.text?.body || "no text message";

          console.log(`📩 New message from ${from} (${type}): ${text}`);

          // === Forward to your Spring Boot backend ===
          // Change this URL to your real Spring Boot address
          // Local dev: http://localhost:8080
          // Production: https://your-spring-app.com
          const springBootUrl = "http://localhost:8080/api/whatsapp/incoming";

          await fetch(springBootUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from,
              type,
              text,
              timestamp: message.timestamp,
              fullPayload: body, // optional: send everything for later use
            }),
          }).catch(err => {
            console.error("Failed to forward to Spring Boot:", err);
          });
        }
      }
    }

    // ALWAYS return 200 OK quickly - Meta requires this!
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Still return 200 - very important for WhatsApp Cloud API
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 200 });
  }
}

// Optional: Increase body size limit if you expect images/documents later
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};