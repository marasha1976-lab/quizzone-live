import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { QRCodeSVG } from "qrcode.react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GAME_CODE = "PUB2026";
const COUNTDOWN_DURATION = 10;
const QUESTION_START_DELAY_MS = 3000;
const COUNTDOWN_AUDIO_SRC = "/media/countdown10.m4a";
const REVEAL_AUDIO_SRC = "";

const DEMO_QUESTIONS = [
  {
    position: 0,
    round: 1,
    type: "multiple",
    question: "Qual è la capitale della Spagna?",
    option_a: "Madrid",
    option_b: "Barcellona",
    option_c: "Valencia",
    option_d: "Siviglia",
    correct_answer: "A",
    explanation: "Madrid è la capitale della Spagna.",
    time_limit: 10,
    points: 100,
    image_url: "",
    audio_url: "",
  },
  {
    position: 1,
    round: 1,
    type: "multiple",
    question: "Chi canta questa canzone?",
    option_a: "Queen",
    option_b: "Vasco Rossi",
    option_c: "Ligabue",
    option_d: "Coldplay",
    correct_answer: "A",
    explanation: "La risposta corretta è Queen.",
    time_limit: 10,
    points: 100,
    image_url: "",
    audio_url: "/media/queen.mp3",
  },
  {
    position: 2,
    round: 1,
    type: "multiple",
    question: "In che data si svolge l'evento?",
    option_a: "10 Giugno",
    option_b: "14 Giugno",
    option_c: "20 Giugno",
    option_d: "1 Luglio",
    correct_answer: "B",
    explanation: "Nell'immagine è scritto Sabato 14 Giugno.",
    time_limit: 10,
    points: 100,
    image_url: "/images/evento.jpg",
    audio_url: "",
  },
];

const APP_BG = "linear-gradient(135deg, #120c24 0%, #1c1440 45%, #0b1220 100%)";
const CARD_BG = "rgba(255,255,255,0.10)";
const BORDER = "1px solid rgba(255,255,255,0.16)";

const PRIMARY = "#7c3aed";
const PRIMARY_DARK = "#5b21b6";

const RED = "#ef4444";
const GREEN = "#22c55e";
const GOLD = "#facc15";

const ANSWER_A = "#3b82f6";
const ANSWER_B = "#ef4444";
const ANSWER_C = "#f59e0b";
const ANSWER_D = "#22c55e";

const LOGO_BG = "/images/logo.png";

