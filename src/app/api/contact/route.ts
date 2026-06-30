import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { name, email, phone, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Please fill all required fields." },
        { status: 400 }
      );
    }

    await resend.emails.send({
      from: "SlateLane Dispatch <contact@slatelanedispatch.com>",
      to: ["contact@slatelanedispatch.com"],
      replyTo: email,
      subject: `🚛 New Dispatch Lead - ${name}`,
      html: `
      <div style="font-family:Arial;padding:30px;background:#0f172a;color:white">
          <h1 style="color:#38bdf8">New Website Lead</h1>

          <hr>

          <p><strong>Name</strong><br>${name}</p>

          <p><strong>Email</strong><br>${email}</p>

          <p><strong>Phone</strong><br>${phone || "-"}</p>

          <p><strong>Message</strong></p>

          <div style="padding:15px;background:#1e293b;border-radius:8px">
          ${message}
          </div>

      </div>
      `,
    });

    await resend.emails.send({
      from: "SlateLane Dispatch <contact@slatelanedispatch.com>",
      to: [email],
      subject: "We received your request | SlateLane Dispatch",
      html: `
      <div style="font-family:Arial;padding:30px">

      <h2>Hi ${name},</h2>

      <p>

      Thank you for contacting <strong>SlateLane Dispatch</strong>.

      We received your request successfully.

      One of our dispatch specialists will contact you shortly.

      </p>

      <br>

      <strong>SlateLane Dispatch</strong><br>

      contact@slatelanedispatch.com

      </div>
      `,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}