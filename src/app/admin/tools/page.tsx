"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type CarrierProfile = {
  id: string;
  company_name: string | null;
  dot_number: number | null;
  mc_number: string | null;
  status: string | null;
  dispatch_fee_type: string | null;
  dispatch_fee_value: number | string | null;
  minimum_rate_per_mile: number | string | null;
  target_rate_per_mile: number | string | null;
  weekly_revenue_target: number | string | null;
  max_deadhead_miles: number | string | null;
  preferred_trip_min_miles: number | string | null;
  preferred_trip_max_miles: number | string | null;
  default_mpg: number | string | null;
  default_fuel_price: number | string | null;
  operating_cost_per_mile: number | string | null;
  preferred_states: string[] | null;
  regions_to_avoid: string[] | null;
  preferred_lanes: string[] | null;
  home_time_notes: string | null;
  operating_notes: string | null;
  updated_at: string | null;
};

type ComparisonLoad = {
  id: number;
  name: string;
  rate: number;
  loadedMiles: number;
  deadheadMiles: number;
};

type PreferenceForm = {
  minimum_rate_per_mile: string;
  target_rate_per_mile: string;
  weekly_revenue_target: string;
  max_deadhead_miles: string;
  preferred_trip_min_miles: string;
  preferred_trip_max_miles: string;
  default_mpg: string;
  default_fuel_price: string;
  operating_cost_per_mile: string;
  preferred_states: string;
  regions_to_avoid: string;
  preferred_lanes: string;
  home_time_notes: string;
  operating_notes: string;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-700";

const emptyPreferences: PreferenceForm = {
  minimum_rate_per_mile: "",
  target_rate_per_mile: "",
  weekly_revenue_target: "",
  max_deadhead_miles: "",
  preferred_trip_min_miles: "",
  preferred_trip_max_miles: "",
  default_mpg: "",
  default_fuel_price: "",
  operating_cost_per_mile: "",
  preferred_states: "",
  regions_to_avoid: "",
  preferred_lanes: "",
  home_time_notes: "",
  operating_notes: "",
};

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function money2(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function rpm(value: number) {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}/mi`;
}

function percent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

function numberInput(value: string) {
  return value.trim() === "" ? null : asNumber(value);
}

function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function profileToForm(profile: CarrierProfile): PreferenceForm {
  const text = (value: unknown) =>
    value === null || value === undefined ? "" : String(value);

  return {
    minimum_rate_per_mile: text(profile.minimum_rate_per_mile),
    target_rate_per_mile: text(profile.target_rate_per_mile),
    weekly_revenue_target: text(profile.weekly_revenue_target),
    max_deadhead_miles: text(profile.max_deadhead_miles),
    preferred_trip_min_miles: text(profile.preferred_trip_min_miles),
    preferred_trip_max_miles: text(profile.preferred_trip_max_miles),
    default_mpg: text(profile.default_mpg),
    default_fuel_price: text(profile.default_fuel_price),
    operating_cost_per_mile: text(profile.operating_cost_per_mile),
    preferred_states: (profile.preferred_states ?? []).join(", "),
    regions_to_avoid: (profile.regions_to_avoid ?? []).join(", "),
    preferred_lanes: (profile.preferred_lanes ?? []).join("\n"),
    home_time_notes: profile.home_time_notes ?? "",
    operating_notes: profile.operating_notes ?? "",
  };
}

function Metric({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "good" | "warn";
}) {
  const valueClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : "text-white";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#111317] p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
      {note ? <div className="mt-1 text-xs text-zinc-500">{note}</div> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  step = "any",
}: {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number | "any";
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-sm text-zinc-600">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(asNumber(event.target.value))}
          className={`${inputClass} ${prefix ? "pl-7" : ""} ${suffix ? "pr-14" : ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs font-semibold text-zinc-600">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-xl font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}

export default function DispatcherToolsPage() {
  const [rpmForm, setRpmForm] = useState({
    rate: 2500,
    loadedMiles: 800,
    deadheadMiles: 100,
  });

  const [profitForm, setProfitForm] = useState({
    rate: 2500,
    loadedMiles: 800,
    deadheadMiles: 100,
    fuelPrice: 3.7,
    mpg: 7,
    dispatchPercent: 8,
    operatingCostPerMile: 0.35,
  });

  const [targetForm, setTargetForm] = useState({
    loadedMiles: 800,
    deadheadMiles: 100,
    targetRpm: 2.5,
    currentOffer: 2100,
  });

  const [comparisonLoads, setComparisonLoads] = useState<ComparisonLoad[]>([
    { id: 1, name: "Load A", rate: 2400, loadedMiles: 750, deadheadMiles: 40 },
    { id: 2, name: "Load B", rate: 2700, loadedMiles: 900, deadheadMiles: 15 },
    { id: 3, name: "Load C", rate: 2200, loadedMiles: 650, deadheadMiles: 120 },
  ]);

  const [profiles, setProfiles] = useState<CarrierProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [preferences, setPreferences] = useState<PreferenceForm>(emptyPreferences);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"good" | "bad">("good");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        setLoadingProfiles(true);
        const response = await fetch("/api/admin/dispatcher-tools/preferences", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Could not load carrier preferences.");
        }

        if (cancelled) {
          return;
        }

        const rows = (payload.carriers ?? []) as CarrierProfile[];
        setProfiles(rows);

        if (rows.length > 0) {
          setSelectedProfileId(rows[0].id);
          setPreferences(profileToForm(rows[0]));
        }
      } catch (error) {
        if (!cancelled) {
          setMessageTone("bad");
          setMessage(error instanceof Error ? error.message : "Could not load carrier preferences.");
        }
      } finally {
        if (!cancelled) {
          setLoadingProfiles(false);
        }
      }
    }

    void loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }

    setPreferences(profileToForm(selectedProfile));
    setMessage("");
  }, [selectedProfile]);

  const rpmMetrics = useMemo(() => {
    const totalMiles = rpmForm.loadedMiles + rpmForm.deadheadMiles;
    const loadedRpm = rpmForm.loadedMiles > 0 ? rpmForm.rate / rpmForm.loadedMiles : 0;
    const allInRpm = totalMiles > 0 ? rpmForm.rate / totalMiles : 0;
    const deadheadPercent = totalMiles > 0 ? (rpmForm.deadheadMiles / totalMiles) * 100 : 0;

    return { totalMiles, loadedRpm, allInRpm, deadheadPercent };
  }, [rpmForm]);

  const profitMetrics = useMemo(() => {
    const totalMiles = profitForm.loadedMiles + profitForm.deadheadMiles;
    const gallons = profitForm.mpg > 0 ? totalMiles / profitForm.mpg : 0;
    const fuelCost = gallons * profitForm.fuelPrice;
    const dispatchFee = profitForm.rate * (profitForm.dispatchPercent / 100);
    const operatingCost = totalMiles * profitForm.operatingCostPerMile;
    const estimatedNet = profitForm.rate - fuelCost - dispatchFee - operatingCost;
    const netPerMile = totalMiles > 0 ? estimatedNet / totalMiles : 0;
    const allInRpm = totalMiles > 0 ? profitForm.rate / totalMiles : 0;

    return {
      totalMiles,
      gallons,
      fuelCost,
      dispatchFee,
      operatingCost,
      estimatedNet,
      netPerMile,
      allInRpm,
    };
  }, [profitForm]);

  const targetMetrics = useMemo(() => {
    const totalMiles = targetForm.loadedMiles + targetForm.deadheadMiles;
    const exactTargetRate = totalMiles * targetForm.targetRpm;
    const recommendedAsk = Math.ceil(exactTargetRate / 25) * 25;
    const offerRpm = totalMiles > 0 ? targetForm.currentOffer / totalMiles : 0;
    const gap = Math.max(0, recommendedAsk - targetForm.currentOffer);

    return { totalMiles, exactTargetRate, recommendedAsk, offerRpm, gap };
  }, [targetForm]);

  const comparisonMetrics = useMemo(() => {
    return comparisonLoads.map((load) => {
      const totalMiles = load.loadedMiles + load.deadheadMiles;
      const allInRpm = totalMiles > 0 ? load.rate / totalMiles : 0;
      const deadheadPercent = totalMiles > 0 ? (load.deadheadMiles / totalMiles) * 100 : 0;
      const mpg = Math.max(profitForm.mpg, 0.1);
      const fuelCost = (totalMiles / mpg) * profitForm.fuelPrice;
      const dispatchFee = load.rate * (profitForm.dispatchPercent / 100);
      const operatingCost = totalMiles * profitForm.operatingCostPerMile;
      const estimatedNet = load.rate - fuelCost - dispatchFee - operatingCost;

      return {
        ...load,
        totalMiles,
        allInRpm,
        deadheadPercent,
        estimatedNet,
      };
    });
  }, [comparisonLoads, profitForm]);

  const bestRpmId = useMemo(() => {
    return comparisonMetrics.reduce<number | null>((bestId, load) => {
      if (bestId === null) {
        return load.id;
      }

      const best = comparisonMetrics.find((item) => item.id === bestId);
      return !best || load.allInRpm > best.allInRpm ? load.id : bestId;
    }, null);
  }, [comparisonMetrics]);

  const bestProfitId = useMemo(() => {
    return comparisonMetrics.reduce<number | null>((bestId, load) => {
      if (bestId === null) {
        return load.id;
      }

      const best = comparisonMetrics.find((item) => item.id === bestId);
      return !best || load.estimatedNet > best.estimatedNet ? load.id : bestId;
    }, null);
  }, [comparisonMetrics]);

  function updateComparison(id: number, patch: Partial<ComparisonLoad>) {
    setComparisonLoads((current) =>
      current.map((load) => (load.id === id ? { ...load, ...patch } : load)),
    );
  }

  function addComparisonLoad() {
    setComparisonLoads((current) => {
      if (current.length >= 5) {
        return current;
      }

      const nextId = Math.max(...current.map((load) => load.id), 0) + 1;
      const label = String.fromCharCode(65 + current.length);

      return [
        ...current,
        {
          id: nextId,
          name: `Load ${label}`,
          rate: 0,
          loadedMiles: 0,
          deadheadMiles: 0,
        },
      ];
    });
  }

  function removeComparisonLoad(id: number) {
    setComparisonLoads((current) =>
      current.length <= 2 ? current : current.filter((load) => load.id !== id),
    );
  }

  function useCarrierDefaults() {
    if (!selectedProfile) {
      return;
    }

    const target = asNumber(
      selectedProfile.target_rate_per_mile ?? selectedProfile.minimum_rate_per_mile,
      targetForm.targetRpm,
    );
    const mpg = asNumber(selectedProfile.default_mpg, profitForm.mpg);
    const fuel = asNumber(selectedProfile.default_fuel_price, profitForm.fuelPrice);
    const operatingCost = asNumber(
      selectedProfile.operating_cost_per_mile,
      profitForm.operatingCostPerMile,
    );
    const feeType = (selectedProfile.dispatch_fee_type ?? "").toLowerCase();
    const feeValue = asNumber(selectedProfile.dispatch_fee_value, profitForm.dispatchPercent);
    const dispatchPercent = feeType.includes("percent") ? feeValue : profitForm.dispatchPercent;

    setTargetForm((current) => ({ ...current, targetRpm: target }));
    setProfitForm((current) => ({
      ...current,
      mpg,
      fuelPrice: fuel,
      operatingCostPerMile: operatingCost,
      dispatchPercent,
    }));

    setMessageTone("good");
    setMessage(`Loaded ${selectedProfile.company_name || "carrier"} defaults into the calculators.`);
  }

  async function savePreferences() {
    if (!selectedProfileId) {
      return;
    }

    try {
      setSavingPreferences(true);
      setMessage("");

      const response = await fetch("/api/admin/dispatcher-tools/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_id: selectedProfileId,
          minimum_rate_per_mile: numberInput(preferences.minimum_rate_per_mile),
          target_rate_per_mile: numberInput(preferences.target_rate_per_mile),
          weekly_revenue_target: numberInput(preferences.weekly_revenue_target),
          max_deadhead_miles: numberInput(preferences.max_deadhead_miles),
          preferred_trip_min_miles: numberInput(preferences.preferred_trip_min_miles),
          preferred_trip_max_miles: numberInput(preferences.preferred_trip_max_miles),
          default_mpg: numberInput(preferences.default_mpg),
          default_fuel_price: numberInput(preferences.default_fuel_price),
          operating_cost_per_mile: numberInput(preferences.operating_cost_per_mile),
          preferred_states: splitList(preferences.preferred_states),
          regions_to_avoid: splitList(preferences.regions_to_avoid),
          preferred_lanes: splitList(preferences.preferred_lanes),
          home_time_notes: preferences.home_time_notes,
          operating_notes: preferences.operating_notes,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Could not save carrier preferences.");
      }

      const saved = payload.carrier as CarrierProfile;
      setProfiles((current) =>
        current.map((profile) => (profile.id === saved.id ? saved : profile)),
      );
      setPreferences(profileToForm(saved));
      setMessageTone("good");
      setMessage("Carrier dispatch preferences saved.");
    } catch (error) {
      setMessageTone("bad");
      setMessage(error instanceof Error ? error.message : "Could not save carrier preferences.");
    } finally {
      setSavingPreferences(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">
            Phase 029C · Dispatch Operations
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Dispatcher Utility Toolkit
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Make faster load decisions with all-in RPM, target-rate, profitability and side-by-side load comparison tools. Save operating preferences for every carrier client.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/15 px-4 py-3 text-sm text-emerald-300">
          Calculations run instantly · No paid API required
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="RPM Calculator" value={rpm(rpmMetrics.allInRpm)} note="Current all-in RPM" tone="good" />
        <Metric label="Target Ask" value={money(targetMetrics.recommendedAsk)} note={`For ${targetForm.targetRpm.toFixed(2)} all-in RPM`} />
        <Metric label="Estimated Net" value={money(profitMetrics.estimatedNet)} note="After selected variable costs" tone={profitMetrics.estimatedNet >= 0 ? "good" : "warn"} />
        <Metric label="Loads Compared" value={String(comparisonLoads.length)} note="Compare up to five offers" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-[#111317] p-6">
          <SectionHeader
            eyebrow="Quick Decision"
            title="RPM Calculator"
            description="See loaded RPM, true all-in RPM and deadhead percentage before you negotiate."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Broker Rate" value={rpmForm.rate} prefix="$" onChange={(rate) => setRpmForm((current) => ({ ...current, rate }))} />
            <Field label="Loaded Miles" value={rpmForm.loadedMiles} suffix="mi" onChange={(loadedMiles) => setRpmForm((current) => ({ ...current, loadedMiles }))} />
            <Field label="Deadhead" value={rpmForm.deadheadMiles} suffix="mi" onChange={(deadheadMiles) => setRpmForm((current) => ({ ...current, deadheadMiles }))} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Metric label="Loaded RPM" value={rpm(rpmMetrics.loadedRpm)} />
            <Metric label="All-in RPM" value={rpm(rpmMetrics.allInRpm)} tone="good" />
            <Metric label="Total Miles" value={rpmMetrics.totalMiles.toLocaleString()} />
            <Metric label="Deadhead" value={percent(rpmMetrics.deadheadPercent)} tone={rpmMetrics.deadheadPercent <= 10 ? "good" : "warn"} />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#111317] p-6">
          <SectionHeader
            eyebrow="Negotiation"
            title="Target Rate Calculator"
            description="Enter your desired all-in RPM and instantly know the rate to ask the broker for."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Loaded Miles" value={targetForm.loadedMiles} suffix="mi" onChange={(loadedMiles) => setTargetForm((current) => ({ ...current, loadedMiles }))} />
            <Field label="Deadhead" value={targetForm.deadheadMiles} suffix="mi" onChange={(deadheadMiles) => setTargetForm((current) => ({ ...current, deadheadMiles }))} />
            <Field label="Desired All-in RPM" value={targetForm.targetRpm} prefix="$" step={0.05} onChange={(targetRpm) => setTargetForm((current) => ({ ...current, targetRpm }))} />
            <Field label="Current Broker Offer" value={targetForm.currentOffer} prefix="$" onChange={(currentOffer) => setTargetForm((current) => ({ ...current, currentOffer }))} />
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-900/70 bg-cyan-950/15 p-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">Recommended Counter</div>
            <div className="mt-2 text-4xl font-black text-white">{money(targetMetrics.recommendedAsk)}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
              <span>Offer RPM: <b className="text-zinc-200">{rpm(targetMetrics.offerRpm)}</b></span>
              <span>·</span>
              <span>Gap: <b className="text-amber-300">{money(targetMetrics.gap)}</b></span>
              <span>·</span>
              <span>Total miles: <b className="text-zinc-200">{targetMetrics.totalMiles.toLocaleString()}</b></span>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#111317] p-6">
        <SectionHeader
          eyebrow="Profitability"
          title="Load Profit Calculator"
          description="Estimate what remains after fuel, dispatch percentage and your non-fuel variable operating-cost assumption."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <Field label="Rate" value={profitForm.rate} prefix="$" onChange={(rate) => setProfitForm((current) => ({ ...current, rate }))} />
          <Field label="Loaded Miles" value={profitForm.loadedMiles} suffix="mi" onChange={(loadedMiles) => setProfitForm((current) => ({ ...current, loadedMiles }))} />
          <Field label="Deadhead" value={profitForm.deadheadMiles} suffix="mi" onChange={(deadheadMiles) => setProfitForm((current) => ({ ...current, deadheadMiles }))} />
          <Field label="Fuel Price" value={profitForm.fuelPrice} prefix="$" step={0.01} onChange={(fuelPrice) => setProfitForm((current) => ({ ...current, fuelPrice }))} />
          <Field label="Truck MPG" value={profitForm.mpg} step={0.1} onChange={(mpg) => setProfitForm((current) => ({ ...current, mpg }))} />
          <Field label="Dispatch Fee" value={profitForm.dispatchPercent} suffix="%" step={0.1} onChange={(dispatchPercent) => setProfitForm((current) => ({ ...current, dispatchPercent }))} />
          <Field label="Other Cost / Mile" value={profitForm.operatingCostPerMile} prefix="$" step={0.01} onChange={(operatingCostPerMile) => setProfitForm((current) => ({ ...current, operatingCostPerMile }))} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <Metric label="All-in RPM" value={rpm(profitMetrics.allInRpm)} />
          <Metric label="Fuel Gallons" value={profitMetrics.gallons.toFixed(1)} />
          <Metric label="Fuel Cost" value={money2(profitMetrics.fuelCost)} />
          <Metric label="Dispatch Fee" value={money2(profitMetrics.dispatchFee)} />
          <Metric label="Other Variable Cost" value={money2(profitMetrics.operatingCost)} />
          <Metric label="Estimated Net" value={money2(profitMetrics.estimatedNet)} tone={profitMetrics.estimatedNet >= 0 ? "good" : "warn"} />
          <Metric label="Net / All-in Mile" value={rpm(profitMetrics.netPerMile)} tone={profitMetrics.netPerMile > 0 ? "good" : "warn"} />
        </div>

        <p className="mt-4 text-xs leading-5 text-zinc-600">
          Profit estimate is a dispatch decision aid, not accounting or tax advice. Fixed truck payments, insurance, driver compensation and other costs should be included in your per-mile operating-cost assumption when relevant.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#111317] p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            eyebrow="Offer Selection"
            title="Quick Load Comparison"
            description="Compare two to five offers using the same fuel, MPG, dispatch-fee and operating-cost assumptions from the profit calculator above."
          />
          <button
            type="button"
            onClick={addComparisonLoad}
            disabled={comparisonLoads.length >= 5}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add Load
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                <th className="px-3 py-3">Load</th>
                <th className="px-3 py-3">Rate</th>
                <th className="px-3 py-3">Loaded</th>
                <th className="px-3 py-3">Deadhead</th>
                <th className="px-3 py-3">Total</th>
                <th className="px-3 py-3">All-in RPM</th>
                <th className="px-3 py-3">DH %</th>
                <th className="px-3 py-3">Est. Net</th>
                <th className="px-3 py-3">Result</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {comparisonMetrics.map((load) => (
                <tr key={load.id} className="border-b border-zinc-800/70 last:border-0">
                  <td className="px-3 py-3">
                    <input
                      value={load.name}
                      onChange={(event) => updateComparison(load.id, { name: event.target.value })}
                      className="w-28 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-700"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min={0} value={load.rate} onChange={(event) => updateComparison(load.id, { rate: asNumber(event.target.value) })} className="w-28 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-700" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min={0} value={load.loadedMiles} onChange={(event) => updateComparison(load.id, { loadedMiles: asNumber(event.target.value) })} className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-700" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min={0} value={load.deadheadMiles} onChange={(event) => updateComparison(load.id, { deadheadMiles: asNumber(event.target.value) })} className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-700" />
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-zinc-300">{load.totalMiles.toLocaleString()}</td>
                  <td className="px-3 py-3 text-sm font-bold text-emerald-300">{rpm(load.allInRpm)}</td>
                  <td className="px-3 py-3 text-sm text-zinc-300">{percent(load.deadheadPercent)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-white">{money(load.estimatedNet)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {load.id === bestRpmId ? <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-1 text-[10px] font-bold text-emerald-300">BEST RPM</span> : null}
                      {load.id === bestProfitId ? <span className="rounded-full border border-cyan-800 bg-cyan-950 px-2 py-1 text-[10px] font-bold text-cyan-300">BEST NET</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => removeComparisonLoad(load.id)} disabled={comparisonLoads.length <= 2} className="text-xs font-semibold text-zinc-600 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-[#111317] p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionHeader
            eyebrow="Client Operating Profile"
            title="Carrier Preferences"
            description="Save the rules you actually dispatch by. These values can later power automated load scoring and matching."
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-[300px]">
              <span className="text-xs font-semibold text-zinc-400">Carrier Client</span>
              <select
                value={selectedProfileId}
                disabled={loadingProfiles || profiles.length === 0}
                onChange={(event) => setSelectedProfileId(event.target.value)}
                className={inputClass}
              >
                {profiles.length === 0 ? <option value="">No onboarding clients found</option> : null}
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.company_name || "Unnamed Carrier"}{profile.dot_number ? ` · DOT ${profile.dot_number}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={useCarrierDefaults}
              disabled={!selectedProfile}
              className="rounded-xl border border-cyan-800 bg-cyan-950/30 px-4 py-3 text-sm font-bold text-cyan-300 transition hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use in Calculators
            </button>
          </div>
        </div>

        {selectedProfile ? (
          <>
            <div className="mb-5 flex flex-wrap gap-2 text-xs text-zinc-500">
              {selectedProfile.dot_number ? <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">DOT {selectedProfile.dot_number}</span> : null}
              {selectedProfile.mc_number ? <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">MC {selectedProfile.mc_number}</span> : null}
              {selectedProfile.dispatch_fee_value ? <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">Dispatch fee: {selectedProfile.dispatch_fee_value}{(selectedProfile.dispatch_fee_type ?? "").toLowerCase().includes("percent") ? "%" : ""}</span> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Minimum RPM", "minimum_rate_per_mile", "$", "0.05"],
                ["Target RPM", "target_rate_per_mile", "$", "0.05"],
                ["Weekly Revenue Target", "weekly_revenue_target", "$", "100"],
                ["Max Deadhead", "max_deadhead_miles", "", "1"],
                ["Preferred Trip Min", "preferred_trip_min_miles", "", "1"],
                ["Preferred Trip Max", "preferred_trip_max_miles", "", "1"],
                ["Default MPG", "default_mpg", "", "0.1"],
                ["Default Fuel Price", "default_fuel_price", "$", "0.01"],
                ["Other Operating Cost / Mile", "operating_cost_per_mile", "$", "0.01"],
              ].map(([label, key, prefix, step]) => (
                <label key={key} className="block">
                  <span className="text-xs font-semibold text-zinc-400">{label}</span>
                  <div className="relative">
                    {prefix ? <span className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-sm text-zinc-600">{prefix}</span> : null}
                    <input
                      type="number"
                      min={0}
                      step={step}
                      value={preferences[key as keyof PreferenceForm]}
                      onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.value }))}
                      className={`${inputClass} ${prefix ? "pl-7" : ""}`}
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <label>
                <span className="text-xs font-semibold text-zinc-400">Preferred States</span>
                <textarea value={preferences.preferred_states} onChange={(event) => setPreferences((current) => ({ ...current, preferred_states: event.target.value }))} placeholder="TX, OK, AR, TN" rows={4} className={inputClass} />
              </label>
              <label>
                <span className="text-xs font-semibold text-zinc-400">Regions / States to Avoid</span>
                <textarea value={preferences.regions_to_avoid} onChange={(event) => setPreferences((current) => ({ ...current, regions_to_avoid: event.target.value }))} placeholder="NYC, Northeast, CA" rows={4} className={inputClass} />
              </label>
              <label>
                <span className="text-xs font-semibold text-zinc-400">Preferred Lanes</span>
                <textarea value={preferences.preferred_lanes} onChange={(event) => setPreferences((current) => ({ ...current, preferred_lanes: event.target.value }))} placeholder={"Dallas, TX → Atlanta, GA\nHouston, TX → Memphis, TN"} rows={4} className={inputClass} />
              </label>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <label>
                <span className="text-xs font-semibold text-zinc-400">Home-time Notes</span>
                <textarea value={preferences.home_time_notes} onChange={(event) => setPreferences((current) => ({ ...current, home_time_notes: event.target.value }))} placeholder="Needs to be back in Dallas by Friday evening..." rows={4} className={inputClass} />
              </label>
              <label>
                <span className="text-xs font-semibold text-zinc-400">Operating Notes</span>
                <textarea value={preferences.operating_notes} onChange={(event) => setPreferences((current) => ({ ...current, operating_notes: event.target.value }))} placeholder="No NYC, prefer no-touch freight, flexible on weekend delivery..." rows={4} className={inputClass} />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void savePreferences()}
                disabled={savingPreferences}
                className="rounded-xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60"
              >
                {savingPreferences ? "Saving..." : "Save Carrier Preferences"}
              </button>

              {message ? (
                <span className={`text-sm font-semibold ${messageTone === "good" ? "text-emerald-300" : "text-red-300"}`}>
                  {message}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 text-sm text-zinc-500">
            {loadingProfiles ? "Loading carrier clients..." : "No carrier onboarding clients are available yet. The calculators above are still fully usable."}
          </div>
        )}
      </section>
    </div>
  );
}
