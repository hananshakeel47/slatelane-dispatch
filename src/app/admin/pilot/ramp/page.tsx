import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { promoteTo20Action } from "./actions";

export const dynamic = "force-dynamic";

type RampStatus = {
  ramp_stage: number | null;
  ramp_target: number | null;
  pilot_limit: number | null;
  daily_send_cap: number | null;
  max_batch_size: number | null;
  sending_enabled: boolean | null;
  ready_for_20: boolean | null;
  readiness_reason: string | null;
};

type RampAudit = {
  id?: string | number;
  action?: string | null;
  from_target?: number | null;
  to_target?: number | null;
  success?: boolean | null;
  reason?: string | null;
  created_at?: string | null;
  note?: string | null;
};

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function reasonLabel(reason?: string | null) {
  switch (reason) {
    case "current_pilot_still_running":
      return "Current 5-carrier pilot is still running";
    case "pilot_not_found":
      return "No completed pilot is available";
    case "safety_auto_paused":
      return "Automatic safety protection is paused";
    case "bounce_rate_exceeded":
      return "Bounce rate is above the permitted threshold";
    case "failure_rate_exceeded":
      return "Failure rate is above the permitted threshold";
    case "complaint_rate_exceeded":
      return "Complaint threshold exceeded";
    case "ready_for_ramp":
    case "ready":
      return "All ramp requirements passed";
    case null:
    case undefined:
      return "No blocking condition";
    default:
      return reason.replaceAll("_", " ");
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

export default async function RampControlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorParam =
    typeof params.error === "string" ? params.error : null;

  const successParam =
    typeof params.success === "string" ? params.success : null;

  const supabase = getAdminSupabase();

  const [
    rampResponse,
    safetyResponse,
    enrollmentsResponse,
    pilotResponse,
    auditResponse,
  ] = await Promise.all([
    supabase
      .from("email_ramp_status")
      .select("*")
      .maybeSingle(),

    supabase
      .from("email_safety_status")
      .select(
        `
        auto_paused,
        pause_reason,
        sends_in_window,
        bounces_in_window,
        failures_in_window,
        complaints_in_window
        `
      )
      .maybeSingle(),

    supabase
      .from("email_sequence_enrollments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("status", "active"),

    supabase
      .from("email_pilot_batches")
      .select(
        `
        id,
        status,
        requested_count,
        prepared_count,
        minimum_score,
        created_at,
        armed_at
        `
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("email_ramp_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (rampResponse.error) {
    throw new Error(
      `Could not load ramp status: ${rampResponse.error.message}`
    );
  }

  const ramp = rampResponse.data as RampStatus | null;

  const safety = safetyResponse.data as
    | {
        auto_paused?: boolean;
        pause_reason?: string | null;
        sends_in_window?: number;
        bounces_in_window?: number;
        failures_in_window?: number;
        complaints_in_window?: number;
      }
    | null;

  const pilot = pilotResponse.data as
    | {
        id?: string;
        status?: string;
        requested_count?: number;
        prepared_count?: number;
        minimum_score?: number;
        created_at?: string;
        armed_at?: string;
      }
    | null;

  const audits = (auditResponse.data ?? []) as RampAudit[];

  const activeEnrollments = enrollmentsResponse.count ?? 0;

  const stage = Number(ramp?.ramp_stage ?? 1);
  const target = Number(ramp?.ramp_target ?? 5);
  const ready = Boolean(ramp?.ready_for_20);
  const masterSending = Boolean(ramp?.sending_enabled);
  const safetyPaused = Boolean(safety?.auto_paused);

  const currentPilotRunning =
    pilot?.status === "armed" ||
    pilot?.status === "prepared" ||
    activeEnrollments > 0;

  const promotionLocked =
    !ready ||
    safetyPaused ||
    currentPilotRunning ||
    target >= 20;

  const progressPercent =
    target >= 20 ? 100 : target <= 5 ? 25 : 50;

  return (
    <main
      style={{
        padding: "30px",
        maxWidth: "1500px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "28px",
        }}
      >
        <div>
          <div
            style={{
              color: "#22d3ee",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.18em",
              marginBottom: "8px",
            }}
          >
            PHASE 024 • CONTROLLED PRODUCTION RAMP
          </div>

          <h1
            style={{
              fontSize: "34px",
              margin: 0,
              marginBottom: "8px",
            }}
          >
            Production Ramp Control
          </h1>

          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              maxWidth: "780px",
              lineHeight: 1.6,
            }}
          >
            Promote SlateLane outbound capacity only after the
            previous validation stage has completed safely.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/admin/pilot"
            style={{
              padding: "11px 16px",
              border: "1px solid #334155",
              borderRadius: "10px",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← Pilot Launch
          </Link>

          <Link
            href="/admin/monitoring/safety"
            style={{
              padding: "11px 16px",
              border: "1px solid #334155",
              borderRadius: "10px",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Safety Center →
          </Link>
        </div>
      </div>

      {successParam === "promoted_to_20" && (
        <div
          style={{
            border: "1px solid #059669",
            background: "rgba(5,150,105,.10)",
            borderRadius: "14px",
            padding: "16px 18px",
            marginBottom: "22px",
            color: "#6ee7b7",
          }}
        >
          <strong>Ramp promotion successful.</strong>
          <div style={{ marginTop: "4px", color: "#a7f3d0" }}>
            Capacity is now 20 carriers. Master Sending remains OFF.
          </div>
        </div>
      )}

      {errorParam && (
        <div
          style={{
            border: "1px solid #dc2626",
            background: "rgba(220,38,38,.10)",
            borderRadius: "14px",
            padding: "16px 18px",
            marginBottom: "22px",
            color: "#fca5a5",
          }}
        >
          <strong>Ramp action blocked.</strong>
          <div style={{ marginTop: "4px" }}>
            {reasonLabel(errorParam)}
          </div>
        </div>
      )}

      <section
        style={{
          border: "1px solid #29313a",
          borderRadius: "18px",
          padding: "24px",
          background: "#0d1114",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "12px",
                marginBottom: "6px",
              }}
            >
              CURRENT PRODUCTION STAGE
            </div>

            <div
              style={{
                fontSize: "28px",
                fontWeight: 900,
              }}
            >
              Stage {stage} — {target} Carrier Capacity
            </div>
          </div>

          <div
            style={{
              border:
                masterSending
                  ? "1px solid #dc2626"
                  : "1px solid #059669",
              background:
                masterSending
                  ? "rgba(220,38,38,.10)"
                  : "rgba(5,150,105,.10)",
              padding: "10px 14px",
              borderRadius: "999px",
              fontWeight: 800,
              color:
                masterSending ? "#f87171" : "#34d399",
            }}
          >
            MASTER SENDING{" "}
            {masterSending ? "ON" : "OFF — SAFE"}
          </div>
        </div>

        <div
          style={{
            height: "12px",
            background: "#171c20",
            borderRadius: "999px",
            marginTop: "26px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background:
                "linear-gradient(90deg,#06b6d4,#10b981)",
              borderRadius: "999px",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#64748b",
            marginTop: "8px",
            fontSize: "12px",
          }}
        >
          <span>5</span>
          <span>20</span>
          <span>50</span>
          <span>100+</span>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(190px,1fr))",
          gap: "14px",
          marginBottom: "22px",
        }}
      >
        {[
          ["Ramp Target", target],
          ["Pilot Limit", ramp?.pilot_limit ?? 0],
          ["Daily Send Cap", ramp?.daily_send_cap ?? 0],
          ["Processor Batch", ramp?.max_batch_size ?? 0],
          ["Active Enrollments", activeEnrollments],
          [
            "Safety",
            safetyPaused ? "AUTO-PAUSED" : "CLEAR",
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              border: "1px solid #29313a",
              borderRadius: "15px",
              padding: "18px",
              background: "#0d1114",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: "11px",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              {label}
            </div>

            <div
              style={{
                fontSize: "23px",
                fontWeight: 900,
              }}
            >
              {String(value)}
            </div>
          </div>
        ))}
      </div>

      <section
        style={{
          border: ready
            ? "1px solid #059669"
            : "1px solid #92400e",
          background: ready
            ? "rgba(5,150,105,.06)"
            : "rgba(146,64,14,.07)",
          borderRadius: "18px",
          padding: "24px",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                letterSpacing: ".16em",
                fontWeight: 800,
                color: ready ? "#34d399" : "#fbbf24",
              }}
            >
              5 → 20 READINESS
            </div>

            <h2
              style={{
                margin: "8px 0",
                fontSize: "25px",
              }}
            >
              {ready
                ? "READY FOR CONTROLLED PROMOTION"
                : "PROMOTION LOCKED"}
            </h2>

            <p
              style={{
                color: "#94a3b8",
                margin: 0,
              }}
            >
              {reasonLabel(ramp?.readiness_reason)}
            </p>
          </div>

          <div
            style={{
              fontSize: "24px",
              fontWeight: 900,
              color: ready ? "#34d399" : "#f59e0b",
            }}
          >
            {ready ? "PASS" : "WAIT"}
          </div>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #29313a",
          borderRadius: "18px",
          background: "#0d1114",
          padding: "24px",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            color: "#22d3ee",
            fontWeight: 800,
            fontSize: "12px",
            letterSpacing: ".16em",
            marginBottom: "8px",
          }}
        >
          PROTECTED OPERATOR ACTION
        </div>

        <h2
          style={{
            fontSize: "25px",
            marginTop: 0,
          }}
        >
          Promote Capacity: 5 → 20
        </h2>

        <p
          style={{
            color: "#94a3b8",
            maxWidth: "820px",
            lineHeight: 1.6,
          }}
        >
          This action changes carrier capacity only. It does not
          enable Master Sending and does not automatically transmit
          an email.
        </p>

        {target >= 20 ? (
          <div
            style={{
              padding: "16px",
              border: "1px solid #059669",
              borderRadius: "12px",
              color: "#6ee7b7",
              marginTop: "18px",
            }}
          >
            Stage 20 capacity has already been unlocked.
          </div>
        ) : (
          <form
            action={promoteTo20Action}
            style={{
              maxWidth: "760px",
              marginTop: "20px",
            }}
          >
            <label
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              Operator note
            </label>

            <textarea
              name="note"
              placeholder="Example: 5-carrier pilot completed with successful delivery and no safety incidents."
              style={{
                width: "100%",
                minHeight: "90px",
                padding: "13px",
                background: "#050607",
                color: "white",
                border: "1px solid #374151",
                borderRadius: "10px",
                marginBottom: "18px",
                resize: "vertical",
              }}
            />

            <label
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              Type{" "}
              <strong style={{ color: "#fbbf24" }}>
                PROMOTE TO 20
              </strong>{" "}
              exactly
            </label>

            <input
              name="confirmation"
              autoComplete="off"
              placeholder="PROMOTE TO 20"
              style={{
                width: "100%",
                padding: "13px",
                background: "#050607",
                color: "white",
                border: "1px solid #374151",
                borderRadius: "10px",
                marginBottom: "18px",
              }}
            />

            {!ready && (
              <div
                style={{
                  padding: "13px 15px",
                  border: "1px solid #92400e",
                  background: "rgba(146,64,14,.08)",
                  color: "#fbbf24",
                  borderRadius: "10px",
                  marginBottom: "16px",
                }}
              >
                Promotion is currently locked:{" "}
                {reasonLabel(ramp?.readiness_reason)}.
              </div>
            )}

            <button
              type="submit"
              disabled={promotionLocked}
              style={{
                padding: "13px 20px",
                border: 0,
                borderRadius: "10px",
                fontWeight: 900,
                cursor: promotionLocked
                  ? "not-allowed"
                  : "pointer",
                background: promotionLocked
                  ? "#252a2e"
                  : "#059669",
                color: promotionLocked
                  ? "#64748b"
                  : "white",
              }}
            >
              {promotionLocked
                ? "Promotion Locked"
                : "Promote to 20 Carriers"}
            </button>
          </form>
        )}
      </section>

      <section
        style={{
          border: "1px solid #29313a",
          borderRadius: "18px",
          overflow: "hidden",
          background: "#0d1114",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid #29313a",
          }}
        >
          <h2 style={{ margin: 0 }}>Ramp Audit History</h2>

          <p
            style={{
              color: "#64748b",
              marginBottom: 0,
            }}
          >
            Protected capacity-promotion attempts and decisions.
          </p>
        </div>

        {audits.length === 0 ? (
          <div
            style={{
              padding: "30px",
              color: "#64748b",
              textAlign: "center",
            }}
          >
            No ramp events recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Time",
                    "Action",
                    "From",
                    "To",
                    "Result",
                    "Reason",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: "13px 16px",
                        color: "#64748b",
                        fontSize: "11px",
                        borderBottom:
                          "1px solid #29313a",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {audits.map((item, index) => (
                  <tr
                    key={String(item.id ?? index)}
                  >
                    <td style={cell}>
                      {formatDate(item.created_at)}
                    </td>

                    <td style={cell}>
                      {item.action ?? "—"}
                    </td>

                    <td style={cell}>
                      {item.from_target ?? "—"}
                    </td>

                    <td style={cell}>
                      {item.to_target ?? "—"}
                    </td>

                    <td
                      style={{
                        ...cell,
                        color:
                          item.success === true
                            ? "#34d399"
                            : item.success === false
                            ? "#f87171"
                            : "#94a3b8",
                        fontWeight: 800,
                      }}
                    >
                      {item.success === true
                        ? "SUCCESS"
                        : item.success === false
                        ? "BLOCKED"
                        : "—"}
                    </td>

                    <td style={cell}>
                      {reasonLabel(item.reason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const cell: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #20262b",
  fontSize: "13px",
};