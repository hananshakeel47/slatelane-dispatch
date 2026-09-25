"use client";


import {
  useEffect,
  useMemo,
  useState,
} from "react";


type Prospect = {
  id: string;

  linkedin_url:
    string;

  first_name:
    string | null;

  last_name:
    string | null;

  company_name:
    string | null;

  job_title:
    string | null;

  location:
    string | null;

  email:
    string | null;

  phone:
    string | null;

  carrier_dot_number:
    number | null;

  lead_id:
    string | null;

  status:
    string;

  connection_requested_at:
    string | null;

  connected_at:
    string | null;

  first_message_at:
    string | null;

  last_message_at:
    string | null;

  next_followup_at:
    string | null;

  replied_at:
    string | null;

  reply_text:
    string | null;

  last_step_sent:
    number;

  qualified_at:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};


type Template = {
  step_number:
    number;

  template_name:
    string;

  message_body:
    string;
};


type Status = {
  enabled:
    boolean;

  daily_connection_target:
    number;

  daily_followup_target:
    number;

  max_open_prospects:
    number;

  new_prospects:
    number;

  pending_connections:
    number;

  connected:
    number;

  messaged:
    number;

  active_conversations:
    number;

  replies:
    number;

  qualified:
    number;

  followups_due:
    number;

  connections_requested_today:
    number;

  messages_sent_today:
    number;

  do_not_contact:
    number;
};


const inputClass =
  `
    w-full
    rounded-xl
    border
    border-zinc-800
    bg-zinc-950
    px-3.5
    py-3
    text-sm
    text-white
    outline-none
    transition
    placeholder:text-zinc-700
    focus:border-sky-700
  `;


const buttonBase =
  `
    inline-flex
    items-center
    justify-center
    rounded-xl
    px-4
    py-2.5
    text-xs
    font-bold
    transition
    disabled:cursor-not-allowed
    disabled:opacity-50
  `;


const emptyStatus:
  Status = {

    enabled:
      true,

    daily_connection_target:
      20,

    daily_followup_target:
      20,

    max_open_prospects:
      300,

    new_prospects:
      0,

    pending_connections:
      0,

    connected:
      0,

    messaged:
      0,

    active_conversations:
      0,

    replies:
      0,

    qualified:
      0,

    followups_due:
      0,

    connections_requested_today:
      0,

    messages_sent_today:
      0,

    do_not_contact:
      0,
  };


function nameOf(
  prospect:
    Prospect,
) {

  const name =
    [
      prospect.first_name,
      prospect.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();


  return (
    name ||
    prospect.company_name ||
    "LinkedIn Prospect"
  );
}


function renderMessage(
  text:
    string,

  prospect:
    Prospect,
) {

  return text
    .replaceAll(
      "{{first_name}}",

      prospect.first_name ||
        "there",
    )
    .replaceAll(
      "{{company_name}}",

      prospect.company_name ||
        "your company",
    );
}


function formatDate(
  value:
    string | null,
) {

  if (
    !value
  ) {
    return "—";
  }


  const date =
    new Date(
      value,
    );


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    },
  ).format(
    date,
  );
}


function isDue(
  value:
    string | null,
) {

  if (
    !value
  ) {
    return false;
  }


  const date =
    new Date(
      value,
    );


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return false;
  }


  return (
    date.getTime() <=
    Date.now()
  );
}


function statusLabel(
  value:
    string,
) {

  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,

      (
        letter,
      ) =>
        letter.toUpperCase(),
    );
}


function statusClasses(
  status:
    string,
) {

  switch (
    status
  ) {

    case "qualified":
      return `
        border-emerald-900
        bg-emerald-950/30
        text-emerald-300
      `;


    case "replied":
      return `
        border-violet-900
        bg-violet-950/30
        text-violet-300
      `;


    case "messaged":
      return `
        border-cyan-900
        bg-cyan-950/30
        text-cyan-300
      `;


    case "connected":
      return `
        border-blue-900
        bg-blue-950/30
        text-blue-300
      `;


    case "connection_pending":
      return `
        border-amber-900
        bg-amber-950/30
        text-amber-300
      `;


    case "not_interested":
      return `
        border-red-900
        bg-red-950/30
        text-red-300
      `;


    default:
      return `
        border-zinc-700
        bg-zinc-900
        text-zinc-300
      `;
  }
}


