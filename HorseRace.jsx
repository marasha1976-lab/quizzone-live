import { useEffect, useRef, useState } from "react";
import "./HorseRace.css";

const HORSES = ["Furia", "Lampo", "Freccia", "Tuono", "Saetta", "Vento"];
const POINTS = [150, 100, 50, 20, 10, 0];
const RESULTS_DELAY_MS = 67500;

export default function HorseRace({ race, role, players, playerId, now, clockOffset, run }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const frame = useRef(null);
  const attemptedFinish = useRef(false);
  const picking = race?.stage === "picking";
  const running = race?.stage === "running";
  const finished = race?.stage === "finished";
  const canFinish = running && now >= race.startsAt + RESULTS_DELAY_MS;
  const picks = race?.picks ?? {};
  const selected = picks[playerId];
  const place = finished && selected ? race.order.indexOf(selected) : -1;

  async function act(action, horse) {
    setBusy(true);
    setError("");
    try {
      await run(action, horse);
    } catch (failure) {
      setError(failure.message || "Operazione non riuscita. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (role === "host" && canFinish && !attemptedFinish.current) {
      attemptedFinish.current = true;
      void act("finish");
    }
  }, [role, canFinish]);

  function sendStart() {
    if (!race?.order) return;
    frame.current?.contentWindow?.postMessage({
      channel: "quizzone-cavalli",
      type: "start",
      raceId: race.id,
      seed: race.seed,
      startsAt: Math.min(Date.now() + 3000, Math.round(race.startsAt - clockOffset)),
      order: race.order,
    }, window.location.origin);
  }

  useEffect(() => {
    sendStart();
  }, [race?.id, race?.startsAt, clockOffset]);

  if (!race) return <main className="horse-race">Caricamento gara…</main>;

  if ((role === "tv" || role === "player") && (running || finished)) {
    const isPlayer = role === "player";
    return (
      <main className={`horse-race ${isPlayer ? "horse-race-player-live" : "horse-race-tv"}`}>
        {isPlayer && (
          <header className="horse-race-player-status" aria-live="polite">
            {selected ? <strong>Il tuo cavallo: {HORSES[selected - 1]}</strong> : <strong>Gara in diretta</strong>}
            {finished && (place >= 0 ? <span>{place + 1}° posto · +{POINTS[place]} punti</span> : <span>Nessun cavallo scelto</span>)}
          </header>
        )}
        <iframe ref={frame} onLoad={sendStart} src={`${import.meta.env.BASE_URL}gran-premio-cavalli.html?embed=1`} title="Gran Premio Cavalli" allow="autoplay" />
        {finished && !isPlayer && (
          <aside className="horse-race-scores">
            <h2>Classifica del Quizzone</h2>
            <ol>{[...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map(player => (
              <li key={player.id}>{player.name} · {player.score || 0} punti</li>
            ))}</ol>
          </aside>
        )}
      </main>
    );
  }

  return (
    <main className="horse-race">
      <section className="horse-race-panel">
        <h1>🏇 Gran Premio Cavalli</h1>
        {picking && <p>{role === "player" ? "Scegli il tuo cavallo. Puoi solo guadagnare!" : "Scelte aperte sui telefoni."}</p>}
        {running && <p>Gara in corso sulla TV e sui telefoni.</p>}
        {finished && <p>Punti accreditati nella classifica del Quizzone.</p>}
        {(picking || finished) && (
          <div className="horse-race-grid">
            {(finished ? race.order : HORSES.map((_, i) => i + 1)).map((horse, i) => {
              const label = `#${horse} ${HORSES[horse - 1]}`;
              const count = Object.values(picks).filter(choice => choice === horse).length;
              return picking && role === "player" ? (
                <button key={horse} aria-pressed={selected === horse} disabled={busy} onClick={() => act("pick", horse)}>{label}</button>
              ) : (
                <div key={horse} className="horse-race-card">{finished ? `${i + 1}° · ` : ""}{label}<small>{finished ? `${POINTS[i]} punti` : `${count} ${count === 1 ? "scelta" : "scelte"}`}</small></div>
              );
            })}
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {role === "host" && (
          <div className="horse-race-actions">
            {picking && <button disabled={busy} onClick={() => act("start")}>Blocca scelte e avvia</button>}
            {canFinish && <button disabled={busy} onClick={() => act("finish")}>Assegna punti</button>}
            {(picking || finished) && <button disabled={busy} onClick={() => act("close")}>{picking ? "Annulla gara" : "Torna al Quizzone"}</button>}
          </div>
        )}
      </section>
    </main>
  );
}