const PLAYER_JOIN_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}?role=player`
    : "";

const tvLogoStyle = {
  position: "absolute",
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  height: 110,
  maxWidth: "70vw",
  objectFit: "contain",
  zIndex: 20,
  filter: "drop-shadow(0 0 20px rgba(255,215,64,0.7))",
  pointerEvents: "none",
};

const playerBackgroundLogoStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 0,
  opacity: 0.08,
};

const playerBackgroundLogoImageStyle = {
  width: "70vw",
  maxWidth: 520,
  height: "auto",
};

function toMs(value) {
  if (value == null) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function getEffectivePhase(game, nowMs = Date.now()) {
  if (!game?.phase) return null;

  if (game.phase === "countdown" || game.phase === "question") {
    const questionStartedAtMs = toMs(game.question_started_at_ms);
    const durationMs = Number(game.question_duration || 0) * 1000;

    if (!Number.isFinite(questionStartedAtMs)) return game.phase;
    if (nowMs < questionStartedAtMs) return "countdown";
    if (durationMs > 0 && nowMs < questionStartedAtMs + durationMs) return "question";
    return "question";
  }

  return game.phase;
}

function getCountdownRemainingMs(game, nowMs = Date.now()) {
  if (!game) return 0;
  const questionStartedAtMs = toMs(game.question_started_at_ms);
  if (!Number.isFinite(questionStartedAtMs)) return 0;
  const diff = questionStartedAtMs - nowMs;
  return diff > 0 ? diff : 0;
}

function getQuestionRemainingMs(game, nowMs = Date.now()) {
  if (!game) return 0;
  const questionStartedAtMs = toMs(game.question_started_at_ms);
  const durationMs = Number(game.question_duration || 0) * 1000;
  if (!Number.isFinite(questionStartedAtMs) || durationMs <= 0) return 0;
  const diff = questionStartedAtMs + durationMs - nowMs;
  return diff > 0 ? diff : 0;
}

function getRemainingMs(game, nowMs = Date.now()) {
  const effectivePhase = getEffectivePhase(game, nowMs);
  if (effectivePhase !== "question") return 0;
  return getQuestionRemainingMs(game, nowMs);
}

function getRemainingTime(game, nowMs = Date.now()) {
  const remainingMs = getRemainingMs(game, nowMs);
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

function getCountdownSecondsBeforeStart(game, nowMs = Date.now()) {
  const ms = getCountdownRemainingMs(game, nowMs);
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 1000));
}

function getGameTitle(game) {
  return game?.title || "Il Quizzone di Simone";
}

function getAnswerColor(letter) {
  switch (letter) {
    case "A":
      return ANSWER_A;
    case "B":
      return ANSWER_B;
    case "C":
      return ANSWER_C;
    case "D":
      return ANSWER_D;
    default:
      return PRIMARY;
  }
}

function getPlayerAnswerButtonStyle(letter, disabled = false, isSelected = false) {
  return {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    border: isSelected ? "3px solid rgba(255,255,255,0.95)" : "2px solid rgba(255,255,255,0.14)",
    background: getAnswerColor(letter),
    color: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 18,
    fontWeight: "bold",
    position: "relative",
    zIndex: 1,
    opacity: disabled ? 0.55 : 1,
    boxShadow: isSelected
      ? "0 0 0 4px rgba(255,255,255,0.18), 0 0 24px rgba(255,255,255,0.25)"
      : "0 10px 24px rgba(0,0,0,0.22)",
    transform: isSelected ? "scale(1.03)" : "scale(1)",
    transition: "all 0.18s ease",
    animation: isSelected ? "selectedPulse 1s infinite" : "none",
  };
}

function getTvOptionStyle(letter, extra = {}) {
  return {
    background: getAnswerColor(letter),
    border: "2px solid rgba(255,255,255,0.16)",
    borderRadius: 18,
    padding: "16px 18px",
    boxShadow: "0 10px 26px rgba(0,0,0,0.22)",
    fontSize: "clamp(18px, 1.5vw, 30px)",
    fontWeight: "bold",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    textAlign: "left",
    lineHeight: 1.15,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    whiteSpace: "normal",
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
    transition: "all 0.25s ease",
    ...extra,
  };
}

function getTvRevealOptionStyle(letter, correctAnswer) {
  const isCorrect = letter === correctAnswer;

  return getTvOptionStyle(letter, {
    border: isCorrect
      ? "3px solid rgba(255,255,255,0.95)"
      : "2px solid rgba(255,255,255,0.10)",
    boxShadow: isCorrect
      ? "0 0 0 4px rgba(255,255,255,0.12), 0 0 30px rgba(34,197,94,0.65)"
      : "0 8px 20px rgba(0,0,0,0.18)",
    transform: isCorrect ? "scale(1.03)" : "scale(1)",
    opacity: isCorrect ? 1 : 0.45,
    filter: isCorrect ? "brightness(1.12)" : "brightness(0.7)",
  });
}

function useCountdownAudio(nowProvider) {
  const audioRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const activeRef = useRef(false);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(COUNTDOWN_AUDIO_SRC);
      audio.preload = "auto";
      audio.playsInline = true;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const stopCountdownAudio = useCallback(() => {
    activeRef.current = false;

    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const unlockAudio = useCallback(() => {
    try {
      const audio = ensureAudio();
      audio.muted = true;

      const playPromise = audio.play();

      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          })
          .catch(() => {
            audio.muted = false;
          });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }
    } catch {
      // ignore
    }
  }, [ensureAudio]);

  const startSyncedCountdown = useCallback(
    (startedAtMsValue, durationSeconds) => {
      stopCountdownAudio();

      if (!startedAtMsValue || !durationSeconds) return;

      const audio = ensureAudio();
      const startedAtMs = toMs(startedAtMsValue);
      if (Number.isNaN(startedAtMs)) return;

      activeRef.current = true;
      const GONG_TAIL_SECONDS = 5;

      const syncPlayback = () => {
        if (!activeRef.current) return;

        const nowMs = typeof nowProvider === "function" ? nowProvider() : Date.now();
        const elapsed = Math.max(0, (nowMs - startedAtMs) / 1000);
        const duration = Number(durationSeconds || COUNTDOWN_DURATION);

        const audioDuration =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : duration + GONG_TAIL_SECONDS;

        const maxPlayableTime = Math.min(audioDuration, duration + GONG_TAIL_SECONDS);

        if (elapsed >= maxPlayableTime) {
          stopCountdownAudio();
          return;
        }

        const desiredTime = Math.min(elapsed, Math.max(0, audioDuration - 0.05));

        if (Math.abs((audio.currentTime || 0) - desiredTime) > 0.2) {
          audio.currentTime = desiredTime;
        }

        if (audio.paused) {
          audio.play().catch(() => {});
        }
      };

      syncPlayback();
      syncIntervalRef.current = setInterval(syncPlayback, 100);
    },
    [ensureAudio, nowProvider, stopCountdownAudio]
  );

  useEffect(() => {
    return () => {
      stopCountdownAudio();
    };
  }, [stopCountdownAudio]);

  return {
    unlockAudio,
    startSyncedCountdown,
    stopCountdownAudio,
  };
}

function useRevealAudio() {
  const revealAudioRef = useRef(null);

  const playRevealAudio = useCallback(() => {
    if (!REVEAL_AUDIO_SRC) return;

    try {
      if (!revealAudioRef.current) {
        const audio = new Audio(REVEAL_AUDIO_SRC);
        audio.preload = "auto";
        audio.playsInline = true;
        revealAudioRef.current = audio;
      }

      const audio = revealAudioRef.current;
      audio.pause();
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  return { playRevealAudio };
}

export default function App() {
  const [role, setRole] = useState(null);

  const [status, setStatus] = useState("Pronto");
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);

  const [playerName, setPlayerName] = useState("");
  const [joinedPlayer, setJoinedPlayer] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [jollyUsed, setJollyUsed] = useState(false);

  const [hostBanner] = useState(null);
  const [finalRevealIndex, setFinalRevealIndex] = useState(-1);

  const [isLoading, setIsLoading] = useState(true);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [tvRevealEffect, setTvRevealEffect] = useState(null);
  const [tvJollyEffect, setTvJollyEffect] = useState(null);
  const [tvAudioReady, setTvAudioReady] = useState(false);
  const [hideTvAudioOverlay, setHideTvAudioOverlay] = useState(false);

  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [renderNow, setRenderNow] = useState(Date.now());

  const bannerTimeoutRef = useRef(null);
  const lastTvJollyEventIdRef = useRef(null);
  const tvJollyTimeoutRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const submitLockRef = useRef(false);
  const jollyLockRef = useRef(false);
  const fallbackRefreshRef = useRef(null);
  const phaseSwitchInFlightRef = useRef(false);
  const syncedNowRef = useRef(Date.now());
  const lastRevealQuestionIdRef = useRef(null);
  const lastTvQuestionAudioKeyRef = useRef(null);
  const tvQuestionAudioRef = useRef(null);

  const syncedNowMs = renderNow + serverOffsetMs;
  syncedNowRef.current = syncedNowMs;

  const syncServerClock = useCallback(async () => {
    try {
      let bestSample = null;

      for (let i = 0; i < 3; i += 1) {
        const t0 = Date.now();
        const { data, error } = await supabase.rpc("server_now_ms");
        const t1 = Date.now();

        if (error || typeof data !== "number") continue;

        const rtt = t1 - t0;
        const estimatedClientAtResponse = t0 + rtt / 2;
        const offset = data - estimatedClientAtResponse;

        if (!bestSample || rtt < bestSample.rtt) {
          bestSample = { offset, rtt };
        }
      }

      if (bestSample) {
        setServerOffsetMs(bestSample.offset);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setRenderNow(Date.now());
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    syncServerClock();
    const id = setInterval(() => {
      syncServerClock();
    }, 30000);
    return () => clearInterval(id);
  }, [syncServerClock]);

  const { unlockAudio, startSyncedCountdown, stopCountdownAudio } = useCountdownAudio(
    () => syncedNowRef.current
  );
  const { playRevealAudio } = useRevealAudio();

  const activateTvAudio = useCallback(async () => {
    setHideTvAudioOverlay(true);
    setTvAudioReady(true);

    try {
      unlockAudio();

      const audioEl = tvQuestionAudioRef.current;
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.muted = true;
        audioEl.src = COUNTDOWN_AUDIO_SRC;
        audioEl.load();

        try {
          await audioEl.play();
        } catch {
          // ignore
        }

        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.muted = false;
        audioEl.removeAttribute("src");
        audioEl.load();
      }
    } catch {
      // ignore
    }
  }, [unlockAudio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const roleFromUrl = params.get("role");

    if (roleFromUrl === "player") setRole("player");
    if (roleFromUrl === "tv") setRole("tv");
    if (roleFromUrl === "host") setRole("host");
  }, []);

  const effectivePhase = useMemo(() => getEffectivePhase(game, syncedNowMs), [game, syncedNowMs]);
  const localTimeLeft = useMemo(() => getRemainingTime(game, syncedNowMs), [game, syncedNowMs]);
  const countdownTimeLeft = useMemo(
    () => getCountdownSecondsBeforeStart(game, syncedNowMs),
    [game, syncedNowMs]
  );

  const hostDisplayedTime = useMemo(() => {
    if (effectivePhase === "countdown") return countdownTimeLeft;
    if (effectivePhase === "question") return localTimeLeft;
    return 0;
  }, [effectivePhase, countdownTimeLeft, localTimeLeft]);

  const currentQuestion = useMemo(() => {
    if (!game || questions.length === 0) return null;
    return questions.find((q) => q.position === game.current_question_index) || null;
  }, [game, questions]);

  const currentQuestionAnswers = useMemo(() => {
    if (!currentQuestion?.id) return [];
    return answers.filter((a) => a.question_id === currentQuestion.id);
  }, [answers, currentQuestion?.id]);

  const answerStats = useMemo(() => {
    const countA = currentQuestionAnswers.filter((a) => a.answer === "A").length;
    const countB = currentQuestionAnswers.filter((a) => a.answer === "B").length;
    const countC = currentQuestionAnswers.filter((a) => a.answer === "C").length;
    const countD = currentQuestionAnswers.filter((a) => a.answer === "D").length;

    const totalAnswered = currentQuestionAnswers.length;
    const totalPlayers = players.length;

    const percent = (value) => (totalAnswered > 0 ? Math.round((value / totalAnswered) * 100) : 0);

    return {
      totalAnswered,
      totalPlayers,
      A: { count: countA, percent: percent(countA) },
      B: { count: countB, percent: percent(countB) },
      C: { count: countC, percent: percent(countC) },
      D: { count: countD, percent: percent(countD) },
    };
  }, [currentQuestionAnswers, players.length]);

  const podiumPlayers = useMemo(
    () => [...players].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3),
    [players]
  );

  const tvLobbyPlayerColumns = useMemo(() => {
    if (players.length <= 8) return 1;
    if (players.length <= 18) return 2;
    return 3;
  }, [players.length]);

  const tvLobbyPlayerFontSize = useMemo(() => {
    if (players.length <= 8) return 28;
    if (players.length <= 14) return 24;
    if (players.length <= 22) return 20;
    return 17;
  }, [players.length]);

  const tvLobbyPlayerPadding = useMemo(() => {
    if (players.length <= 10) return "14px 18px";
    if (players.length <= 20) return "10px 14px";
    return "8px 12px";
  }, [players.length]);

  const tvQrSize = useMemo(() => {
    if (players.length <= 4) return 130;
    if (players.length <= 10) return 120;
    return 110;
  }, [players.length]);

  function normalizeQuestionTime() {
    return COUNTDOWN_DURATION;
  }

  async function getOrCreateGame() {
    const { data: existing, error: findError } = await supabase
      .from("games")
      .select("*")
      .eq("code", GAME_CODE)
      .maybeSingle();

    if (findError) throw findError;
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
      .from("games")
      .insert([
        {
          code: GAME_CODE,
          title: "Il Quizzone di Simone",
          phase: "lobby",
          current_question_index: 0,
          time_left: 0,
          countdown_started_at_ms: null,
          question_started_at_ms: null,
          question_started_at: null,
          question_duration: null,
          show_leaderboard: false,
        },
      ])
      .select()
      .single();

    if (createError) throw createError;
    return created;
  }

  async function ensureQuestions(gameId) {
    const { data: existing, error: checkError } = await supabase
      .from("questions")
      .select("*")
      .eq("game_id", gameId)
      .order("position");

    if (checkError) throw checkError;
    if (existing && existing.length > 0) return existing;

    const rows = DEMO_QUESTIONS.map((q) => ({
      game_id: gameId,
      ...q,
      time_limit: COUNTDOWN_DURATION,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("questions")
      .insert(rows)
      .select();

    if (insertError) throw insertError;
    return (inserted || []).sort((a, b) => a.position - b.position);
  }

  async function addLiveEvent(gameId, eventType, eventText, playerNameValue = null) {
    const { error } = await supabase.from("live_events").insert([
      {
        game_id: gameId,
        event_type: eventType,
        player_name: playerNameValue,
        event_text: eventText,
      },
    ]);
    if (error) throw error;
  }

  async function loadGameOnly() {
    const g = await getOrCreateGame();
    setGame(g);
    return g;
  }

  async function loadQuestionsOnly(gameId) {
    if (!gameId) return [];
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("game_id", gameId)
      .order("position");

    if (error) throw error;
    setQuestions(data || []);
    return data || [];
  }

  async function loadPlayersOnly(gameId) {
    if (!gameId) return [];
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", gameId)
      .order("score", { ascending: false });

    if (error) throw error;

    const sortedPlayers = [...(data || [])].sort((a, b) => {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    setPlayers(sortedPlayers);

    if (joinedPlayer?.id) {
      const updatedJoined = sortedPlayers.find((p) => p.id === joinedPlayer.id) || null;
      if (updatedJoined) {
        setJoinedPlayer(updatedJoined);
        setJollyUsed(Boolean(updatedJoined.jolly_used));
      }
    }

    return sortedPlayers;
  }
  const TV_BASE_WIDTH = 1920;
  const TV_BASE_HEIGHT = 1080;
  const [tvScale, setTvScale] = useState(1);

  useEffect(() => {
    if (role !== "tv") return;

    const updateTvScale = () => {
      const widthScale = window.innerWidth / TV_BASE_WIDTH;
      const heightScale = window.innerHeight / TV_BASE_HEIGHT;
      const nextScale = Math.min(widthScale, heightScale);
      setTvScale(nextScale > 0 ? nextScale : 1);
    };

    updateTvScale();
    window.addEventListener("resize", updateTvScale);

    return () => {
      window.removeEventListener("resize", updateTvScale);
    };
  }, [role]);

  if (role === "tv") {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: APP_BG,
          overflow: "hidden",
          position: "relative",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
        onClick={() => {
          if (!tvAudioReady) {
            activateTvAudio();
          }
        }}
      >
        <audio
          ref={tvQuestionAudioRef}
          preload="auto"
          playsInline
          style={{ display: "none" }}
        />

        {!hideTvAudioOverlay && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.55)",
              zIndex: 10000,
            }}
          >
            <div
              style={{
                ...panelStyle,
                textAlign: "center",
                width: "min(520px, 92vw)",
              }}
            >
              <div style={{ fontSize: 36, fontWeight: "bold", marginBottom: 12 }}>
                🔊 Attiva audio TV
              </div>
              <div style={{ fontSize: 20, opacity: 0.9, marginBottom: 20 }}>
                Premi una volta qui per abilitare audio countdown e audio domande
              </div>
              <button
                onClick={activateTvAudio}
                style={{ ...buttonStyle, fontSize: 20, padding: "16px 24px" }}
              >
                ATTIVA AUDIO
              </button>
            </div>
          </div>
        )}

        {tvJollyEffect && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,213,79,0.22)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                ...panelStyle,
                width: "min(950px, 92vw)",
                textAlign: "center",
                border: "3px solid rgba(255,213,79,0.95)",
                background: "rgba(255,213,79,0.20)",
                animation: "answerFlashPop 0.25s ease",
                boxShadow: "0 0 50px rgba(255,213,79,0.45)",
              }}
            >
              <div style={{ fontSize: 90, marginBottom: 12 }}>🃏</div>
              <div style={{ fontSize: 58, fontWeight: "bold", color: GOLD, marginBottom: 12 }}>
                JOLLY ATTIVATO
              </div>
              <div style={{ fontSize: 30, lineHeight: 1.35 }}>{tvJollyEffect.text}</div>
            </div>
          </div>
        )}

        {tvRevealEffect && !game?.show_leaderboard && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(36,193,107,0.20)",
              zIndex: 9997,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                ...panelStyle,
                width: "min(900px, 92vw)",
                textAlign: "center",
                border: "3px solid rgba(36,193,107,0.9)",
                background: "rgba(36,193,107,0.18)",
                animation: "answerFlashPop 0.25s ease",
                boxShadow: "0 0 40px rgba(36,193,107,0.35)",
              }}
            >
              <div style={{ fontSize: 88, marginBottom: 14 }}>✅</div>
              <div style={{ fontSize: 54, fontWeight: "bold", marginBottom: 10 }}>
                RISPOSTA ESATTA
              </div>
              <div style={{ fontSize: 40, color: GOLD, marginBottom: 12 }}>
                {tvRevealEffect.correctAnswer}
              </div>
              {tvRevealEffect.explanation && (
                <div style={{ fontSize: 28, lineHeight: 1.35, opacity: 0.95 }}>
                  {tvRevealEffect.explanation}
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`
          @keyframes podiumRise {
            from { transform: translateY(40px) scale(0.92); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes winnerGlow {
            0% { transform: scale(1); text-shadow: 0 0 0 rgba(255,255,255,0); }
            50% { transform: scale(1.08); text-shadow: 0 0 30px rgba(255,215,64,0.95); }
            100% { transform: scale(1); text-shadow: 0 0 12px rgba(255,215,64,0.55); }
          }
          @keyframes pulseTime {
            0% { transform: scale(1); }
            50% { transform: scale(1.12); }
            100% { transform: scale(1); }
          }
          @keyframes answerFlashPop {
            0% { transform: scale(0.85); opacity: 0; }
            20% { transform: scale(1.06); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes correctRevealGlow {
            0% { transform: scale(0.96); opacity: 0; }
            50% { transform: scale(1.03); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes selectedPulse {
            0% { box-shadow: 0 0 0 rgba(255,255,255,0); }
            50% { box-shadow: 0 0 24px rgba(255,255,255,0.28); }
            100% { box-shadow: 0 0 0 rgba(255,255,255,0); }
          }
        `}</style>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: TV_BASE_WIDTH,
            height: TV_BASE_HEIGHT,
            transform: `translate(-50%, -50%) scale(${tvScale})`,
            transformOrigin: "center center",
            overflow: "hidden",
          }}
        >
          <img src={LOGO_BG} alt="Logo quiz" style={tvLogoStyle} />

          <div
            style={{
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              paddingTop: 140,
              paddingBottom: 24,
              paddingLeft: 24,
              paddingRight: 24,
              overflow: "hidden",
            }}
          >
            {game?.phase === "lobby" && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div style={{ textAlign: "center", marginBottom: 14, flexShrink: 0 }}>
                  <h1
                    style={{
                      fontSize: 56,
                      margin: "0 0 8px 0",
                      lineHeight: 1.05,
                    }}
                  >
                    🍻 {getGameTitle(game)}
                  </h1>
                  <div style={{ fontSize: 26, opacity: 0.92 }}>
                    Inquadra il QR e unisciti alla partita
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "0.92fr 1.08fr",
                    gap: 18,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      ...panelStyle,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      overflow: "hidden",
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        background: "white",
                        padding: 12,
                        borderRadius: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
                        width: "fit-content",
                        maxWidth: "100%",
                        flexShrink: 1,
                      }}
                    >
                      <QRCodeSVG
                        value={PLAYER_JOIN_URL}
                        size={tvQrSize}
                        style={{
                          display: "block",
                          width: `${tvQrSize}px`,
                          height: `${tvQrSize}px`,
                          maxWidth: "100%",
                          maxHeight: "100%",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 26,
                        fontWeight: "bold",
                        textAlign: "center",
                        lineHeight: 1.1,
                      }}
                    >
                      📱 Inquadra per partecipare
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 20,
                        color: GOLD,
                        fontWeight: "bold",
                        textAlign: "center",
                        lineHeight: 1.1,
                      }}
                    >
                      Codice: {GAME_CODE}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        opacity: 0.72,
                        textAlign: "center",
                        maxWidth: "100%",
                        wordBreak: "break-all",
                      }}
                    >
                      {PLAYER_JOIN_URL}
                    </div>
                  </div>

                  <div
                    style={{
                      ...panelStyle,
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        textAlign: "center",
                        fontWeight: "bold",
                        fontSize: 32,
                        marginBottom: 14,
                        flexShrink: 0,
                      }}
                    >
                      Giocatori entrati ({players.length})
                    </div>

                    {players.length === 0 ? (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          borderRadius: 16,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          fontSize: 32,
                        }}
                      >
                        Nessun giocatore ancora collegato
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          display: "grid",
                          gridTemplateColumns: `repeat(${tvLobbyPlayerColumns}, minmax(0, 1fr))`,
                          gap: 10,
                          alignContent: "start",
                          overflow: "hidden",
                        }}
                      >
                        {players.map((player, index) => (
                          <div
                            key={player.id}
                            style={{
                              background:
                                index < 3
                                  ? "rgba(255,215,64,0.12)"
                                  : "rgba(255,255,255,0.06)",
                              border:
                                index < 3
                                  ? "1px solid rgba(255,215,64,0.32)"
                                  : "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 14,
                              padding: tvLobbyPlayerPadding,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              minWidth: 0,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                fontSize: tvLobbyPlayerFontSize,
                                fontWeight: "bold",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                minWidth: 0,
                                flex: 1,
                              }}
                              title={player.name}
                            >
                              {index + 1}. {player.name}
                            </div>

                            <div
                              style={{
                                fontSize: Math.max(12, tvLobbyPlayerFontSize - 8),
                                color: GOLD,
                                fontWeight: "bold",
                                flexShrink: 0,
                                whiteSpace: "nowrap",
                              }}
                            >
                              entrato
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {Boolean(game?.show_leaderboard) && game?.phase !== "final" && (
              <div style={{ ...panelStyle, padding: 40, height: "100%", overflow: "hidden" }}>
                <h2 style={{ fontSize: 56, marginBottom: 24, textAlign: "center" }}>
                  🏆 CLASSIFICA PROVVISORIA
                </h2>

                {players.length === 0 ? (
                  <div style={{ fontSize: 28, opacity: 0.85, textAlign: "center" }}>
                    Nessun giocatore
                  </div>
                ) : (
                  <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 18 }}>
                    {players.map((p, idx) => (
                      <div
                        key={p.id}
                        style={{
                          ...panelStyle,
                          fontSize: 34,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background:
                            idx === 0
                              ? "rgba(255,215,64,0.18)"
                              : idx === 1
                                ? "rgba(192,192,192,0.18)"
                                : idx === 2
                                  ? "rgba(205,127,50,0.18)"
                                  : "rgba(255,255,255,0.06)",
                          border:
                            idx === 0
                              ? "2px solid rgba(255,215,64,0.7)"
                              : "1px solid rgba(255,255,255,0.14)",
                        }}
                      >
                        <span>
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "•"} {idx + 1}.{" "}
                          {p.name}
                        </span>
                        <span style={{ color: GOLD, fontWeight: "bold" }}>{p.score || 0} pt</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!Boolean(game?.show_leaderboard) && effectivePhase === "question" && currentQuestion && (
              <div
                style={{
                  ...panelStyle,
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    textAlign: "center",
                    fontSize: currentQuestion.image_url ? 46 : 56,
                    fontWeight: "bold",
                    color: localTimeLeft <= 5 ? GOLD : "white",
                    lineHeight: 1,
                    animation:
                      localTimeLeft <= 5 && localTimeLeft > 0 ? "pulseTime 1s infinite" : "none",
                  }}
                >
                  ⏳ {localTimeLeft}
                </div>

                <div
                  style={{
                    ...panelStyle,
                    flexShrink: 0,
                    padding: currentQuestion.image_url ? "10px 14px" : "12px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontSize: currentQuestion.image_url
                        ? 26
                        : currentQuestion.audio_url
                          ? 30
                          : 36,
                      fontWeight: "bold",
                      lineHeight: 1.12,
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {currentQuestion.question}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: currentQuestion.image_url ? "0.95fr 1.05fr" : "1fr",
                    gap: 12,
                    overflow: "hidden",
                  }}
                >
                  {currentQuestion.image_url ? (
                    <div
                      style={{
                        ...panelStyle,
                        padding: 8,
                        minHeight: 0,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={currentQuestion.image_url}
                        alt="Immagine domanda"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.18)",
                        }}
                      />
                    </div>
                  ) : null}

                  <div
                    style={{
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      overflow: "hidden",
                    }}
                  >
                    {currentQuestion.audio_url && !currentQuestion.image_url && (
                      <div
                        style={{
                          ...questionAudioBoxStyle,
                          margin: 0,
                          padding: "10px 14px",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: 22,
                            lineHeight: 1.1,
                            marginBottom: 4,
                          }}
                        >
                          🔊 Audio domanda in riproduzione
                        </div>
                        <div
                          style={{
                            opacity: 0.88,
                            fontSize: 15,
                            lineHeight: 1.1,
                          }}
                        >
                          L'audio parte automaticamente sulla schermata TV.
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gridAutoRows: "1fr",
                        gap: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          ...getTvOptionStyle("A"),
                          fontSize: currentQuestion.image_url ? 21 : 28,
                          padding: currentQuestion.image_url ? "10px 12px" : "14px 16px",
                        }}
                      >
                        A - {currentQuestion.option_a}
                      </div>

                      <div
                        style={{
                          ...getTvOptionStyle("B"),
                          fontSize: currentQuestion.image_url ? 21 : 28,
                          padding: currentQuestion.image_url ? "10px 12px" : "14px 16px",
                        }}
                      >
                        B - {currentQuestion.option_b}
                      </div>

                      {currentQuestion.option_c ? (
                        <div
                          style={{
                            ...getTvOptionStyle("C"),
                            fontSize: currentQuestion.image_url ? 21 : 28,
                            padding: currentQuestion.image_url ? "10px 12px" : "14px 16px",
                          }}
                        >
                          C - {currentQuestion.option_c}
                        </div>
                      ) : (
                        <div style={{ visibility: "hidden" }} />
                      )}

                      {currentQuestion.option_d ? (
                        <div
                          style={{
                            ...getTvOptionStyle("D"),
                            fontSize: currentQuestion.image_url ? 21 : 28,
                            padding: currentQuestion.image_url ? "10px 12px" : "14px 16px",
                          }}
                        >
                          D - {currentQuestion.option_d}
                        </div>
                      ) : (
                        <div style={{ visibility: "hidden" }} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!Boolean(game?.show_leaderboard) && effectivePhase === "countdown" && currentQuestion && (
              <div
                style={{
                  ...panelStyle,
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 18,
                  padding: 24,
                  overflow: "hidden",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: "bold",
                    color: GOLD,
                    lineHeight: 1,
                  }}
                >
                  {countdownTimeLeft}
                </div>

                <div
                  style={{
                    fontSize: 38,
                    opacity: 0.95,
                    lineHeight: 1.15,
                  }}
                >
                  Prossima domanda tra...
                </div>

                <div
                  style={{
                    ...panelStyle,
                    padding: "14px 18px",
                    maxWidth: 1100,
                    margin: "0 auto",
                  }}
                >
                  <div
                    style={{
                      fontSize: currentQuestion.image_url ? 30 : 38,
                      fontWeight: "bold",
                      lineHeight: 1.15,
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {currentQuestion.question}
                  </div>
                </div>

                {currentQuestion.image_url && (
                  <div
                    style={{
                      ...panelStyle,
                      padding: 10,
                      flex: 1,
                      minHeight: 0,
                      maxWidth: 1100,
                      width: "100%",
                      margin: "0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={currentQuestion.image_url}
                      alt="Immagine domanda"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        borderRadius: 14,
                        background: "rgba(0,0,0,0.18)",
                      }}
                    />
                  </div>
                )}

                {currentQuestion.audio_url && !currentQuestion.image_url && (
                  <div
                    style={{
                      ...questionAudioBoxStyle,
                      maxWidth: 900,
                      width: "100%",
                      margin: "0 auto",
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: 10, fontSize: 30 }}>
                      🔊 Audio domanda in partenza
                    </div>
                    <div style={{ opacity: 0.88, fontSize: 22 }}>
                      L'audio verrà riprodotto automaticamente allo start della domanda.
                    </div>
                  </div>
                )}
              </div>
            )}

            {!Boolean(game?.show_leaderboard) && game?.phase === "stats" && currentQuestion && (
              <div
                style={{
                  ...panelStyle,
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: 24,
                  overflow: "hidden",
                }}
              >
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 48,
                      fontWeight: "bold",
                      marginBottom: 8,
                    }}
                  >
                    📊 RISPOSTE RACCOLTE
                  </div>
                  <div style={{ fontSize: 26, opacity: 0.92 }}>
                    {answerStats.totalAnswered} / {answerStats.totalPlayers} giocatori hanno risposto
                  </div>
                </div>

                <div
                  style={{
                    ...panelStyle,
                    flexShrink: 0,
                    padding: "12px 16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: currentQuestion.image_url ? 26 : 34,
                      fontWeight: "bold",
                      lineHeight: 1.15,
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {currentQuestion.question}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: currentQuestion.image_url ? "0.9fr 1.1fr" : "1fr",
                    gap: 16,
                    overflow: "hidden",
                  }}
                >
                  {currentQuestion.image_url ? (
                    <div
                      style={{
                        ...panelStyle,
                        padding: 8,
                        minHeight: 0,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={currentQuestion.image_url}
                        alt="Immagine domanda"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.18)",
                        }}
                      />
                    </div>
                  ) : null}

                  <div
                    style={{
                      minHeight: 0,
                      display: "grid",
                      gap: 12,
                      alignContent: "stretch",
                      overflow: "hidden",
                    }}
                  >
                    {renderStatsBar("A", currentQuestion.option_a)}
                    {renderStatsBar("B", currentQuestion.option_b)}
                    {currentQuestion.option_c && renderStatsBar("C", currentQuestion.option_c)}
                    {currentQuestion.option_d && renderStatsBar("D", currentQuestion.option_d)}
                  </div>
                </div>
              </div>
            )}

            {!Boolean(game?.show_leaderboard) && game?.phase === "reveal" && currentQuestion && (
              <div
                style={{
                  ...panelStyle,
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: 24,
                  overflow: "hidden",
                }}
              >
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 54,
                      fontWeight: "bold",
                      color: GREEN,
                      marginBottom: 10,
                    }}
                  >
                    ✅ RISPOSTA CORRETTA: {currentQuestion.correct_answer}
                  </div>
                </div>

                <div
                  style={{
                    ...panelStyle,
                    flexShrink: 0,
                    padding: "12px 16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: currentQuestion.image_url ? 26 : 34,
                      fontWeight: "bold",
                      lineHeight: 1.15,
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {currentQuestion.question}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: currentQuestion.image_url ? "0.9fr 1.1fr" : "1fr",
                    gap: 16,
                    overflow: "hidden",
                  }}
                >
                  {currentQuestion.image_url ? (
                    <div
                      style={{
                        ...panelStyle,
                        padding: 8,
                        minHeight: 0,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={currentQuestion.image_url}
                        alt="Immagine domanda"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          borderRadius: 14,
                          background: "rgba(0,0,0,0.18)",
                        }}
                      />
                    </div>
                  ) : null}

                  <div
                    style={{
                      minHeight: 0,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gridAutoRows: "1fr",
                      gap: 12,
                      overflow: "hidden",
                    }}
                  >
                    <div style={getTvRevealOptionStyle("A", currentQuestion.correct_answer)}>
                      A - {currentQuestion.option_a}
                    </div>
                    <div style={getTvRevealOptionStyle("B", currentQuestion.correct_answer)}>
                      B - {currentQuestion.option_b}
                    </div>
                    {currentQuestion.option_c ? (
                      <div style={getTvRevealOptionStyle("C", currentQuestion.correct_answer)}>
                        C - {currentQuestion.option_c}
                      </div>
                    ) : (
                      <div style={{ visibility: "hidden" }} />
                    )}
                    {currentQuestion.option_d ? (
                      <div style={getTvRevealOptionStyle("D", currentQuestion.correct_answer)}>
                        D - {currentQuestion.option_d}
                      </div>
                    ) : (
                      <div style={{ visibility: "hidden" }} />
                    )}
                  </div>
                </div>

                {currentQuestion.explanation && (
                  <div
                    style={{
                      ...panelStyle,
                      flexShrink: 0,
                      padding: "12px 16px",
                      textAlign: "center",
                      fontSize: 22,
                      lineHeight: 1.2,
                    }}
                  >
                    {currentQuestion.explanation}
                  </div>
                )}
              </div>
            )}

            {game?.phase === "final" && (
              <div
                style={{
                  ...panelStyle,
                  padding: 40,
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                <h2 style={{ fontSize: 56, marginBottom: 24, textAlign: "center" }}>
                  🏆 PODIO FINALE
                </h2>

                <div style={{ display: "grid", gap: 18, maxWidth: 800, margin: "0 auto" }}>
                  {finalRevealIndex >= 2 && podiumPlayers[2] && (
                    <div
                      style={{
                        ...panelStyle,
                        fontSize: 34,
                        background: "rgba(205,127,50,0.22)",
                        animation: "podiumRise 0.8s ease",
                      }}
                    >
                      🥉 3° POSTO — {podiumPlayers[2].name} — {podiumPlayers[2].score} punti
                    </div>
                  )}

                  {finalRevealIndex >= 1 && podiumPlayers[1] && (
                    <div
                      style={{
                        ...panelStyle,
                        fontSize: 38,
                        background: "rgba(192,192,192,0.22)",
                        animation: "podiumRise 0.8s ease",
                      }}
                    >
                      🥈 2° POSTO — {podiumPlayers[1].name} — {podiumPlayers[1].score} punti
                    </div>
                  )}

                  {finalRevealIndex >= 0 && podiumPlayers[0] && (
                    <div
                      style={{
                        ...panelStyle,
                        fontSize: 46,
                        background: "rgba(255,215,64,0.25)",
                        animation: "winnerGlow 1.6s infinite",
                        border: "2px solid rgba(255,215,64,0.8)",
                      }}
                    >
                      🥇 1° POSTO — {podiumPlayers[0].name} — {podiumPlayers[0].score} punti
                      <div style={{ fontSize: 56, marginTop: 16 }}>🎉 VINCITORE! 🎉</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, position: "relative" }}>
      {hostBanner && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: RED,
            color: "white",
            padding: "18px 28px",
            borderRadius: 12,
            fontWeight: "bold",
            fontSize: 24,
            zIndex: 9999,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {hostBanner.event_text}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", fontSize: 42 }}>🎤 HOST</h1>
        <p style={{ textAlign: "center" }}>
          <b>Stato:</b> {status}
        </p>
        <p style={{ textAlign: "center" }}>
          <b>Fase DB:</b> {game?.phase || "-"}
        </p>
        <p style={{ textAlign: "center" }}>
          <b>Fase reale:</b> {effectivePhase || "-"}
        </p>
        <p style={{ textAlign: "center" }}>
          <b>Tempo:</b> {hostDisplayedTime}
        </p>
        <p style={{ textAlign: "center" }}>
          <b>Codice:</b> {GAME_CODE}
        </p>
        {isLoading && <p style={{ textAlign: "center", opacity: 0.8 }}>Caricamento...</p>}

        <div style={{ ...panelStyle, textAlign: "center", marginBottom: 20 }}>
          <button onClick={() => loadAll()} style={buttonStyle}>
            Aggiorna
          </button>
          <button onClick={startQuiz} style={buttonStyle}>
            Avvia quiz
          </button>
          <button onClick={revealAnswer} style={buttonStyle}>
            Mostra risposta
          </button>
          <button onClick={nextQuestion} style={buttonStyle}>
            Prossima domanda
          </button>
          <button onClick={toggleLeaderboardOnTv} style={buttonStyle}>
            {game?.show_leaderboard ? "Nascondi classifica TV" : "Mostra classifica TV"}
          </button>
          <button onClick={resetAll} style={{ ...buttonStyle, background: RED }}>
            Reset
          </button>

          <label style={{ ...buttonStyle, display: "inline-block" }}>
            Importa CSV
            <input
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => importCsvQuestions(e.target.files?.[0])}
            />
          </label>
        </div>

        {currentQuestion && (
          <div style={{ ...panelStyle, marginBottom: 24 }}>
            <h2>Domanda corrente</h2>

            {renderQuestionMedia(currentQuestion, "host")}

            <p style={{ fontSize: 24, fontWeight: "bold" }}>{currentQuestion.question}</p>
            <p>A - {currentQuestion.option_a}</p>
            <p>B - {currentQuestion.option_b}</p>
            {currentQuestion.option_c && <p>C - {currentQuestion.option_c}</p>}
            {currentQuestion.option_d && <p>D - {currentQuestion.option_d}</p>}

            {currentQuestion.image_url && (
              <p style={{ marginTop: 10, opacity: 0.88 }}>
                <b>Image URL:</b> {currentQuestion.image_url}
              </p>
            )}
            {currentQuestion.audio_url && (
              <p style={{ opacity: 0.88 }}>
                <b>Audio presente:</b> sì
              </p>
            )}

            {(game?.phase === "question" || game?.phase === "stats" || game?.phase === "reveal") && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 6 }}>
                  Risposte ricevute: {answerStats.totalAnswered} / {answerStats.totalPlayers}
                </div>
                <div style={{ fontSize: 16, opacity: 0.92 }}>
                  A {answerStats.A.percent}% · B {answerStats.B.percent}%
                  {currentQuestion.option_c ? ` · C ${answerStats.C.percent}%` : ""}
                  {currentQuestion.option_d ? ` · D ${answerStats.D.percent}%` : ""}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <div style={panelStyle}>
            <h2>Classifica</h2>
            {players.length === 0 ? (
              <p>Nessun giocatore ancora.</p>
            ) : (
              players.map((p, idx) => (
                <div key={p.id} style={{ marginBottom: 10, fontSize: 18 }}>
                  {idx + 1}. {p.name} - {p.score || 0} punti
                </div>
              ))
            )}
          </div>

          <div style={panelStyle}>
            <h2>Eventi live</h2>
            {liveEvents.length === 0 ? (
              <p>Nessun evento.</p>
            ) : (
              liveEvents.map((event) => (
                <div
                  key={event.id}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 8,
                    textAlign: "left",
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  {event.event_text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}