function MetricCard({
  label,
  value,
  note,
  tone =
    "normal",
}: {
  label:
    string;

  value:
    string | number;

  note:
    string;

  tone?:
    "normal" |
    "good" |
    "warn" |
    "sky";
}) {

  const valueClass =
    tone ===
      "good"
      ? "text-emerald-300"

      : tone ===
          "warn"
        ? "text-amber-300"

        : tone ===
            "sky"
          ? "text-sky-300"

          : "text-white";


  return (

    <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-5">

      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>


      <div
        className={`
          mt-3
          text-3xl
          font-bold
          ${valueClass}
        `}
      >
        {value}
      </div>


      <div className="mt-2 text-xs leading-5 text-zinc-500">
        {note}
      </div>

    </div>
  );
}


export default function LinkedInPage() {

  const [
    prospects,
    setProspects,
  ] =
    useState<
      Prospect[]
    >([]);


  const [
    templates,
    setTemplates,
  ] =
    useState<
      Template[]
    >([]);


  const [
    status,
    setStatus,
  ] =
    useState<
      Status
    >(
      emptyStatus,
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );


  const [
    busyId,
    setBusyId,
  ] =
    useState<
      string | null
    >(
      null,
    );


  const [
    message,
    setMessage,
  ] =
    useState(
      "",
    );


  const [
    messageTone,
    setMessageTone,
  ] =
    useState<
      "good" |
      "bad"
    >(
      "good",
    );


  const [
    showAdd,
    setShowAdd,
  ] =
    useState(
      false,
    );


  const [
    form,
    setForm,
  ] =
    useState({
      linkedin_url:
        "",

      first_name:
        "",

      last_name:
        "",

      company_name:
        "",

      job_title:
        "",

      location:
        "",

      email:
        "",

      phone:
        "",

      carrier_dot_number:
        "",
    });


  const templateMap =
    useMemo(
      () =>
        new Map(
          templates.map(
            (
              template,
            ) => [
              template.step_number,
              template,
            ],
          ),
        ),

      [
        templates,
      ],
    );


  async function load(
    silent =
      false,
  ) {

    try {

      if (
        !silent
      ) {
        setLoading(
          true,
        );
      }


      const response =
        await fetch(
          "/api/admin/linkedin",
          {
            cache:
              "no-store",
          },
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {

        throw new Error(
          data.message ||
            "Could not load LinkedIn outreach.",
        );
      }


      setProspects(
        data.prospects ??
          [],
      );


      setTemplates(
        data.templates ??
          [],
      );


      setStatus(
        data.status ??
          emptyStatus,
      );

    } catch (
      error
    ) {

      setMessageTone(
        "bad",
      );


      setMessage(
        error instanceof
        Error
          ? error.message
          : "Could not load LinkedIn outreach.",
      );

    } finally {

      if (
        !silent
      ) {
        setLoading(
          false,
        );
      }
    }
  }


  useEffect(
    () => {

      void load();


      const timer =
        window.setInterval(
          () => {

            void load(
              true,
            );

          },
          30000,
        );


      return () =>
        window.clearInterval(
          timer,
        );

    },
    [],
  );


  async function post(
    body:
      Record<
        string,
        unknown
      >,

    prospectId?:
      string,
  ) {

    try {

      setBusyId(
        prospectId ??
          "global",
      );


      const response =
        await fetch(
          "/api/admin/linkedin",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body,
              ),
          },
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {

        throw new Error(
          data.message ||
            "LinkedIn action failed.",
        );
      }


      setMessageTone(
        "good",
      );


      setMessage(
        data.message ||
          "LinkedIn outreach updated.",
      );


      await load(
        true,
      );


      return data;

    } catch (
      error
    ) {

      setMessageTone(
        "bad",
      );


      setMessage(
        error instanceof
        Error
          ? error.message
          : "LinkedIn action failed.",
      );


      return null;

    } finally {

      setBusyId(
        null,
      );
    }
  }


  async function addProspect() {

    if (
      !form.linkedin_url
        .toLowerCase()
        .includes(
          "linkedin.com/",
        )
    ) {

      setMessageTone(
        "bad",
      );


      setMessage(
        "Enter a valid LinkedIn profile URL.",
      );


      return;
    }


    const result =
      await post({
        mode:
          "create",

        ...form,
      });


    if (
      result
    ) {

      setForm({
        linkedin_url:
          "",

        first_name:
          "",

        last_name:
          "",

        company_name:
          "",

        job_title:
          "",

        location:
          "",

        email:
          "",

        phone:
          "",

        carrier_dot_number:
          "",
      });


      setShowAdd(
        false,
      );
    }
  }


  async function action(
    prospect:
      Prospect,

    actionName:
      string,

    extra:
      Record<
        string,
        unknown
      > = {},
  ) {

    await post(
      {
        mode:
          "action",

        prospect_id:
          prospect.id,

        action:
          actionName,

        ...extra,
      },

      prospect.id,
    );
  }


  async function copyStep(
    prospect:
      Prospect,

    step:
      number,
  ) {

    const template =
      templateMap.get(
        step,
      );


    if (
      !template
    ) {

      setMessageTone(
        "bad",
      );


      setMessage(
        `LinkedIn template step ${step} is missing.`,
      );


      return;
    }


    const text =
      renderMessage(
        template.message_body,
        prospect,
      );


    try {

      await navigator.clipboard.writeText(
        text,
      );


      setMessageTone(
        "good",
      );


      setMessage(
        `${template.template_name} copied. Send it on LinkedIn, then mark the action here.`,
      );

    } catch {

      setMessageTone(
        "bad",
      );


      setMessage(
        "Could not copy message automatically. Copy it manually from the sequence section.",
      );
    }
  }


  async function recordReply(
    prospect:
      Prospect,
  ) {

    const reply =
      window.prompt(
        "Paste the carrier's LinkedIn reply:",
        prospect.reply_text ||
          "",
      );


    if (
      !reply?.trim()
    ) {
      return;
    }


    await action(
      prospect,

      "reply_received",

      {
        reply_text:
          reply.trim(),
      },
    );
  }


  async function syncLead(
    prospect:
      Prospect,
  ) {

    let email =
      prospect.email ||
      "";


    if (
      !email
    ) {

      email =
        window.prompt(
          "Enter this qualified carrier's email:",
          "",
        ) ||
        "";
    }


    if (
      !email
        .trim()
        .includes("@")
    ) {

      setMessageTone(
        "bad",
      );


      setMessage(
        "A valid email is required to sync this LinkedIn prospect into CRM Leads.",
      );


      return;
    }


    await post(
      {
        mode:
          "sync",

        prospect_id:
          prospect.id,

        email:
          email.trim(),

        phone:
          prospect.phone ||
          "",
      },

      prospect.id,
    );
  }


  function getNextStep(
    prospect:
      Prospect,
  ) {

    if (
      prospect.status ===
      "connected"
    ) {
      return 1;
    }


    if (
      prospect.status ===
        "messaged" &&
      Number(
        prospect.last_step_sent ??
          0,
      ) < 4
    ) {

      return (
        Number(
          prospect.last_step_sent ??
            0,
        ) + 1
      );
    }


    return null;
  }


  const connectionPercent =
    Math.min(
      100,

      Math.round(
        (
          status.connections_requested_today /
          Math.max(
            status.daily_connection_target,
            1,
          )
        ) *
          100,
      ),
    );


  const priorityProspects =
    useMemo(
      () => {

        return prospects
          .filter(
            (
              prospect,
            ) => {

              if (
                prospect.status ===
                "replied"
              ) {
                return true;
              }


              if (
                prospect.status ===
                  "qualified" &&
                !prospect.lead_id
              ) {
                return true;
              }


              if (
                prospect.status ===
                "connected"
              ) {
                return true;
              }


              if (
                prospect.status ===
                  "messaged" &&
                isDue(
                  prospect.next_followup_at,
                )
              ) {
                return true;
              }


              if (
                prospect.status ===
                "new"
              ) {
                return true;
              }


              return false;
            },
          )
          .sort(
            (
              a,
              b,
            ) => {

              function score(
                prospect:
                  Prospect,
              ) {

                if (
                  prospect.status ===
                  "replied"
                ) {
                  return 0;
                }


                if (
                  prospect.status ===
                    "qualified" &&
                  !prospect.lead_id
                ) {
                  return 1;
                }


                if (
                  prospect.status ===
                  "connected"
                ) {
                  return 2;
                }


                if (
                  prospect.status ===
                    "messaged" &&
                  isDue(
                    prospect.next_followup_at,
                  )
                ) {
                  return 3;
                }


                return 4;
              }


              return (
                score(a) -
                score(b)
              );
            },
          );

      },
      [
        prospects,
      ],
    );


  if (
    loading
  ) {

    return (

      <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-10 text-sm text-zinc-400">

        Loading LinkedIn Outreach...

      </div>
    );
  }


  return (

    <div className="space-y-8">

      {/* HEADER */}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

        <div>

          <div className="text-xs font-bold uppercase tracking-[0.22em] text-sky-400">

            SlateLane Acquisition

          </div>


          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">

            LinkedIn Outreach

          </h1>


          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">

            Run LinkedIn prospecting beside your
            automated email acquisition system.
            Track connections, conversations,
            follow-ups, replies and qualified
            carrier opportunities inside SlateLane.

          </p>

        </div>


        <div className="flex flex-wrap gap-3">

          <button
            type="button"

            onClick={() =>
              setShowAdd(
                (
                  current,
                ) =>
                  !current,
              )
            }

            className={`
              ${buttonBase}
              bg-sky-600
              text-white
              hover:bg-sky-500
            `}
          >

            + Add Prospect

          </button>


          <button
            type="button"

            onClick={() =>
              void load()
            }

            className={`
              ${buttonBase}
              border
              border-zinc-700
              bg-zinc-900
              text-zinc-200
              hover:bg-zinc-800
            `}
          >

            Refresh

          </button>

        </div>

      </div>


      {/* NOTICE */}

      {message ? (

        <div
          className={`
            rounded-xl
            border
            px-4
            py-3
            text-sm

            ${
              messageTone ===
              "good"
                ? `
                    border-emerald-900
                    bg-emerald-950/20
                    text-emerald-300
                  `

                : `
                    border-red-900
                    bg-red-950/20
                    text-red-300
                  `
            }
          `}
        >

          {message}

        </div>

      ) : null}


      {/* METRICS */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">

        <MetricCard
          label="Connections Today"

          value={`${status.connections_requested_today}/${status.daily_connection_target}`}

          note="Daily connection-request goal"

          tone={
            status.connections_requested_today >=
            status.daily_connection_target
              ? "good"
              : "sky"
          }
        />


        <MetricCard
          label="Follow-ups Due"

          value={
            status.followups_due
          }

          note={`Up to ${status.daily_followup_target}/day target`}

          tone={
            status.followups_due >
            0
              ? "warn"
              : "normal"
          }
        />


        <MetricCard
          label="Pending"

          value={
            status.pending_connections
          }

          note="Waiting for LinkedIn acceptance"
        />


        <MetricCard
          label="Active"

          value={
            status.active_conversations
          }

          note="Connected or currently messaged"

          tone="sky"
        />


        <MetricCard
          label="Replies"

          value={
            status.replies
          }

          note="Carrier responses waiting for review"

          tone={
            status.replies >
            0
              ? "warn"
              : "normal"
          }
        />


        <MetricCard
          label="Qualified"

          value={
            status.qualified
          }

          note="Positive LinkedIn prospects"

          tone="good"
        />

      </div>


      {/* DAILY PROGRESS */}

      <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-5">

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <div>

            <div className="text-xs font-bold uppercase tracking-[0.17em] text-zinc-500">

              Today's LinkedIn Target

            </div>


            <div className="mt-1 text-sm text-zinc-300">

              {
                status.connections_requested_today
              }{" "}

              of{" "}

              {
                status.daily_connection_target
              }{" "}

              connection requests recorded today.

            </div>

          </div>


          <div className="text-lg font-bold text-sky-300">

            {connectionPercent}%

          </div>

        </div>


        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-900">

          <div
            className="h-full rounded-full bg-sky-500 transition-all"

            style={{
              width:
                `${connectionPercent}%`,
            }}
          />

        </div>

      </div>


      {/* ADD PROSPECT */}

      {showAdd ? (

        <div className="rounded-2xl border border-sky-900/70 bg-[#111317] p-6">

          <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">

            New LinkedIn Prospect

          </div>


          <h2 className="mt-1 text-xl font-bold text-white">

            Add Prospect

          </h2>


          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <input
              className={`${inputClass} xl:col-span-2`}

              placeholder="LinkedIn profile URL *"

              value={
                form.linkedin_url
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    linkedin_url:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="First name"

              value={
                form.first_name
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    first_name:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="Last name"

              value={
                form.last_name
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    last_name:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="Carrier / Company"

              value={
                form.company_name
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    company_name:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="Job title"

              value={
                form.job_title
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    job_title:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="Location"

              value={
                form.location
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    location:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="DOT number"

              value={
                form.carrier_dot_number
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    carrier_dot_number:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="Email (recommended)"

              value={
                form.email
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    email:
                      event.target.value,
                  }),
                )
              }
            />


            <input
              className={inputClass}

              placeholder="Phone"

              value={
                form.phone
              }

              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    phone:
                      event.target.value,
                  }),
                )
              }
            />

          </div>


          <div className="mt-5 flex gap-3">

            <button
              type="button"

              disabled={
                busyId ===
                "global"
              }

              onClick={() =>
                void addProspect()
              }

              className={`
                ${buttonBase}
                bg-white
                text-zinc-950
                hover:bg-zinc-200
              `}
            >

              Save Prospect

            </button>


            <button
              type="button"

              onClick={() =>
                setShowAdd(
                  false,
                )
              }

              className={`
                ${buttonBase}
                border
                border-zinc-700
                bg-zinc-900
                text-zinc-300
              `}
            >

              Cancel

            </button>

          </div>

        </div>

      ) : null}


      {/* PRIORITY QUEUE */}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111317]">

        <div className="border-b border-zinc-800 px-6 py-5">

          <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">

            Do This Next

          </div>


          <h2 className="mt-1 text-xl font-bold text-white">

            LinkedIn Priority Queue

          </h2>


          <p className="mt-1 text-sm leading-6 text-zinc-500">

            Replies first, then qualified prospects,
            accepted connections, due follow-ups and
            new prospects.

          </p>

        </div>


        {priorityProspects.length ===
        0 ? (

          <div className="p-10 text-center">

            <div className="font-bold text-white">

              No LinkedIn work due yet

            </div>


            <p className="mt-2 text-sm text-zinc-500">

              Add your first prospects to begin today's
              outreach.

            </p>

          </div>

        ) : (

          <div className="divide-y divide-zinc-800">

            {priorityProspects
              .slice(
                0,
                30,
              )
              .map(
                (
                  prospect,
                ) => {

                  const step =
                    getNextStep(
                      prospect,
                    );


                  const template =
                    step !==
                    null
                      ? templateMap.get(
                          step,
                        )
                      : null;


                  const preparedMessage =
                    template
                      ? renderMessage(
                          template.message_body,
                          prospect,
                        )
                      : "";


                  const followupReady =
                    prospect.status ===
                      "connected" ||
                    (
                      prospect.status ===
                        "messaged" &&
                      isDue(
                        prospect.next_followup_at,
                      )
                    );


                  return (

                    <div
                      key={
                        prospect.id
                      }
                      className="p-6"
                    >

                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <div className="text-lg font-bold text-white">

                              {
                                nameOf(
                                  prospect,
                                )
                              }

                            </div>


                            <span
                              className={`
                                rounded-full
                                border
                                px-2.5
                                py-1
                                text-[10px]
                                font-bold

                                ${statusClasses(
                                  prospect.status,
                                )}
                              `}
                            >

                              {
                                statusLabel(
                                  prospect.status,
                                )
                              }

                            </span>

                          </div>


                          <div className="mt-1 text-xs text-zinc-500">

                            {[
                              prospect.job_title,

                              prospect.company_name,

                              prospect.location,

                              prospect.carrier_dot_number
                                ? `DOT ${prospect.carrier_dot_number}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") ||
                              "No company details yet"}

                          </div>


                          {prospect.next_followup_at ? (

                            <div
                              className={`
                                mt-3
                                text-xs

                                ${
                                  isDue(
                                    prospect.next_followup_at,
                                  )
                                    ? "font-bold text-amber-300"
                                    : "text-zinc-500"
                                }
                              `}
                            >

                              Next follow-up:{" "}

                              {
                                formatDate(
                                  prospect.next_followup_at,
                                )
                              }

                            </div>

                          ) : null}


                          {preparedMessage &&
                          followupReady ? (

                            <div className="mt-4 max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-400">

                              {preparedMessage}

                            </div>

                          ) : null}


                          {prospect.reply_text ? (

                            <div className="mt-4 max-w-3xl rounded-xl border border-violet-900 bg-violet-950/20 p-4">

                              <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-violet-400">

                                LinkedIn Reply

                              </div>


                              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">

                                {
                                  prospect.reply_text
                                }

                              </div>

                            </div>

                          ) : null}

                        </div>


                        <div className="flex max-w-2xl flex-wrap gap-2">

                          <a
                            href={
                              prospect.linkedin_url
                            }

                            target="_blank"

                            rel="noreferrer"

                            className={`
                              ${buttonBase}
                              border
                              border-sky-800
                              bg-sky-950/30
                              text-sky-300
                              hover:bg-sky-950/60
                            `}
                          >

                            Open LinkedIn

                          </a>


                          {/* NEW PROSPECT */}

                          {prospect.status ===
                          "new" ? (

                            <>

                              <button
                                type="button"

                                onClick={() =>
                                  void copyStep(
                                    prospect,
                                    0,
                                  )
                                }

                                className={`
                                  ${buttonBase}
                                  border
                                  border-zinc-700
                                  bg-zinc-900
                                  text-zinc-200
                                  hover:bg-zinc-800
                                `}
                              >

                                Copy Connection Note

                              </button>


                              <button
                                type="button"

                                disabled={
                                  busyId ===
                                  prospect.id
                                }

                                onClick={() =>
                                  void action(
                                    prospect,
                                    "connection_requested",
                                  )
                                }

                                className={`
                                  ${buttonBase}
                                  bg-amber-600
                                  text-white
                                  hover:bg-amber-500
                                `}
                              >

                                Mark Request Sent

                              </button>

                            </>

                          ) : null}


                          {/* WAITING FOR ACCEPTANCE */}

                          {prospect.status ===
                          "connection_pending" ? (

                            <button
                              type="button"

                              disabled={
                                busyId ===
                                prospect.id
                              }

                              onClick={() =>
                                void action(
                                  prospect,
                                  "connection_accepted",
                                )
                              }

                              className={`
                                ${buttonBase}
                                bg-blue-600
                                text-white
                                hover:bg-blue-500
                              `}
                            >

                              Mark Accepted

                            </button>

                          ) : null}


                          {/* MESSAGE SEQUENCE */}

                          {step !==
                            null &&
                          template &&
                          followupReady ? (

                            <>

                              <button
                                type="button"

                                onClick={() =>
                                  void copyStep(
                                    prospect,
                                    step,
                                  )
                                }

                                className={`
                                  ${buttonBase}
                                  border
                                  border-zinc-700
                                  bg-zinc-900
                                  text-zinc-200
                                  hover:bg-zinc-800
                                `}
                              >

                                Copy{" "}

                                {
                                  template.template_name
                                }

                              </button>


                              <button
                                type="button"

                                disabled={
                                  busyId ===
                                  prospect.id
                                }

                                onClick={() =>
                                  void action(
                                    prospect,

                                    "message_sent",

                                    {
                                      step_number:
                                        step,

                                      message_body:
                                        preparedMessage,
                                    },
                                  )
                                }

                                className={`
                                  ${buttonBase}
                                  bg-sky-600
                                  text-white
                                  hover:bg-sky-500
                                `}
                              >

                                Mark Message Sent

                              </button>

                            </>

                          ) : null}


                          {/* RECORD REPLY */}

                          {[
                            "connected",
                            "messaged",
                          ].includes(
                            prospect.status,
                          ) ? (

                            <button
                              type="button"

                              disabled={
                                busyId ===
                                prospect.id
                              }

                              onClick={() =>
                                void recordReply(
                                  prospect,
                                )
                              }

                              className={`
                                ${buttonBase}
                                bg-violet-600
                                text-white
                                hover:bg-violet-500
                              `}
                            >

                              Record Reply

                            </button>

                          ) : null}


                          {/* REPLIED */}

                          {prospect.status ===
                          "replied" ? (

                            <>

                              <button
                                type="button"

                                disabled={
                                  busyId ===
                                  prospect.id
                                }

                                onClick={() =>
                                  void action(
                                    prospect,
                                    "qualified",
                                  )
                                }

                                className={`
                                  ${buttonBase}
                                  bg-emerald-600
                                  text-white
                                  hover:bg-emerald-500
                                `}
                              >

                                Qualify

                              </button>


                              <button
                                type="button"

                                disabled={
                                  busyId ===
                                  prospect.id
                                }

                                onClick={() =>
                                  void action(
                                    prospect,
                                    "not_interested",
                                  )
                                }

                                className={`
                                  ${buttonBase}
                                  border
                                  border-red-900
                                  bg-red-950/20
                                  text-red-300
                                  hover:bg-red-950/40
                                `}
                              >

                                Not Interested

                              </button>

                            </>

                          ) : null}


                          {/* QUALIFIED */}

                          {prospect.status ===
                            "qualified" &&
                          !prospect.lead_id ? (

                            <button
                              type="button"

                              disabled={
                                busyId ===
                                prospect.id
                              }

                              onClick={() =>
                                void syncLead(
                                  prospect,
                                )
                              }

                              className={`
                                ${buttonBase}
                                bg-emerald-600
                                text-white
                                hover:bg-emerald-500
                              `}
                            >

                              Sync to CRM Lead

                            </button>

                          ) : null}


                          {prospect.lead_id ? (

                            <div
                              className={`
                                ${buttonBase}
                                border
                                border-emerald-900
                                bg-emerald-950/20
                                text-emerald-300
                              `}
                            >

                              ✓ CRM Lead Synced

                            </div>

                          ) : null}

                        </div>

                      </div>

                    </div>
                  );
                },
              )}

          </div>

        )}

      </div>


      {/* ALL PROSPECTS */}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111317]">

        <div className="border-b border-zinc-800 px-6 py-5">

          <h2 className="text-xl font-bold text-white">

            Prospect Pipeline

          </h2>


          <p className="mt-1 text-sm text-zinc-500">

            Total tracked LinkedIn prospects:{" "}

            <span className="font-bold text-zinc-300">

              {
                prospects.length
              }

            </span>

          </p>

        </div>


        {prospects.length ===
        0 ? (

          <div className="p-10 text-center">

            <div className="text-lg font-bold text-white">

              No LinkedIn prospects yet

            </div>


            <p className="mt-2 text-sm text-zinc-500">

              Click Add Prospect and enter the
              LinkedIn profile of an owner-operator,
              fleet owner or carrier decision maker.

            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1100px]">

              <thead>

                <tr className="border-b border-zinc-800 bg-zinc-950/40">

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Prospect
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Sequence
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Next Follow-up
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    CRM
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Profile
                  </th>

                </tr>

              </thead>


              <tbody>

                {prospects.map(
                  (
                    prospect,
                  ) => (

                    <tr
                      key={
                        prospect.id
                      }

                      className="border-b border-zinc-800/80 last:border-b-0 hover:bg-zinc-900/30"
                    >

                      <td className="px-6 py-5">

                        <div className="font-semibold text-white">

                          {
                            nameOf(
                              prospect,
                            )
                          }

                        </div>


                        <div className="mt-1 text-xs text-zinc-500">

                          {[
                            prospect.company_name,

                            prospect.job_title,

                            prospect.location,
                          ]
                            .filter(Boolean)
                            .join(" · ") ||
                            "—"}

                        </div>


                        {prospect.email ? (

                          <div className="mt-1 text-xs text-zinc-600">

                            {
                              prospect.email
                            }

                          </div>

                        ) : null}

                      </td>


                      <td className="px-6 py-5">

                        <span
                          className={`
                            rounded-full
                            border
                            px-2.5
                            py-1
                            text-[10px]
                            font-bold

                            ${statusClasses(
                              prospect.status,
                            )}
                          `}
                        >

                          {
                            statusLabel(
                              prospect.status,
                            )
                          }

                        </span>

                      </td>


                      <td className="px-6 py-5 text-sm text-zinc-300">

                        {Number(
                          prospect.last_step_sent ??
                            0,
                        ) > 0
                          ? `${prospect.last_step_sent}/4`
                          : "—"}

                      </td>


                      <td className="px-6 py-5">

                        <div
                          className={`
                            text-sm

                            ${
                              isDue(
                                prospect.next_followup_at,
                              )
                                ? "font-bold text-amber-300"
                                : "text-zinc-400"
                            }
                          `}
                        >

                          {
                            formatDate(
                              prospect.next_followup_at,
                            )
                          }

                        </div>

                      </td>


                      <td className="px-6 py-5">

                        {prospect.lead_id ? (

                          <span className="text-xs font-bold text-emerald-300">

                            Synced

                          </span>

                        ) : prospect.status ===
                          "qualified" ? (

                          <span className="text-xs font-bold text-amber-300">

                            Needs email

                          </span>

                        ) : (

                          <span className="text-xs text-zinc-600">

                            —

                          </span>

                        )}

                      </td>


                      <td className="px-6 py-5 text-right">

                        <a
                          href={
                            prospect.linkedin_url
                          }

                          target="_blank"

                          rel="noreferrer"

                          className="text-sm font-bold text-sky-400 hover:text-sky-300"
                        >

                          Open Profile

                        </a>

                      </td>

                    </tr>

                  ),
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>


      {/* MESSAGE SEQUENCE */}

      <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-6">

        <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">

          Active Sequence

        </div>


        <h2 className="mt-1 text-xl font-bold text-white">

          LinkedIn Outreach Messages

        </h2>


        <div className="mt-5 grid gap-4 xl:grid-cols-2">

          {templates.map(
            (
              template,
            ) => (

              <div
                key={
                  template.step_number
                }

                className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
              >

                <div className="text-xs font-bold uppercase tracking-wide text-sky-400">

                  Step{" "}

                  {
                    template.step_number
                  }

                  {" — "}

                  {
                    template.template_name
                  }

                </div>


                <div className="mt-3 text-sm leading-6 text-zinc-400">

                  {
                    template.message_body
                  }

                </div>

              </div>

            ),
          )}

        </div>

      </div>


      {/* OPERATING RULES */}

      <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-6">

        <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">

          Current Guardrails

        </div>


        <div className="mt-4 grid gap-4 md:grid-cols-3">

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">

            <div className="text-xs text-zinc-500">

              Connections

            </div>


            <div className="mt-1 text-xl font-bold text-white">

              {
                status.daily_connection_target
              }{" "}

              / day

            </div>

          </div>


          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">

            <div className="text-xs text-zinc-500">

              Follow-ups

            </div>


            <div className="mt-1 text-xl font-bold text-white">

              {
                status.daily_followup_target
              }{" "}

              / day

            </div>

          </div>


          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">

            <div className="text-xs text-zinc-500">

              Open Prospect Limit

            </div>


            <div className="mt-1 text-xl font-bold text-white">

              {
                status.max_open_prospects
              }

            </div>

          </div>

        </div>


        <p className="mt-5 text-xs leading-5 text-zinc-600">

          SlateLane prepares and tracks the
          workflow. LinkedIn connection requests
          and messages are sent from your own
          LinkedIn account. Open the profile,
          send the copied message, then mark the
          action inside this CRM.

        </p>

      </div>

    </div>
  );
}