"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";

type TemplateOut = { template: any };
type DecisionOut = {
  decision_pdf_url: string;
  protest_id: number;
  hearing_id: number;
  status_after: string;
};

export default function DecisionFormPage() {
  const router = useRouter();
  const { id, protestId } = useParams<{ id: string; protestId: string }>();
  const regattaId = Number(id);
  const pid = Number(protestId);

  const [loading, setLoading] = useState(true);
  const [tpl, setTpl] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // SUMMARY
  const [typeOfHearing, setTypeOfHearing] = useState("");
  const [hearingStatus, setHearingStatus] = useState("");
  const [valid, setValid] = useState<"" | "yes" | "no">("");
  const [dateOfRace, setDateOfRace] = useState("");
  const [receivedTime, setReceivedTime] = useState(""); // "HH:MM"
  const [classFleet, setClassFleet] = useState("");

  // PARTIES & WITNESSES
  const [partiesTxt, setPartiesTxt] = useState("");       // 1 por linha
  const [witnessesTxt, setWitnessesTxt] = useState("");   // 1 por linha

  // CONTENT
  const [caseSummary, setCaseSummary] = useState("");
  const [proceduralMatters, setProceduralMatters] = useState("");
  const [factsFound, setFactsFound] = useState("");
  const [conclusionsAndRules, setConclusionsAndRules] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [shortDecision, setShortDecision] = useState("");

  // PANEL + DECISION TIMESTAMP
  const [panelChair, setPanelChair] = useState("");
  const [panelMembersTxt, setPanelMembersTxt] = useState(""); // 1 por linha
  const [decisionDate, setDecisionDate] = useState("");       // YYYY-MM-DD
  const [decisionTime, setDecisionTime] = useState("");       // HH:MM

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<TemplateOut>(
          `/regattas/${regattaId}/protests/${pid}/decision/template`
        );
        const t = data?.template || {};
        setTpl(t);

        // Pre-fill com o que o backend já sabe
        setTypeOfHearing(t?.type_of_hearing || "");
        setHearingStatus(t?.hearing_status || "");
        setValid(
          typeof t?.valid === "boolean" ? (t.valid ? "yes" : "no") : ""
        );
        setDateOfRace(t?.date_of_race || t?.race_date || "");
        setReceivedTime(t?.received_time || "");
        setClassFleet(t?.class_fleet || t?.class_name || t?.fleet || "");

        // Parties & Witnesses (aceita array/string)
        const parts =
          Array.isArray(t?.parties) ? t.parties : (t?.parties || "");
        setPartiesTxt(Array.isArray(parts) ? parts.join("\n") : parts);

        const wits =
          Array.isArray(t?.witnesses) ? t.witnesses : (t?.witnesses || "");
        setWitnessesTxt(Array.isArray(wits) ? wits.join("\n") : wits);

        // Content
        setCaseSummary(t?.case_summary || "");
        setProceduralMatters(t?.procedural_matters || "");
        setFactsFound(t?.facts_found || "");
        setConclusionsAndRules(t?.conclusion || t?.conclusions_and_rules || "");
        setDecisionText(t?.decision_text || "");
        setShortDecision(t?.short_decision || "");

        // Panel + timestamp
        setPanelChair(t?.panel_chair || "");
        const pm = Array.isArray(t?.panel_members)
          ? t.panel_members.join("\n")
          : (t?.panel_members || "");
        setPanelMembersTxt(pm);

        // decision date/time (se existir)
        setDecisionDate(t?.decision_date || "");
        setDecisionTime(t?.decision_time || "");
      } catch (e: any) {
        setErr(e?.message || "Falha a carregar template.");
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, pid]);

  async function handleSave() {
    setErr(null);
    // validação mínima (podes ajustar à tua regra no backend)
    if (!factsFound.trim() || !conclusionsAndRules.trim() || !(shortDecision.trim() || decisionText.trim()) || !panelChair.trim()) {
      setErr("Preenche pelo menos: Facts Found, Conclusions & Rules, Short Decision (ou Decision) e Panel Chair.");
      return;
    }

    const payload = {
      // Summary
      type: typeOfHearing || undefined,
      hearing_status: hearingStatus || undefined,
      valid: valid === "" ? undefined : valid === "yes",
      date_of_race: dateOfRace || undefined,
      received_time: receivedTime || undefined,
      class_fleet: classFleet || undefined,

      // Parties & witnesses
      parties: partiesTxt
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      witnesses: witnessesTxt
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),

      // Content
      case_summary: caseSummary || undefined,
      procedural_matters: proceduralMatters || undefined,
      facts_found: factsFound,
      conclusions_and_rules: conclusionsAndRules,
      decision_text: decisionText || undefined,
      short_decision: shortDecision || undefined,

      // Panel + timestamp
      panel_chair: panelChair,
      panel_members: panelMembersTxt
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      decision_date: decisionDate || undefined, // YYYY-MM-DD
      decision_time: decisionTime || undefined, // HH:MM
    };

    try {
      const res = await apiPost<DecisionOut>(
        `/regattas/${regattaId}/protests/${pid}/decision`,
        payload
      );
      if (res?.decision_pdf_url) {
        window.open(res.decision_pdf_url, "_blank", "noopener,noreferrer");
      }
      router.back();
    } catch (e: any) {
      setErr(e?.message || "Falha ao guardar decisão.");
    }
  }

  if (loading) return <div className="p-4">A carregar…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Hearing Decision — Case {tpl?.case_number ?? "—"}</h1>

      {/* SUMMARY */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Summary</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Type</label>
            <input className="w-full border rounded p-2" value={typeOfHearing}
                   onChange={(e) => setTypeOfHearing(e.target.value)} placeholder="Protest / Redress / ..." />
          </div>
          <div>
            <label className="block text-sm mb-1">Hearing Status</label>
            <input className="w-full border rounded p-2" value={hearingStatus}
                   onChange={(e) => setHearingStatus(e.target.value)} placeholder="Open / Closed" />
          </div>
          <div>
            <label className="block text-sm mb-1">Valid</label>
            <select className="w-full border rounded p-2" value={valid}
                    onChange={(e) => setValid(e.target.value as any)}>
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Date of Race</label>
            <input type="date" className="w-full border rounded p-2" value={dateOfRace}
                   onChange={(e) => setDateOfRace(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Time Received</label>
            <input type="time" className="w-full border rounded p-2" value={receivedTime}
                   onChange={(e) => setReceivedTime(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Class/Fleet</label>
            <input className="w-full border rounded p-2" value={classFleet}
                   onChange={(e) => setClassFleet(e.target.value)} placeholder="ILCA 6 Red / 49er / ..." />
          </div>
        </div>
      </section>

      {/* PARTIES */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Parties</h2>
        <textarea rows={3} className="w-full border rounded p-2"
                  value={partiesTxt} onChange={(e) => setPartiesTxt(e.target.value)}
                  placeholder={"Ex.:\n XYZ — Protestor\nABC — Protestee"} />
      </section>

      {/* WITNESSES */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Witnesses</h2>
        <textarea rows={3} className="w-full border rounded p-2"
                  value={witnessesTxt} onChange={(e) => setWitnessesTxt(e.target.value)}
                  placeholder={"Witness 1\nWitness 2"} />
      </section>

      {/* CASE SUMMARY */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Case Summary</h2>
        <textarea rows={4} className="w-full border rounded p-2"
                  value={caseSummary} onChange={(e) => setCaseSummary(e.target.value)} />
      </section>

      {/* PROCEDURAL MATTERS */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Procedural Matters</h2>
        <textarea rows={4} className="w-full border rounded p-2"
                  value={proceduralMatters} onChange={(e) => setProceduralMatters(e.target.value)}
                  placeholder={"Ex: Panel composed per RRS N1.4(b)..."} />
      </section>

      {/* FACTS FOUND */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Facts Found</h2>
        <textarea rows={6} className="w-full border rounded p-2"
                  value={factsFound} onChange={(e) => setFactsFound(e.target.value)} />
      </section>

      {/* CONCLUSIONS & RULES */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Conclusions & Rules</h2>
        <textarea rows={6} className="w-full border rounded p-2"
                  value={conclusionsAndRules} onChange={(e) => setConclusionsAndRules(e.target.value)}
                  placeholder={"Ex- XYZ on port failed to keep clear of ABC on starboard (RRS 10)\n- ..."} />
      </section>

      {/* DECISION (texto completo) */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Decision</h2>
        <textarea rows={4} className="w-full border rounded p-2"
                  value={decisionText} onChange={(e) => setDecisionText(e.target.value)}
                  placeholder={"Ex-Detailed decision reasoning (optional if Short Decision is provided)."} />
      </section>

      {/* SHORT DECISION */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Short Decision</h2>
        <input className="w-full border rounded p-2"
               value={shortDecision} onChange={(e) => setShortDecision(e.target.value)}
               placeholder={"EX: ABC is DSQ on race 3"} />
      </section>

      {/* PANEL */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Panel</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Chair</label>
            <input className="w-full border rounded p-2"
                   value={panelChair} onChange={(e) => setPanelChair(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Members (1 per line)</label>
            <textarea rows={3} className="w-full border rounded p-2"
                      value={panelMembersTxt} onChange={(e) => setPanelMembersTxt(e.target.value)}
                      placeholder={"Member 1\nMember 2"} />
          </div>
        </div>
      </section>

      {/* DECISION TIMESTAMP */}
      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-lg font-medium">Decision Timestamp</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Decision Date</label>
            <input type="date" className="w-full border rounded p-2"
                   value={decisionDate} onChange={(e) => setDecisionDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Decision Time</label>
            <input type="time" className="w-full border rounded p-2"
                   value={decisionTime} onChange={(e) => setDecisionTime(e.target.value)} />
          </div>
        </div>
      </section>

      {err && <div className="text-red-600">{err}</div>}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
          Save & Generate PDF
        </button>
        <button onClick={() => router.back()} className="px-4 py-2 rounded border hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
