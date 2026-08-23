import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  createServerSupabase,
} from "@/lib/supabase/server";


type Props = {
  params:
    Promise<{
      id: string;
    }>;
};


type TimelineItem =
  | {
      id: string;

      type:
        "outgoing";

      date: string;

      subject:
        string | null;

      status:
        string;

      email:
        string;

      error:
        string | null;
    }
  | {
      id: string;

      type:
        "reply";

      date: string;

      subject:
        string | null;

      text:
        string | null;

      email:
        string;

      attachments:
        number;
    };


function prettyStatus(
  value:
    string | null
) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        char
      ) =>
        char.toUpperCase()
    );
}


function statusClasses(
  status:
    string | null
) {
  switch (status) {
    case "client":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";

    case "interested":
    case "meeting":
      return "border-blue-800 bg-blue-950 text-blue-300";

    case "follow_up":
      return "border-amber-800 bg-amber-950 text-amber-300";

    case "not_interested":
      return "border-red-900 bg-red-950 text-red-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}


function emailStatusClasses(
  status:
    string
) {
  switch (status) {
    case "delivered":
      return "border-emerald-800 bg-emerald-950 text-emerald-300";

    case "sent":
      return "border-blue-800 bg-blue-950 text-blue-300";

    case "bounced":
    case "failed":
    case "complained":
    case "suppressed":
      return "border-red-900 bg-red-950 text-red-300";

    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}


function formatDate(
  date:
    string | null
) {
  if (!date) {
    return "—";
  }

  return new Date(
    date
  ).toLocaleString();
}


export default async function LeadConversationPage({
  params,
}: Props) {
  const {
    id,
  } =
    await params;


  const supabase =
    createServerSupabase();


  // ==========================================================
  // LEAD
  // ==========================================================

  const {
    data: lead,
    error:
      leadError,
  } = await supabase
    .from("leads")
    .select(`
      id,
      name,
      company_name,
      email,
      phone,
      carrier_dot_number,
      mc_number,
      source,
      status,

      email_opt_out,
      email_bounced,
      email_complained,

      has_replied,
      reply_count,
      last_reply_at,
      last_reply_from,
      last_reply_subject,

      last_email_sent_at,
      created_at
    `)
    .eq(
      "id",
      id
    )
    .maybeSingle();


  if (
    leadError ||
    !lead
  ) {
    notFound();
  }


  // ==========================================================
  // OUTGOING EMAILS
  // ==========================================================

  const {
    data:
      emailSends,
  } = await supabase
    .from(
      "email_sends"
    )
    .select(`
      id,
      to_email,
      subject,
      status,
      sent_at,
      delivered_at,
      bounced_at,
      failed_at,
      error_message,
      created_at
    `)
    .eq(
      "lead_id",
      lead.id
    )
    .order(
      "created_at",
      {
        ascending:
          true,
      }
    );


  // ==========================================================
  // INBOUND REPLIES
  // ==========================================================

  const {
    data:
      emailReplies,
  } = await supabase
    .from(
      "email_replies"
    )
    .select(`
      id,
      from_email,
      subject,
      text_body,
      attachment_count,
      received_at,
      created_at
    `)
    .eq(
      "lead_id",
      lead.id
    )
    .order(
      "received_at",
      {
        ascending:
          true,
      }
    );


  // ==========================================================
  // SEQUENCE
  // ==========================================================

  const {
    data:
      enrollment,
  } = await supabase
    .from(
      "email_sequence_enrollments"
    )
    .select(`
      id,
      status,
      current_step,
      next_send_at,
      started_at,
      completed_at,
      stopped_at
    `)
    .eq(
      "lead_id",
      lead.id
    )
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    )
    .limit(1)
    .maybeSingle();


  // ==========================================================
  // MERGE TIMELINE
  // ==========================================================

  const timeline:
    TimelineItem[] = [];


  for (
    const send
    of emailSends ?? []
  ) {
    timeline.push({
      id:
        send.id,

      type:
        "outgoing",

      date:
        send.sent_at ||
        send.created_at,

      subject:
        send.subject,

      status:
        send.status,

      email:
        send.to_email,

      error:
        send.error_message,
    });
  }


  for (
    const reply
    of emailReplies ?? []
  ) {
    timeline.push({
      id:
        reply.id,

      type:
        "reply",

      date:
        reply.received_at ||
        reply.created_at,

      subject:
        reply.subject,

      text:
        reply.text_body,

      email:
        reply.from_email,

      attachments:
        reply.attachment_count ??
        0,
    });
  }


  timeline.sort(
    (
      a,
      b
    ) =>
      new Date(
        a.date
      ).getTime() -
      new Date(
        b.date
      ).getTime()
  );


  const displayName =
    lead.company_name ||
    lead.name ||
    lead.email ||
    "Lead";


  return (
    <div className="space-y-8">

      {/* TOP NAV */}

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <Link
            href="/admin/replies"
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Back to Replies
          </Link>

          <h1 className="mt-3 text-4xl font-bold">
            {displayName}
          </h1>

          <p className="mt-2 text-zinc-400">
            Complete SlateLane email conversation history.
          </p>

        </div>


        <div className="flex flex-wrap gap-3">

          {lead.carrier_dot_number && (

            <Link
              href={`/admin/carriers/${lead.carrier_dot_number}`}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold hover:bg-zinc-800"
            >
              View Carrier
            </Link>

          )}


          {lead.email && (

            <a
              href={`mailto:${lead.email}`}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200"
            >
              Send Manual Email
            </a>

          )}

        </div>

      </div>


      {/* SUMMARY */}

      <div className="grid gap-4 xl:grid-cols-4">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Lead Status
          </div>

          <div className="mt-3">

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusClasses(
                lead.status
              )}`}
            >
              {prettyStatus(
                lead.status
              )}
            </span>

          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Replies
          </div>

          <div className="mt-2 text-3xl font-bold text-emerald-300">
            {lead.reply_count ??
              0}
          </div>

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Sequence
          </div>

          <div className="mt-2 text-xl font-bold">
            {enrollment
              ? prettyStatus(
                  enrollment.status
                )
              : "Not Started"}
          </div>

          {enrollment && (

            <div className="mt-1 text-xs text-zinc-500">
              Step{" "}
              {
                enrollment.current_step
              }
            </div>

          )}

        </div>


        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-5">

          <div className="text-xs uppercase text-zinc-500">
            Last Reply
          </div>

          <div className="mt-2 text-sm font-semibold">
            {formatDate(
              lead.last_reply_at
            )}
          </div>

        </div>

      </div>


      <div className="grid gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">

        {/* CONTACT SIDEBAR */}

        <aside className="space-y-5">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">

            <h2 className="text-lg font-semibold">
              Contact
            </h2>


            <div className="mt-5 space-y-4 text-sm">

              <div>

                <div className="text-xs uppercase text-zinc-600">
                  Email
                </div>

                <div className="mt-1 break-all text-zinc-300">
                  {lead.email ||
                    "—"}
                </div>

              </div>


              <div>

                <div className="text-xs uppercase text-zinc-600">
                  Phone
                </div>

                <div className="mt-1 text-zinc-300">
                  {lead.phone ||
                    "—"}
                </div>

              </div>


              <div>

                <div className="text-xs uppercase text-zinc-600">
                  DOT
                </div>

                <div className="mt-1 text-zinc-300">
                  {lead.carrier_dot_number ||
                    "—"}
                </div>

              </div>


              <div>

                <div className="text-xs uppercase text-zinc-600">
                  MC
                </div>

                <div className="mt-1 text-zinc-300">
                  {lead.mc_number ||
                    "—"}
                </div>

              </div>


              <div>

                <div className="text-xs uppercase text-zinc-600">
                  Source
                </div>

                <div className="mt-1 text-zinc-300">
                  {prettyStatus(
                    lead.source
                  )}
                </div>

              </div>

            </div>

          </div>


          {/* AUTOMATION SAFETY */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">

            <h2 className="text-lg font-semibold">
              Email Safety
            </h2>


            <div className="mt-5 space-y-3 text-sm">

              <div className="flex items-center justify-between">

                <span className="text-zinc-400">
                  Replied
                </span>

                <span
                  className={
                    lead.has_replied
                      ? "text-emerald-400"
                      : "text-zinc-500"
                  }
                >
                  {lead.has_replied
                    ? "Yes ✓"
                    : "No"}
                </span>

              </div>


              <div className="flex items-center justify-between">

                <span className="text-zinc-400">
                  Unsubscribed
                </span>

                <span
                  className={
                    lead.email_opt_out
                      ? "text-red-400"
                      : "text-zinc-500"
                  }
                >
                  {lead.email_opt_out
                    ? "Yes"
                    : "No"}
                </span>

              </div>


              <div className="flex items-center justify-between">

                <span className="text-zinc-400">
                  Bounced
                </span>

                <span
                  className={
                    lead.email_bounced
                      ? "text-red-400"
                      : "text-zinc-500"
                  }
                >
                  {lead.email_bounced
                    ? "Yes"
                    : "No"}
                </span>

              </div>


              <div className="flex items-center justify-between">

                <span className="text-zinc-400">
                  Complaint
                </span>

                <span
                  className={
                    lead.email_complained
                      ? "text-red-400"
                      : "text-zinc-500"
                  }
                >
                  {lead.email_complained
                    ? "Yes"
                    : "No"}
                </span>

              </div>

            </div>

          </div>

        </aside>


        {/* CONVERSATION */}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35">

          <div className="border-b border-zinc-800 px-6 py-5">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-semibold">
                  Conversation
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {
                    timeline.length
                  }{" "}
                  email event
                  {timeline.length ===
                  1
                    ? ""
                    : "s"}
                </p>

              </div>


              {lead.has_replied && (

                <span className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Automation stopped
                </span>

              )}

            </div>

          </div>


          <div className="space-y-6 p-6">

            {timeline.map(
              (
                item
              ) => {

                if (
                  item.type ===
                  "reply"
                ) {
                  return (

                    <div
                      key={`reply-${item.id}`}
                      className="flex justify-start"
                    >

                      <div className="max-w-[82%] rounded-2xl rounded-tl-md border border-emerald-900 bg-emerald-950/45 p-5">

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="font-semibold text-emerald-300">
                            Carrier Reply
                          </span>

                          <span className="text-xs text-zinc-500">
                            {formatDate(
                              item.date
                            )}
                          </span>

                        </div>


                        <div className="mt-1 text-xs text-zinc-500">
                          From{" "}
                          {item.email}
                        </div>


                        {item.subject && (

                          <div className="mt-4 font-semibold">
                            {item.subject}
                          </div>

                        )}


                        <div className="mt-3 whitespace-pre-wrap break-words leading-7 text-zinc-200">
                          {item.text ||
                            "Reply contained no plain-text body."}
                        </div>


                        {item.attachments >
                          0 && (

                          <div className="mt-4 text-xs text-zinc-400">
                            📎{" "}
                            {
                              item.attachments
                            }{" "}
                            attachment
                            {item.attachments ===
                            1
                              ? ""
                              : "s"}
                          </div>

                        )}

                      </div>

                    </div>

                  );
                }


                return (

                  <div
                    key={`send-${item.id}`}
                    className="flex justify-end"
                  >

                    <div className="max-w-[82%] rounded-2xl rounded-tr-md border border-blue-900 bg-blue-950/35 p-5">

                      <div className="flex flex-wrap items-center gap-2">

                        <span className="font-semibold text-blue-300">
                          SlateLane
                        </span>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${emailStatusClasses(
                            item.status
                          )}`}
                        >
                          {prettyStatus(
                            item.status
                          )}
                        </span>

                      </div>


                      <div className="mt-1 text-xs text-zinc-500">
                        {formatDate(
                          item.date
                        )}
                      </div>


                      <div className="mt-4 font-semibold">
                        {item.subject ||
                          "(No subject)"}
                      </div>


                      <div className="mt-2 text-sm text-zinc-400">
                        Sent to{" "}
                        {item.email}
                      </div>


                      {item.error && (

                        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
                          {item.error}
                        </div>

                      )}

                    </div>

                  </div>

                );
              }
            )}


            {timeline.length ===
              0 && (

              <div className="py-20 text-center">

                <div className="text-4xl">
                  💬
                </div>

                <h3 className="mt-4 text-lg font-semibold">
                  No conversation yet
                </h3>

                <p className="mt-2 text-sm text-zinc-500">
                  Email activity will appear here.
                </p>

              </div>

            )}

          </div>

        </section>

      </div>

    </div>
  );
}