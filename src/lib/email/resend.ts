import { Resend } from "resend";

let client: Resend | null = null;

export function getResendClient() {
  if (client) {
    return client;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  client = new Resend(apiKey);

  return client;
}

export function getEmailConfig() {
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  const replyTo = process.env.RESEND_REPLY_TO || null;

  const publicUrl = process.env.SLATELANE_PUBLIC_URL;

  const senderName =
    process.env.SLATELANE_SENDER_NAME ||
    "SlateLane Dispatch";

  const businessAddress =
    process.env.SLATELANE_BUSINESS_ADDRESS;

  const inboundDomain =
    process.env.RESEND_INBOUND_DOMAIN;

  if (!fromEmail) {
    throw new Error("Missing RESEND_FROM_EMAIL.");
  }

  if (!publicUrl) {
    throw new Error("Missing SLATELANE_PUBLIC_URL.");
  }

  if (!businessAddress) {
    throw new Error("Missing SLATELANE_BUSINESS_ADDRESS.");
  }

  if (!inboundDomain) {
    throw new Error("Missing RESEND_INBOUND_DOMAIN.");
  }

  return {
    fromEmail,

    replyTo,

    publicUrl: publicUrl.replace(/\/+$/, ""),

    senderName,

    businessAddress,

    inboundDomain: inboundDomain
      .trim()
      .toLowerCase(),
  };
}