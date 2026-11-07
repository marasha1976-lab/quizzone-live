import { useEffect, useRef, useState } from "react";
import "./HorseRace.css";

const HORSES = ["Furia", "Lampo", "Freccia", "Tuono", "Saetta", "Vento"];
const POINTS = [150, 100, 50, 20, 10, 0];
const RESULTS_DELAY_MS = 67500;
const PODIUM_DISPLAY_MS = 8000;

export default function HorseRace({ race, role, players, playerId, now, clockOffset, run }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [podiumRaceId, setPodiumRaceId] = useState(null);
  const [showRacePoints, setShowRacePoints] = useState(false);
  const frame = useRef(null);
  const attemptedFinish = useRef(false);
  const picking = race?.stage === "picking";
  const running = race?.stage === "running";
  const finished = race?.stage === "finished";
  const canFinish = running && now >= race.startsAt + RESULTS_DELAY_MS;
  const picks = race?.picks ?? {};
  const selected = picks[playerId];
  const place = finished && selected ? race.order.indexOf(selected) : -1;
  const hostPicking = role === "host" && picking;
  const chosenCount = hostPicking ? players.filter(player => picks[player.id]).length : 0;

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

  useEffect(() => {
    if (role !== "tv" || !race?.id) return;
    function handlePodium(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = event.data;
      if (message?.channel === "quizzone-cavalli" && message.type === "result" && message.raceId === race.id) {
        setPodiumRaceId(message.raceId);
      }
    }
    window.addEventListener("message", handlePodium);
    return () => window.removeEventListener("message", handlePodium);
  }, [role, race?.id]);

  useEffect(() => {
    if (role !== "tv" || !finished || podiumRaceId !== race.id) return;
    const timer = setTimeout(() => setShowRacePoints(true), PODIUM_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [role, finished, podiumRaceId, race?.id]);

  if (!race) return <main className="horse-race">Caricamento gara…</main>;

  if (role === "tv" && finished && showRacePoints) {
    const winners = players.flatMap(player => {
      const horse = picks[player.id];
      const points = POINTS[race.order.indexOf(horse)];
      return points > 0 ? [{ ...player, horse, points }] : [];
    }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "it"));
    return (
      <main className="horse-race">
        <section className="horse-race-panel horse-race-gains">
          <h1>🏆 Classifica scommesse</h1>
          {winners.length ? (
            <ol className="horse-race-list">
              {winners.map(player => (
                <li key={player.id}>
                  <span><strong>{winners.findIndex(entry => entry.points === player.points) + 1}° · {player.name}</strong><small>#{player.horse} {HORSES[player.horse - 1]}</small></span>
                  <strong className="horse-race-gain">+{player.points} punti</strong>
                </li>
              ))}
            </ol>
          ) : <p>Nessun giocatore ha guadagnato punti in questa gara.</p>}
        </section>
      </main>
    );
  }

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
        {hostPicking && (
          <section className="horse-race-checklist">
            <h2>Scelte dei giocatori</h2>
            <p aria-live="polite"><strong>{chosenCount} su {players.length}</strong> hanno scelto. Mancano {players.length - chosenCount}.</p>
            {players.length > 0 && <ul className="horse-race-list">
              {[...players].sort((a, b) => Number(Boolean(picks[a.id])) - Number(Boolean(picks[b.id])) || a.name.localeCompare(b.name, "it")).map(player => (
                <li key={player.id}>
                  <strong>{player.name}</strong>
                  <span>{picks[player.id] ? `✓ #${picks[player.id]} ${HORSES[picks[player.id] - 1]}` : "In attesa di scelta"}</span>
                </li>
              ))}
            </ul>}
          </section>
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
