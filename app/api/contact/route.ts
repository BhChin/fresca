import { NextResponse } from "next/server";
import { z } from "zod";
import { contactSchema, HONEYPOT } from "@/lib/contact";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Bots fill every field. Pretend it worked and drop it.
  if (typeof body?.[HONEYPOT] === "string" && body[HONEYPOT] !== "") {
    return NextResponse.json({ ok: true });
  }

  const result = contactSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ ok: false, fieldErrors: z.flattenError(result.error).fieldErrors }, { status: 400 });
  }

  // TODO(resend): send the inquiry by email once the client confirms the inbox.
  //   1. npm i resend
  //   2. Set RESEND_API_KEY and CONTACT_TO_EMAIL (see .env.example) in Vercel.
  //   3. const resend = new Resend(process.env.RESEND_API_KEY);
  //      await resend.emails.send({
  //        from: "Fresca website <website@your-verified-domain>",
  //        to: process.env.CONTACT_TO_EMAIL!,
  //        replyTo: result.data.email,
  //        subject: `New inquiry from ${result.data.name}`,
  //        text: result.data.message,
  //      });
  //      Return a 502 if the send fails so the form shows its error message.
  console.log("[contact] new inquiry", { ...result.data, receivedAt: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
