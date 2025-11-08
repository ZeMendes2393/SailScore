'use client';

import { useMemo, useState } from 'react';
import { useFleets } from '../../hooks/useFleets';

const COLORS_QUALI = ['Yellow','Blue','Red','Green'];
const COLORS_FINALS = ['Gold','Silver','Bronze','Emerald'];

export default function FleetManager() {
  const {
    classes, selectedClass, setSelectedClass,
    sets, assignments, selectedSetId, setSelectedSetId,
    races, loading, error,
    createQualifying, reshuffle, startFinals,
  } = useFleets();

  // forms
  const [qLabel, setQLabel] = useState('Quali D1');
  const [qNum, setQNum] = useState<2|3|4>(2);
  const [qRaceIds, setQRaceIds] = useState<number[]>([]);
  const [rLabel, setRLabel] = useState('Quali D2');
  const [rNum, setRNum] = useState<2|3|4>(2);
  const [rRaceIds, setRRaceIds] = useState<number[]>([]);
  const [mode, setMode] = useState<'auto'|'manual'>('auto');
  const [finalGroups, setFinalGroups] = useState<string[]>(COLORS_FINALS.slice(0,2));
  const [manualSpec, setManualSpec] = useState<{name:string; size:number}[]>([
    { name:'Gold', size: 0 }, { name:'Silver', size: 0 }
  ]);
  const [finalRaceIds, setFinalRaceIds] = useState<number[]>([]);

  const selectedSet = useMemo(() => sets.find(s=>s.id===selectedSetId) ?? null, [sets, selectedSetId]);
  const toggle = (arr:number[], set:(v:number[])=>void, id:number) =>
    set(arr.includes(id) ? arr.filter(x=>x!==id) : [...arr, id]);

  return (
    <div className="space-y-6">
      {/* classes */}
      <div className="flex gap-2 flex-wrap">
        {classes.map(c => (
          <button key={c}
            className={`px-3 py-1 rounded border ${c===selectedClass?'bg-blue-600 text-white border-blue-600':'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'}`}
            onClick={()=>{ setSelectedClass(c); setSelectedSetId(null); }}
          >{c}</button>
        ))}
      </div>

      {/* sets */}
      <div className="space-y-2">
        <h4 className="font-semibold">Fleet Sets</h4>
        {loading ? <div>A carregar…</div> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {sets.map(s => (
              <button key={s.id}
                onClick={()=>setSelectedSetId(s.id)}
                className={`text-left border rounded-xl p-3 hover:bg-gray-50 ${selectedSetId===s.id?'border-blue-600':''}`}
              >
                <div className="text-sm text-gray-500">{s.phase.toUpperCase()}</div>
                <div className="font-semibold">{s.label || '(sem label)'}</div>
                <div className="text-sm">Fleets: {s.fleets.map(f=>f.name).join(', ')}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* assignments */}
      {selectedSet && (
        <div className="space-y-2">
          <h4 className="font-semibold">Assignments — {selectedSet.label}</h4>
          <div className="text-sm text-gray-600">Total: {assignments.length}</div>
          <div className="overflow-x-auto">
            <table className="table-auto w-full border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">Fleet</th>
                  <th className="border px-2 py-1">#</th>
                  <th className="border px-2 py-1">Sail</th>
                  <th className="border px-2 py-1">Boat</th>
                  <th className="border px-2 py-1">Helm</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a,i)=>(
                  <tr key={a.id}>
                    <td className="border px-2 py-1">{selectedSet.fleets.find(f=>f.id===a.fleet_id)?.name ?? '-'}</td>
                    <td className="border px-2 py-1">{i+1}</td>
                    <td className="border px-2 py-1">{a.sail_number ?? ''}</td>
                    <td className="border px-2 py-1">{a.boat_name ?? ''}</td>
                    <td className="border px-2 py-1">{a.helm_name ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* criar qualifying */}
      <div className="border rounded-2xl p-4 space-y-3">
        <div className="font-semibold">Generate fleets randomly based on entry list</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col text-sm">Name
            <input value={qLabel} onChange={e=>setQLabel(e.target.value)} className="border rounded px-2 py-1"/>
          </label>
          <label className="flex flex-col text-sm">Number of fleets
            <select value={qNum} onChange={e=>setQNum(Number(e.target.value) as any)} className="border rounded px-2 py-1">
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </label>
          <div className="text-sm">Colours: {COLORS_QUALI.slice(0,qNum).join(', ')}</div>
        </div>
        <div className="text-sm">Select the races that will be scored according to the fleet assignment:</div>
        <div className="flex gap-2 flex-wrap">
          {races.map(r=>(
            <button key={r.id}
              onClick={()=>toggle(qRaceIds, setQRaceIds, r.id)}
              className={`px-2 py-1 rounded border ${qRaceIds.includes(r.id)?'bg-blue-600 text-white border-blue-600':'bg-white'}`}
            >{r.name}</button>
          ))}
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          onClick={async()=>{ try{ await createQualifying(qLabel, qNum, qRaceIds); setQRaceIds([]); alert('Qualifying criado.'); } catch(e:any){ alert(e.message || 'Falha a criar qualifying.'); }}}>
          Generate Fleets
        </button>
      </div>

      {/* reshuffle */}
      <div className="border rounded-2xl p-4 space-y-3">
        <div className="font-semibold">Generate fleets based on results</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col text-sm">Name
            <input value={rLabel} onChange={e=>setRLabel(e.target.value)} className="border rounded px-2 py-1"/>
          </label>
          <label className="flex flex-col text-sm">Number of fleets
            <select value={rNum} onChange={e=>setRNum(Number(e.target.value) as any)} className="border rounded px-2 py-1">
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </label>
          <div className="text-sm">Colours: {COLORS_QUALI.slice(0,rNum).join(', ')}</div>
        </div>
        <div className="text-sm">Select the races that will be scored according to this fleet assignment:</div>
        <div className="flex gap-2 flex-wrap">
          {races.map(r=>(
            <button key={r.id}
              onClick={()=>toggle(rRaceIds, setRRaceIds, r.id)}
              className={`px-2 py-1 rounded border ${rRaceIds.includes(r.id)?'bg-amber-600 text-white border-amber-600':'bg-white'}`}
            >{r.name}</button>
          ))}
        </div>
        <button className="bg-amber-600 text-white px-4 py-2 rounded-xl"
          onClick={async()=>{ try{ await reshuffle(rLabel, rNum, rRaceIds); setRRaceIds([]); alert('Re-shuffle criado.'); } catch(e:any){ alert(e.message || 'Falha no reshuffle.'); }}}>
          Generate fleets
        </button>
      </div>

      {/* finals */}
      <div className="border rounded-2xl p-4 space-y-3">
        <div className="font-semibold">Iniciar Finals</div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode==='auto'} onChange={()=>setMode('auto')} /> Automático
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={mode==='manual'} onChange={()=>setMode('manual')} /> Manual
          </label>
        </div>

        {mode==='auto' ? (
          <div className="space-y-2">
            <div className="text-sm">Grupos (ordem):</div>
            <div className="flex gap-2 flex-wrap">
              {COLORS_FINALS.map(g=>(
                <button key={g}
                  onClick={()=> setFinalGroups(prev => prev.includes(g)? prev.filter(x=>x!==g) : [...prev,g])}
                  className={`px-2 py-1 rounded border ${finalGroups.includes(g)?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}
                >{g}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">Definição manual:</div>
            {manualSpec.map((m,i)=>(
              <div key={i} className="flex gap-2">
                <input className="border rounded px-2 py-1" value={m.name}
                  onChange={e=>setManualSpec(arr=> arr.map((x,ix)=> ix===i?{...x, name:e.target.value}:x))}/>
                <input className="border rounded px-2 py-1 w-24" type="number" value={m.size}
                  onChange={e=>setManualSpec(arr=> arr.map((x,ix)=> ix===i?{...x, size:Math.max(0, Number(e.target.value)||0)}:x))}/>
                <button className="px-2 border rounded" onClick={()=>setManualSpec(arr=>arr.filter((_,ix)=>ix!==i))}>-</button>
              </div>
            ))}
            <button className="px-2 py-1 border rounded" onClick={()=>setManualSpec(a=>[...a,{name:'Group', size:0}])}>+ grupo</button>
          </div>
        )}

        <div className="text-sm">Vincular corridas das Finals:</div>
        <div className="flex gap-2 flex-wrap">
          {races.map(r=>(
            <button key={r.id}
              onClick={()=>toggle(finalRaceIds, setFinalRaceIds, r.id)}
              className={`px-2 py-1 rounded border ${finalRaceIds.includes(r.id)?'bg-emerald-600 text-white border-emerald-600':'bg-white'}`}
            >{r.name}</button>
          ))}
        </div>

        <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl"
          onClick={async()=>{
            try {
              if (mode==='auto') {
                await startFinals('auto', { groups: finalGroups, race_ids: finalRaceIds });
              } else {
                await startFinals('manual', { groups: manualSpec, race_ids: finalRaceIds });
              }
              setFinalRaceIds([]);
              alert('Finals iniciadas.');
            } catch(e:any) { alert(e.message || 'Falha a iniciar Finals.'); }
          }}
        >Iniciar Finals</button>
      </div>
    </div>
  );
}
