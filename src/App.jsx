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
    padding: 20,
    boxShadow: "0 10px 26px rgba(0,0,0,0.22)",
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    textAlign: "left",
    lineHeight: 1.2,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    minHeight: 90,
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

  async function loadAnswersOnly(gameId) {
    if (!gameId) return [];
    const { data, error } = await supabase.from("answers").select("*").eq("game_id", gameId);
    if (error) throw error;
    setAnswers(data || []);
    return data || [];
  }

  async function loadEventsOnly(gameId) {
    if (!gameId) return [];
    const { data, error } = await supabase
      .from("live_events")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;

    const sortedEvents = [...(data || [])].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    setLiveEvents(sortedEvents);
    return sortedEvents;
  }

  async function loadAll({ silent = false } = {}) {
    try {
      if (!silent) setIsLoading(true);
      const g = await loadGameOnly();

      await Promise.all([
        loadQuestionsOnly(g.id),
        loadPlayersOnly(g.id),
        loadAnswersOnly(g.id),
        loadEventsOnly(g.id),
      ]);

      if (!silent) setStatus("Dati caricati");
    } catch (error) {
      console.error(error);
      setStatus("Errore caricamento: " + error.message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  function normalizeCsvRows(rows) {
    return rows
      .filter((row) => row.question && row.correct_answer)
      .map((row, index) => {
        const type = String(row.type || "multiple").trim().toLowerCase();
        const cleanedType =
          type === "truefalse" || type === "vero_falso" ? "truefalse" : "multiple";

        return {
          position: index,
          round: Number(row.round || 1),
          type: cleanedType,
          question: String(row.question || "").trim(),
          option_a:
            cleanedType === "truefalse"
              ? String(row.option_a || "Vero").trim() || "Vero"
              : String(row.option_a || "").trim(),
          option_b:
            cleanedType === "truefalse"
              ? String(row.option_b || "Falso").trim() || "Falso"
              : String(row.option_b || "").trim(),
          option_c:
            cleanedType === "truefalse" ? null : String(row.option_c || "").trim() || null,
          option_d:
            cleanedType === "truefalse" ? null : String(row.option_d || "").trim() || null,
          correct_answer: String(row.correct_answer || "").trim().toUpperCase(),
          explanation: String(row.explanation || "").trim(),
          time_limit: COUNTDOWN_DURATION,
          points: Number(row.points || 100),
          image_url: String(row.image_url || "").trim(),
          audio_url: String(row.audio_url || "").trim(),
        };
      });
  }

  async function importCsvQuestions(file) {
    if (!file || !game) return;
    setStatus("Import CSV in corso...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const parsedRows = normalizeCsvRows(results.data || []);

          if (!parsedRows.length) {
            setStatus("CSV vuoto o non valido");
            return;
          }

          await supabase.from("answers").delete().eq("game_id", game.id);
          await supabase.from("questions").delete().eq("game_id", game.id);

          const rowsToInsert = parsedRows.map((row) => ({
            game_id: game.id,
            ...row,
          }));

          const { error } = await supabase.from("questions").insert(rowsToInsert);
          if (error) throw error;

          await supabase
            .from("games")
            .update({
              phase: "lobby",
              current_question_index: 0,
              time_left: 0,
              countdown_started_at_ms: null,
              question_started_at_ms: null,
              question_started_at: null,
              question_duration: null,
              show_leaderboard: false,
            })
            .eq("id", game.id);

          await addLiveEvent(
            game.id,
            "csv_imported",
            `📁 Importate ${parsedRows.length} domande da CSV`
          );

          setSelectedAnswer(null);
          setJollyUsed(false);
          setFinalRevealIndex(-1);
          submitLockRef.current = false;
          jollyLockRef.current = false;
          phaseSwitchInFlightRef.current = false;
          setAnswers([]);

          await loadAll();
          setStatus(`Import completato: ${parsedRows.length} domande`);
        } catch (error) {
          console.error(error);
          setStatus("Errore import CSV: " + error.message);
        }
      },
      error: () => {
        setStatus("Errore lettura CSV");
      },
    });
  }

  async function joinGame() {
    if (!playerName.trim()) {
      setStatus("Scrivi un nome squadra");
      return;
    }

    try {
      const { data: freshGame, error: freshGameError } = await supabase
        .from("games")
        .select("id, phase")
        .eq("code", GAME_CODE)
        .single();

      if (freshGameError) throw freshGameError;

      if (freshGame.phase !== "lobby") {
        setStatus("Partita in corso, attendi una nuova partita");
        return;
      }

      const trimmedName = playerName.trim().replace(/\s+/g, " ");

      const { data: existing, error: existingError } = await supabase
        .from("players")
        .select("*")
        .eq("game_id", freshGame.id)
        .ilike("name", trimmedName)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        setStatus("Nome squadra già presente, scegline un altro");
        return;
      }

      const { data, error } = await supabase
        .from("players")
        .insert([
          {
            game_id: freshGame.id,
            name: trimmedName,
            score: 0,
            jolly_used: false,
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          setStatus("Nome già usato, scegline un altro");
          return;
        }
        throw error;
      }

      await addLiveEvent(
        freshGame.id,
        "player_joined",
        `🎉 ${trimmedName} è entrato nel quiz!`,
        trimmedName
      );

      setJoinedPlayer(data);
      setJollyUsed(false);
      setStatus("Giocatore aggiunto");
      setPlayerName("");

      setPlayers((prev) => {
        const withoutDup = prev.filter((p) => p.id !== data.id);
        const next = [...withoutDup, data];
        return next.sort((a, b) => {
          const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });
      });

      await loadEventsOnly(freshGame.id);
    } catch (error) {
      console.error(error);
      setStatus("Errore inserimento: " + error.message);
    }
  }

  async function startQuiz() {
    if (!game || !questions.length) return;

    try {
      await supabase.from("answers").delete().eq("game_id", game.id);
      await supabase.from("players").update({ score: 0, jolly_used: false }).eq("game_id", game.id);

      const firstQuestion = questions.find((q) => q.position === 0) || questions[0];
      const firstTime = normalizeQuestionTime(firstQuestion);

      const countdownStartedAtMs = Math.round(syncedNowRef.current);
      const questionStartedAtMs = countdownStartedAtMs + QUESTION_START_DELAY_MS;

      const { data: updatedGame, error } = await supabase
        .from("games")
        .update({
          phase: "countdown",
          current_question_index: 0,
          time_left: firstTime,
          countdown_started_at_ms: countdownStartedAtMs,
          question_started_at_ms: questionStartedAtMs,
          question_started_at: new Date(questionStartedAtMs).toISOString(),
          question_duration: firstTime,
          show_leaderboard: false,
        })
        .eq("id", game.id)
        .select()
        .single();

      if (error) throw error;

      await addLiveEvent(game.id, "quiz_started", "🚀 Il quiz è iniziato!");

      setGame(updatedGame);
      setSelectedAnswer(null);
      setJollyUsed(false);
      setFinalRevealIndex(-1);
      submitLockRef.current = false;
      jollyLockRef.current = false;
      phaseSwitchInFlightRef.current = false;
      setAnswers([]);

      await Promise.all([
        loadPlayersOnly(game.id),
        loadAnswersOnly(game.id),
        loadEventsOnly(game.id),
      ]);

      setStatus("Quiz avviato");
    } catch (error) {
      console.error(error);
      setStatus("Errore avvio: " + error.message);
    }
  }

  async function revealAnswer() {
    if (!game) return;

    try {
      const { data, error } = await supabase
        .from("games")
        .update({
          phase: "reveal",
          countdown_started_at_ms: null,
          question_started_at_ms: null,
          question_started_at: null,
          question_duration: null,
          time_left: 0,
          show_leaderboard: false,
        })
        .eq("id", game.id)
        .select()
        .single();

      if (error) throw error;

      await addLiveEvent(
        game.id,
        "answer_revealed",
        `✅ Risposta corretta: ${currentQuestion?.correct_answer || "-"}`
      );

      setGame(data);
      phaseSwitchInFlightRef.current = false;
      await loadEventsOnly(game.id);
      setStatus("Risposta mostrata");
    } catch (error) {
      console.error(error);
      setStatus("Errore reveal: " + error.message);
    }
  }

  async function nextQuestion() {
    if (!game) return;

    const nextIndex = game.current_question_index + 1;

    if (nextIndex >= questions.length) {
      try {
        const { data, error } = await supabase
          .from("games")
          .update({
            phase: "final",
            time_left: 0,
            countdown_started_at_ms: null,
            question_started_at_ms: null,
            question_started_at: null,
            question_duration: null,
            show_leaderboard: false,
          })
          .eq("id", game.id)
          .select()
          .single();

        if (error) throw error;

        await addLiveEvent(game.id, "final_started", "🏁 Quiz terminato! Classifica finale.");

        setGame(data);
        setFinalRevealIndex(-1);
        phaseSwitchInFlightRef.current = false;
        await loadEventsOnly(game.id);
        setStatus("Quiz finito");
      } catch (error) {
        console.error(error);
        setStatus("Errore fine quiz: " + error.message);
      }
      return;
    }

    const q = questions.find((item) => item.position === nextIndex);
    if (!q) return;

    try {
      const duration = normalizeQuestionTime(q);
      const countdownStartedAtMs = Math.round(syncedNowRef.current);
      const questionStartedAtMs = countdownStartedAtMs + QUESTION_START_DELAY_MS;

      const { data: updatedGame, error } = await supabase
        .from("games")
        .update({
          phase: "countdown",
          current_question_index: nextIndex,
          time_left: duration,
          countdown_started_at_ms: countdownStartedAtMs,
          question_started_at_ms: questionStartedAtMs,
          question_started_at: new Date(questionStartedAtMs).toISOString(),
          question_duration: duration,
          show_leaderboard: false,
        })
        .eq("id", game.id)
        .select()
        .single();

      if (error) throw error;

      await addLiveEvent(game.id, "next_question", `🎯 Nuova domanda: ${nextIndex + 1}`);

      setSelectedAnswer(null);
      setGame(updatedGame);
      setStatus("Domanda successiva");
      submitLockRef.current = false;
      jollyLockRef.current = false;
      phaseSwitchInFlightRef.current = false;
      setTvRevealEffect(null);
      setTvJollyEffect(null);
      lastTvQuestionAudioKeyRef.current = null;
    } catch (error) {
      console.error(error);
      setStatus("Errore next question: " + error.message);
    }
  }

  async function resetAll() {
    if (!game) return;

    try {
      await supabase.from("answers").delete().eq("game_id", game.id);
      await supabase.from("players").delete().eq("game_id", game.id);
      await supabase.from("questions").delete().eq("game_id", game.id);
      await supabase.from("live_events").delete().eq("game_id", game.id);

      const { data, error } = await supabase
        .from("games")
        .update({
          phase: "lobby",
          current_question_index: 0,
          time_left: 0,
          countdown_started_at_ms: null,
          question_started_at_ms: null,
          question_started_at: null,
          question_duration: null,
          show_leaderboard: false,
        })
        .eq("id", game.id)
        .select()
        .single();

      if (error) throw error;

      setJoinedPlayer(null);
      setSelectedAnswer(null);
      setJollyUsed(false);
      setPlayers([]);
      setQuestions([]);
      setAnswers([]);
      setLiveEvents([]);
      setFinalRevealIndex(-1);
      submitLockRef.current = false;
      jollyLockRef.current = false;
      phaseSwitchInFlightRef.current = false;
      setGame(data);
      setTvAudioReady(false);
      setHideTvAudioOverlay(false);
      lastTvQuestionAudioKeyRef.current = null;

      await loadAll({ silent: true });
      setStatus("Partita resettata");
    } catch (error) {
      console.error(error);
      setStatus("Errore reset: " + error.message);
    }
  }

  async function toggleLeaderboardOnTv() {
    if (!game) return;

    try {
      const newValue = !Boolean(game.show_leaderboard);

      const { data, error } = await supabase
        .from("games")
        .update({
          show_leaderboard: newValue,
        })
        .eq("id", game.id)
        .select()
        .single();

      if (error) throw error;

      setGame(data);
      setStatus(newValue ? "Classifica mostrata in TV" : "Classifica nascosta in TV");
    } catch (error) {
      console.error(error);
      setStatus("Errore classifica TV: " + error.message);
    }
  }

  async function useJollyCard() {
    if (!joinedPlayer || !game || !currentQuestion) return;
    if (jollyLockRef.current) return;

    if (effectivePhase !== "question" || getRemainingMs(game, syncedNowRef.current) <= 0) {
      setStatus("Il JOLLY si usa durante la domanda");
      return;
    }

    if (jollyUsed || joinedPlayer.jolly_used) {
      setStatus("JOLLY già usato");
      return;
    }

    try {
      jollyLockRef.current = true;

      const { data: already, error: alreadyError } = await supabase
        .from("answers")
        .select("id")
        .eq("question_id", currentQuestion.id)
        .eq("player_id", joinedPlayer.id)
        .maybeSingle();

      if (alreadyError) throw alreadyError;

      if (already) {
        setStatus("Hai già risposto a questa domanda");
        return;
      }

      const gainedPoints = 100;
      const currentScore = Number(joinedPlayer.score || 0);

      const { error: insertAnswerError } = await supabase.from("answers").insert([
        {
          game_id: game.id,
          question_id: currentQuestion.id,
          player_id: joinedPlayer.id,
          answer: currentQuestion.correct_answer,
          is_correct: true,
          score_awarded: gainedPoints,
        },
      ]);

      if (insertAnswerError) throw insertAnswerError;

      const { data: updatedPlayer, error: updatePlayerError } = await supabase
        .from("players")
        .update({
          score: currentScore + gainedPoints,
          jolly_used: true,
        })
        .eq("id", joinedPlayer.id)
        .select()
        .single();

      if (updatePlayerError) throw updatePlayerError;

      await addLiveEvent(
        game.id,
        "jolly_used",
        `🔥 ${joinedPlayer.name} ha usato il JOLLY! +100 punti`,
        joinedPlayer.name
      );

      setJoinedPlayer(updatedPlayer);
      setJollyUsed(true);
      setSelectedAnswer(currentQuestion.correct_answer);
      setAnswerFeedback({ type: "correct", points: gainedPoints });
      setStatus("💥 JOLLY USATO: risposta corretta automatica! +100 punti");

      await Promise.all([
        loadPlayersOnly(game.id),
        loadAnswersOnly(game.id),
        loadEventsOnly(game.id),
      ]);
    } catch (error) {
      console.error(error);
      setStatus("Errore JOLLY: " + error.message);
    } finally {
      jollyLockRef.current = false;
    }
  }

  async function submitAnswer(letter) {
    if (!joinedPlayer || !currentQuestion || !game) return;
    if (submitLockRef.current) return;
    if (effectivePhase !== "question") return;
    if (selectedAnswer) return;
    if (getRemainingMs(game, syncedNowRef.current) <= 0) return;

    try {
      submitLockRef.current = true;

      const { data: already, error: alreadyError } = await supabase
        .from("answers")
        .select("*")
        .eq("question_id", currentQuestion.id)
        .eq("player_id", joinedPlayer.id)
        .maybeSingle();

      if (alreadyError) throw alreadyError;

      if (already) {
        setSelectedAnswer(already.answer);
        setStatus("Hai già risposto");
        return;
      }

      const isCorrect = letter === currentQuestion.correct_answer;
      let gainedPoints = 0;

      if (isCorrect) {
        const totalTime = COUNTDOWN_DURATION;
        const remainingSecondsExact = Math.max(0, getRemainingMs(game, syncedNowRef.current) / 1000);
        const basePoints = 100;
        const speedRatio = totalTime > 0 ? remainingSecondsExact / totalTime : 0;
        const speedBonus = Math.round(speedRatio * 100);
        gainedPoints = basePoints + speedBonus;
      }

      const { error: insertError } = await supabase.from("answers").insert([
        {
          game_id: game.id,
          question_id: currentQuestion.id,
          player_id: joinedPlayer.id,
          answer: letter,
          is_correct: isCorrect,
          score_awarded: gainedPoints,
        },
      ]);

      if (insertError) throw insertError;

      if (isCorrect) {
        const currentScore = Number(joinedPlayer.score || 0);

        const { data: updatedPlayer, error: updateError } = await supabase
          .from("players")
          .update({ score: currentScore + gainedPoints })
          .eq("id", joinedPlayer.id)
          .select()
          .single();

        if (updateError) throw updateError;
        setJoinedPlayer(updatedPlayer);
      }

      setSelectedAnswer(letter);
      setAnswerFeedback({ type: isCorrect ? "correct" : "wrong", points: gainedPoints });
      setStatus(isCorrect ? `Corretto! +${gainedPoints} punti` : "Risposta inviata");

      await Promise.all([loadPlayersOnly(game.id), loadAnswersOnly(game.id)]);
    } catch (error) {
      console.error(error);
      setStatus("Errore risposta: " + error.message);
    } finally {
      submitLockRef.current = false;
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setIsLoading(true);
        const g = await loadGameOnly();
        await ensureQuestions(g.id);

        await Promise.all([
          loadQuestionsOnly(g.id),
          loadPlayersOnly(g.id),
          loadAnswersOnly(g.id),
          loadEventsOnly(g.id),
        ]);

        setStatus("Dati caricati");
      } catch (error) {
        console.error(error);
        setStatus("Errore caricamento: " + error.message);
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!game?.id) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const sortPlayersRealtime = (list) =>
      [...list].sort((a, b) => {
        const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });

    const sortEventsRealtime = (list) =>
      [...list]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 12);

    const channel = supabase
      .channel(`quiz-live-${game.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${game.id}` },
        async (payload) => {
          if (payload?.new) {
            setGame(payload.new);
          } else {
            await loadGameOnly();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `game_id=eq.${game.id}` },
        async (payload) => {
          const eventType = payload?.eventType;
          const newRow = payload?.new;
          const oldRow = payload?.old;

          if (eventType === "INSERT" && newRow) {
            setPlayers((prev) =>
              sortPlayersRealtime([...prev.filter((p) => p.id !== newRow.id), newRow])
            );
            return;
          }

          if (eventType === "UPDATE" && newRow) {
            setPlayers((prev) =>
              sortPlayersRealtime(prev.map((p) => (p.id === newRow.id ? newRow : p)))
            );

            if (joinedPlayer?.id === newRow.id) {
              setJoinedPlayer(newRow);
              setJollyUsed(Boolean(newRow.jolly_used));
            }
            return;
          }

          if (eventType === "DELETE" && oldRow) {
            setPlayers((prev) => prev.filter((p) => p.id !== oldRow.id));

            if (joinedPlayer?.id === oldRow.id) {
              setJoinedPlayer(null);
              setJollyUsed(false);
            }
            return;
          }

          await loadPlayersOnly(game.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions", filter: `game_id=eq.${game.id}` },
        async () => {
          await loadQuestionsOnly(game.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `game_id=eq.${game.id}` },
        async () => {
          await loadAnswersOnly(game.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_events", filter: `game_id=eq.${game.id}` },
        async (payload) => {
          const eventType = payload?.eventType;
          const newRow = payload?.new;
          const oldRow = payload?.old;

          if (eventType === "INSERT" && newRow) {
            setLiveEvents((prev) =>
              sortEventsRealtime([newRow, ...prev.filter((e) => e.id !== newRow.id)])
            );
            return;
          }

          if (eventType === "UPDATE" && newRow) {
            setLiveEvents((prev) =>
              sortEventsRealtime(prev.map((e) => (e.id === newRow.id ? newRow : e)))
            );
            return;
          }

          if (eventType === "DELETE" && oldRow) {
            setLiveEvents((prev) => prev.filter((e) => e.id !== oldRow.id));
            return;
          }

          await loadEventsOnly(game.id);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          loadPlayersOnly(game.id).catch(() => {});
          loadEventsOnly(game.id).catch(() => {});
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [game?.id, joinedPlayer?.id]);

  useEffect(() => {
    if (fallbackRefreshRef.current) {
      clearInterval(fallbackRefreshRef.current);
      fallbackRefreshRef.current = null;
    }

    if (!game?.id) return;

    fallbackRefreshRef.current = setInterval(() => {
      loadPlayersOnly(game.id).catch(() => {});
      loadEventsOnly(game.id).catch(() => {});
    }, 5000);

    return () => {
      if (fallbackRefreshRef.current) {
        clearInterval(fallbackRefreshRef.current);
        fallbackRefreshRef.current = null;
      }
    };
  }, [game?.id]);

  useEffect(() => {
    if (effectivePhase === "countdown" || effectivePhase === "question") {
      setSelectedAnswer(null);
      setAnswerFeedback(null);
      submitLockRef.current = false;
    }
  }, [game?.current_question_index, effectivePhase]);

  useEffect(() => {
    if (!answerFeedback) return;
    const timeout = setTimeout(() => {
      setAnswerFeedback(null);
    }, 1200);
    return () => clearTimeout(timeout);
  }, [answerFeedback]);

  useEffect(() => {
    if (role !== "host") return;
    if (!game?.id) return;

    if (game.phase !== "countdown") {
      phaseSwitchInFlightRef.current = false;
      return;
    }

    const questionStartedAtMs = toMs(game.question_started_at_ms);
    if (!Number.isFinite(questionStartedAtMs)) return;
    if (syncedNowMs < questionStartedAtMs) return;
    if (phaseSwitchInFlightRef.current) return;

    phaseSwitchInFlightRef.current = true;

    (async () => {
      try {
        const { data: freshGame, error: freshGameError } = await supabase
          .from("games")
          .select("*")
          .eq("id", game.id)
          .single();

        if (freshGameError) throw freshGameError;
        if (!freshGame || freshGame.phase !== "countdown") return;

        const freshQuestionStartMs = toMs(freshGame.question_started_at_ms);
        if (!Number.isFinite(freshQuestionStartMs)) return;
        if (syncedNowRef.current < freshQuestionStartMs) return;

        const { error } = await supabase
          .from("games")
          .update({
            phase: "question",
            time_left: Number(freshGame.question_duration || COUNTDOWN_DURATION),
            show_leaderboard: false,
          })
          .eq("id", game.id);

        if (error) throw error;
      } catch (error) {
        console.error(error);
      } finally {
        setTimeout(() => {
          phaseSwitchInFlightRef.current = false;
        }, 300);
      }
    })();
  }, [role, game?.id, game?.phase, game?.question_started_at_ms, syncedNowMs]);

  useEffect(() => {
    if (role !== "host") return;
    if (!game?.id) return;
    if (effectivePhase !== "question") return;
    if (getRemainingMs(game, syncedNowRef.current) > 0) return;
    if (phaseSwitchInFlightRef.current) return;

    phaseSwitchInFlightRef.current = true;

    (async () => {
      try {
        const { data: freshGame, error: freshGameError } = await supabase
          .from("games")
          .select("*")
          .eq("id", game.id)
          .single();

        if (freshGameError) throw freshGameError;
        if (!freshGame || freshGame.phase !== "question") return;

        const questionStartedAtMs = toMs(freshGame.question_started_at_ms);
        const durationMs = Number(freshGame.question_duration || 0) * 1000;
        const isExpired =
          Number.isFinite(questionStartedAtMs) &&
          durationMs > 0 &&
          syncedNowRef.current >= questionStartedAtMs + durationMs;

        if (!isExpired) return;

        const { error } = await supabase
          .from("games")
          .update({
            phase: "stats",
            countdown_started_at_ms: null,
            question_started_at_ms: null,
            question_started_at: null,
            question_duration: null,
            time_left: 0,
            show_leaderboard: false,
          })
          .eq("id", game.id);

        if (error) throw error;
        await addLiveEvent(game.id, "answer_stats", "📊 Percentuali risposte mostrate");
      } catch (error) {
        console.error(error);
      } finally {
        setTimeout(() => {
          phaseSwitchInFlightRef.current = false;
        }, 300);
      }
    })();
  }, [role, game, game?.id, effectivePhase, syncedNowMs]);

  useEffect(() => {
    if (role !== "tv") return;
    if (!tvAudioReady) return;

    const hasQuestionAudio = Boolean(currentQuestion?.audio_url);

    if (
      effectivePhase === "question" &&
      game?.question_started_at_ms &&
      game?.question_duration &&
      !hasQuestionAudio
    ) {
      startSyncedCountdown(game.question_started_at_ms, game.question_duration);
    } else {
      stopCountdownAudio();
    }

    return () => {
      stopCountdownAudio();
    };
  }, [
    role,
    tvAudioReady,
    effectivePhase,
    game?.question_started_at_ms,
    game?.question_duration,
    currentQuestion?.audio_url,
    startSyncedCountdown,
    stopCountdownAudio,
  ]);

  useEffect(() => {
    if (role !== "tv") return;

    const audioEl = tvQuestionAudioRef.current;
    if (!audioEl) return;

    const stopQuestionAudio = () => {
      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl.removeAttribute("src");
      audioEl.load();
    };

    if (!tvAudioReady) {
      stopQuestionAudio();
      lastTvQuestionAudioKeyRef.current = null;
      return;
    }

    if (effectivePhase !== "question") {
      stopQuestionAudio();
      lastTvQuestionAudioKeyRef.current = null;
      return;
    }

    if (!currentQuestion?.audio_url || !currentQuestion?.id) {
      stopQuestionAudio();
      lastTvQuestionAudioKeyRef.current = null;
      return;
    }

    const key = `${currentQuestion.id}-${currentQuestion.audio_url}`;

    if (lastTvQuestionAudioKeyRef.current === key) return;
    lastTvQuestionAudioKeyRef.current = key;

    stopCountdownAudio();

    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.src = currentQuestion.audio_url;
    audioEl.load();

    let cancelled = false;

    const playNow = async () => {
      try {
        await audioEl.play();
      } catch (err) {
        console.log("Audio domanda bloccato:", err);
      }
    };

    playNow();

    const stopTimer = setTimeout(() => {
      if (cancelled) return;
      audioEl.pause();
      audioEl.currentTime = 0;
    }, COUNTDOWN_DURATION * 1000);

    return () => {
      cancelled = true;
      clearTimeout(stopTimer);
      audioEl.pause();
      audioEl.currentTime = 0;
    };
  }, [
    role,
    tvAudioReady,
    effectivePhase,
    currentQuestion?.id,
    currentQuestion?.audio_url,
    stopCountdownAudio,
  ]);

  useEffect(() => {
    const audioEl = tvQuestionAudioRef.current;
    if (!audioEl) return;

    if (role !== "tv") return;

    if (effectivePhase !== "question") {
      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl.removeAttribute("src");
      audioEl.load();
      lastTvQuestionAudioKeyRef.current = null;
    }
  }, [role, effectivePhase, game?.phase, game?.current_question_index]);

  useEffect(() => {
    if (role !== "tv") return;

    if (effectivePhase !== "countdown" && effectivePhase !== "question") {
      setTvJollyEffect(null);
      if (tvJollyTimeoutRef.current) {
        clearTimeout(tvJollyTimeoutRef.current);
        tvJollyTimeoutRef.current = null;
      }
    }
  }, [role, effectivePhase, game?.current_question_index]);

  useEffect(() => {
    if (role !== "tv") return;
    if (!game || !currentQuestion) return;

    if (game.phase === "reveal") {
      setTvRevealEffect({
        correctAnswer: currentQuestion.correct_answer,
        explanation: currentQuestion.explanation,
      });

      if (lastRevealQuestionIdRef.current !== currentQuestion.id) {
        playRevealAudio();
        lastRevealQuestionIdRef.current = currentQuestion.id;
      }
    } else {
      setTvRevealEffect(null);
    }
  }, [role, game?.phase, currentQuestion?.id, currentQuestion, playRevealAudio]);

  useEffect(() => {
    if (role !== "tv") return;
    if (!liveEvents.length) return;

    const latest = liveEvents[0];
    if (!latest || latest.event_type !== "jolly_used") return;
    if (lastTvJollyEventIdRef.current === latest.id) return;
    if (effectivePhase !== "question") return;

    lastTvJollyEventIdRef.current = latest.id;

    setTvJollyEffect({
      text: latest.event_text,
      id: latest.id,
    });

    if (tvJollyTimeoutRef.current) {
      clearTimeout(tvJollyTimeoutRef.current);
    }

    tvJollyTimeoutRef.current = setTimeout(() => {
      setTvJollyEffect((current) => {
        if (!current || current.id !== latest.id) return current;
        return null;
      });
      tvJollyTimeoutRef.current = null;
    }, 3000);
  }, [role, liveEvents, effectivePhase]);

  useEffect(() => {
    return () => {
      stopCountdownAudio();
      if (tvJollyTimeoutRef.current) clearTimeout(tvJollyTimeoutRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [stopCountdownAudio]);

  useEffect(() => {
    if (game?.phase !== "final") {
      setFinalRevealIndex(-1);
      return;
    }

    setFinalRevealIndex(-1);

    const t1 = setTimeout(() => setFinalRevealIndex(2), 800);
    const t2 = setTimeout(() => setFinalRevealIndex(1), 2200);
    const t3 = setTimeout(() => setFinalRevealIndex(0), 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [game?.phase]);

  const containerStyle = {
    minHeight: "100vh",
    padding: 24,
    color: "white",
    fontFamily: "Arial, sans-serif",
    background: APP_BG,
  };

  const panelStyle = {
    background: CARD_BG,
    border: BORDER,
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    backdropFilter: "blur(6px)",
    position: "relative",
    zIndex: 1,
  };

  const buttonStyle = {
    padding: "14px 18px",
    margin: "8px",
    borderRadius: 14,
    border: "none",
    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 16,
    position: "relative",
    zIndex: 1,
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  };

  const feedbackOverlayStyle = {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      answerFeedback?.type === "correct"
        ? "rgba(36,193,107,0.22)"
        : "rgba(255,87,34,0.22)",
    zIndex: 9998,
    pointerEvents: "none",
  };

  const questionImageBoxStyle = {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
  };

  const questionImageStyle = {
    display: "block",
    width: "100%",
    maxHeight: 100,
    objectFit: "contain",
    background: "rgba(0,0,0,0.18)",
  };

  const questionAudioBoxStyle = {
    ...panelStyle,
    padding: 14,
    textAlign: "center",
  };

  const renderStatsBar = (letter, label) => {
    const stat = answerStats[letter];
    return (
      <div
        key={letter}
        style={{
          ...getTvOptionStyle(letter),
          flexDirection: "column",
          alignItems: "stretch",
          gap: 10,
          minHeight: 110,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 30 }}>
          <span>
            {letter} - {label}
          </span>
          <span style={{ fontWeight: "bold" }}>{stat.percent}%</span>
        </div>

        <div
          style={{
            height: 18,
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${stat.percent}%`,
              background: "rgba(255,255,255,0.92)",
              borderRadius: 999,
              transition: "width 0.35s ease",
            }}
          />
        </div>

        <div style={{ fontSize: 20, opacity: 0.95 }}>
          {stat.count} {stat.count === 1 ? "voto" : "voti"}
        </div>
      </div>
    );
  };

  const renderQuestionMedia = (question, mode = "player") => {
    if (!question) return null;

    const hasImage = Boolean(question.image_url);
    const hasAudio = Boolean(question.audio_url);

    if (!hasImage && !hasAudio) return null;

    const imageMaxHeight = mode === "tv" ? 260 : mode === "host" ? 160 : 130;

    return (
      <div
        style={{
          display: "grid",
          gap: 14,
          width: "100%",
          maxWidth: mode === "tv" ? 1000 : 700,
          margin: "0 auto 18px",
        }}
      >
        {hasImage && (
          <div style={questionImageBoxStyle}>
            <img
              src={question.image_url}
              alt="Immagine domanda"
              style={{ ...questionImageStyle, maxHeight: imageMaxHeight }}
            />
          </div>
        )}

        {hasAudio && mode === "tv" && (
          <div style={questionAudioBoxStyle}>
            <div style={{ fontWeight: "bold", marginBottom: 10 }}>
              🔊 Audio domanda in riproduzione
            </div>
            <div style={{ opacity: 0.88 }}>
              L'audio parte automaticamente sulla schermata TV.
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!role) {
    return (
      <div
        style={{
          ...containerStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <style>{`
          @keyframes popIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          @keyframes podiumRise {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes winnerGlow {
            0% { transform: scale(1); text-shadow: 0 0 0 rgba(255,255,255,0); }
            50% { transform: scale(1.08); text-shadow: 0 0 20px rgba(255,215,64,0.85); }
            100% { transform: scale(1); text-shadow: 0 0 8px rgba(255,215,64,0.45); }
          }
          @keyframes pulseTime {
            0% { transform: scale(1); }
            50% { transform: scale(1.08); }
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
            ...panelStyle,
            width: "100%",
            maxWidth: 600,
            textAlign: "center",
            animation: "popIn 0.6s ease",
          }}
        >
          <h1 style={{ fontSize: 44, marginBottom: 10 }}>🍻 {getGameTitle(game)}</h1>
          <p style={{ opacity: 0.85, marginBottom: 24 }}>Scegli come vuoi entrare</p>
          <button onClick={() => setRole("host")} style={buttonStyle}>
            HOST
          </button>
          <button onClick={() => setRole("player")} style={buttonStyle}>
            GIOCATORE
          </button>
          <button onClick={() => setRole("tv")} style={buttonStyle}>
            TV
          </button>
        </div>
      </div>
    );
  }

  if (role === "player") {
    if (!joinedPlayer) {
      return (
        <div
          style={{
            ...containerStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={playerBackgroundLogoStyle}>
            <img src={LOGO_BG} alt="Logo quiz" style={playerBackgroundLogoImageStyle} />
          </div>

          <div style={{ ...panelStyle, width: "100%", maxWidth: 560, textAlign: "center" }}>
            <h1>Entra nel quiz</h1>
            <p>
              <b>Codice partita:</b> {GAME_CODE}
            </p>
            <p>
              <b>Stato:</b> {status}
            </p>

            <div style={{ marginTop: 18 }}>
              <input
                placeholder="Nome squadra"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={{
                  padding: 14,
                  width: "100%",
                  maxWidth: 340,
                  borderRadius: 12,
                  border: "none",
                  marginBottom: 14,
                  fontSize: 16,
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </div>

            {isLoading ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontWeight: "bold",
                  maxWidth: 420,
                  marginLeft: "auto",
                  marginRight: "auto",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Caricamento partita...
              </div>
            ) : game?.phase !== "lobby" ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 12,
                  background: "rgba(255,87,34,0.18)",
                  border: "1px solid rgba(255,87,34,0.45)",
                  fontWeight: "bold",
                  maxWidth: 420,
                  marginLeft: "auto",
                  marginRight: "auto",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Partita in corso, attendi una nuova partita
              </div>
            ) : (
              <button onClick={joinGame} style={buttonStyle}>
                Entra
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...containerStyle, position: "relative", overflow: "hidden" }}>
        <div style={playerBackgroundLogoStyle}>
          <img src={LOGO_BG} alt="Logo quiz" style={playerBackgroundLogoImageStyle} />
        </div>

        {answerFeedback && (
          <div style={feedbackOverlayStyle}>
            <div
              style={{
                ...panelStyle,
                minWidth: 280,
                textAlign: "center",
                border:
                  answerFeedback.type === "correct"
                    ? "2px solid rgba(36,193,107,0.85)"
                    : "2px solid rgba(255,87,34,0.85)",
                background:
                  answerFeedback.type === "correct"
                    ? "rgba(36,193,107,0.18)"
                    : "rgba(255,87,34,0.18)",
                animation: "answerFlashPop 0.22s ease",
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 8 }}>
                {answerFeedback.type === "correct" ? "✅" : "❌"}
              </div>
              <div style={{ fontSize: 34, fontWeight: "bold" }}>
                {answerFeedback.type === "correct" ? "RISPOSTA ESATTA" : "RISPOSTA SBAGLIATA"}
              </div>
              {typeof answerFeedback.points === "number" && answerFeedback.points > 0 && (
                <div style={{ fontSize: 24, marginTop: 10, color: GOLD }}>
                  +{answerFeedback.points} punti
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ ...panelStyle, textAlign: "center", marginBottom: 20 }}>
            <h1 style={{ marginBottom: 8 }}>🎮 {joinedPlayer.name}</h1>
            <p>
              <b>Punti:</b> {joinedPlayer.score || 0}
            </p>
            <p>
              <b>Stato:</b> {status}
            </p>

            {!jollyUsed && effectivePhase === "question" && localTimeLeft > 0 && (
              <button
                onClick={useJollyCard}
                style={{
                  ...buttonStyle,
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                }}
              >
                USA JOLLY
              </button>
            )}

            {jollyUsed && <p style={{ color: GOLD, fontWeight: "bold" }}>JOLLY già usato</p>}
          </div>

          {game?.phase === "lobby" && (
            <div style={{ ...panelStyle, textAlign: "center" }}>
              <h2>Attendi l'inizio del quiz...</h2>
            </div>
          )}

          {effectivePhase === "countdown" && currentQuestion && (
            <div style={{ ...panelStyle, textAlign: "center" }}>
              {renderQuestionMedia(currentQuestion, "player")}
              <div style={{ fontSize: 24, opacity: 0.85, marginBottom: 12 }}>
                Prossima domanda tra...
              </div>
              <div style={{ fontSize: 64, fontWeight: "bold", color: GOLD }}>
                {countdownTimeLeft}
              </div>
            </div>
          )}

          {effectivePhase === "question" && currentQuestion && (
            <div style={{ ...panelStyle, textAlign: "center" }}>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: "bold",
                  marginBottom: 16,
                  color: localTimeLeft <= 5 ? GOLD : "white",
                  animation:
                    localTimeLeft <= 5 && localTimeLeft > 0 ? "pulseTime 1s infinite" : "none",
                }}
              >
                ⏳ {localTimeLeft}s
              </div>

              {renderQuestionMedia(currentQuestion, "player")}

              <h2 style={{ fontSize: 30, lineHeight: 1.25 }}>{currentQuestion.question}</h2>

              <div style={{ display: "grid", gap: 12, maxWidth: 520, margin: "24px auto 0" }}>
                <button
                  onClick={() => submitAnswer("A")}
                  disabled={!!selectedAnswer || localTimeLeft <= 0}
                  style={getPlayerAnswerButtonStyle(
                    "A",
                    !!selectedAnswer || localTimeLeft <= 0,
                    selectedAnswer === "A"
                  )}
                >
                  A - {currentQuestion.option_a}
                </button>

                <button
                  onClick={() => submitAnswer("B")}
                  disabled={!!selectedAnswer || localTimeLeft <= 0}
                  style={getPlayerAnswerButtonStyle(
                    "B",
                    !!selectedAnswer || localTimeLeft <= 0,
                    selectedAnswer === "B"
                  )}
                >
                  B - {currentQuestion.option_b}
                </button>

                {currentQuestion.option_c && (
                  <button
                    onClick={() => submitAnswer("C")}
                    disabled={!!selectedAnswer || localTimeLeft <= 0}
                    style={getPlayerAnswerButtonStyle(
                      "C",
                      !!selectedAnswer || localTimeLeft <= 0,
                      selectedAnswer === "C"
                    )}
                  >
                    C - {currentQuestion.option_c}
                  </button>
                )}

                {currentQuestion.option_d && (
                  <button
                    onClick={() => submitAnswer("D")}
                    disabled={!!selectedAnswer || localTimeLeft <= 0}
                    style={getPlayerAnswerButtonStyle(
                      "D",
                      !!selectedAnswer || localTimeLeft <= 0,
                      selectedAnswer === "D"
                    )}
                  >
                    D - {currentQuestion.option_d}
                  </button>
                )}
              </div>

              {selectedAnswer && (
                <p style={{ marginTop: 18, color: GOLD, fontWeight: "bold" }}>
                  Hai risposto: {selectedAnswer}
                </p>
              )}

              {!selectedAnswer && localTimeLeft <= 0 && (
                <p style={{ marginTop: 18, color: RED, fontWeight: "bold" }}>
                  Tempo scaduto
                </p>
              )}
            </div>
          )}

          {game?.phase === "stats" && currentQuestion && (
            <div style={{ ...panelStyle, textAlign: "center" }}>
              {renderQuestionMedia(currentQuestion, "player")}
              <h2 style={{ marginBottom: 10 }}>📊 Risposte raccolte</h2>
              <p style={{ fontSize: 18, opacity: 0.92 }}>
                {answerStats.totalAnswered} / {answerStats.totalPlayers} giocatori hanno risposto
              </p>
              <p style={{ marginTop: 18, color: GOLD, fontWeight: "bold" }}>
                Attendi che l'host mostri la risposta corretta
              </p>
            </div>
          )}

          {game?.phase === "reveal" && currentQuestion && (
            <div style={{ ...panelStyle, textAlign: "center" }}>
              {renderQuestionMedia(currentQuestion, "player")}
              <h2 style={{ color: GREEN }}>✅ Risposta corretta: {currentQuestion.correct_answer}</h2>
              <p style={{ fontSize: 18 }}>{currentQuestion.explanation}</p>
            </div>
          )}

          {game?.phase === "final" && (
            <div style={{ ...panelStyle, textAlign: "center" }}>
              <h2>🏁 Quiz terminato</h2>
              <p>Guarda il podio finale.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (role === "tv") {
    return (
      <div
        style={{
          minHeight: "100vh",
          height: "100vh",
          width: "100vw",
          padding: 0,
          color: "white",
          fontFamily: "Arial, sans-serif",
          background: APP_BG,
          position: "relative",
          overflow: "hidden",
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

        <img src={LOGO_BG} alt="Logo quiz" style={tvLogoStyle} />

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
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            paddingTop: 132,
            paddingBottom: 20,
            paddingLeft: 22,
            paddingRight: 22,
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
                    fontSize: "clamp(36px, 4vw, 64px)",
                    margin: "0 0 8px 0",
                    lineHeight: 1.05,
                  }}
                >
                  🍻 {getGameTitle(game)}
                </h1>
                <div style={{ fontSize: "clamp(18px, 1.9vw, 28px)", opacity: 0.92 }}>
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
                      fontSize: "clamp(18px, 1.6vw, 28px)",
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
                      fontSize: "clamp(15px, 1.2vw, 22px)",
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
                      fontSize: "clamp(11px, 0.9vw, 15px)",
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
                      fontSize: "clamp(24px, 2vw, 34px)",
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
                        fontSize: "clamp(24px, 2vw, 34px)",
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

          {!Boolean(game?.show_leaderboard) && effectivePhase === "countdown" && currentQuestion && (
            <div
              style={{
                ...panelStyle,
                padding: 40,
                textAlign: "center",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {renderQuestionMedia(currentQuestion, "tv")}
              <div style={{ fontSize: 38, marginBottom: 16, opacity: 0.9 }}>
                Prossima domanda tra...
              </div>
              <div style={{ fontSize: 96, fontWeight: "bold", color: GOLD }}>
                {countdownTimeLeft}
              </div>
            </div>
          )}

          {!Boolean(game?.show_leaderboard) && effectivePhase === "question" && currentQuestion && (
            <div
              style={{
                ...panelStyle,
                padding: "24px 28px",
                position: "relative",
                height: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(42px, 5vw, 70px)",
                  fontWeight: "bold",
                  color: localTimeLeft <= 5 ? GOLD : "white",
                  marginBottom: 16,
                  textAlign: "center",
                  lineHeight: 1,
                  flexShrink: 0,
                  animation:
                    localTimeLeft <= 5 && localTimeLeft > 0 ? "pulseTime 1s infinite" : "none",
                }}
              >
                ⏳ {localTimeLeft}
              </div>

              {renderQuestionMedia(currentQuestion, "tv")}

              <h2
                style={{
                  fontSize: "clamp(24px, 2.8vw, 42px)",
                  lineHeight: 1.2,
                  margin: "0 0 20px 0",
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {currentQuestion.question}
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  width: "100%",
                  maxWidth: 1100,
                  margin: "0 auto",
                  flex: 1,
                  alignContent: "center",
                }}
              >
                <div
                  style={{
                    ...getTvOptionStyle("A"),
                    fontSize: "clamp(20px, 2vw, 30px)",
                    padding: "18px 20px",
                    minHeight: 90,
                    display: "flex",
                    alignItems: "center",
                    animation: "answerFlashPop 0.25s ease",
                  }}
                >
                  A - {currentQuestion.option_a}
                </div>

                <div
                  style={{
                    ...getTvOptionStyle("B"),
                    fontSize: "clamp(20px, 2vw, 30px)",
                    padding: "18px 20px",
                    minHeight: 90,
                    display: "flex",
                    alignItems: "center",
                    animation: "answerFlashPop 0.25s ease",
                  }}
                >
                  B - {currentQuestion.option_b}
                </div>

                {currentQuestion.option_c && (
                  <div
                    style={{
                      ...getTvOptionStyle("C"),
                      fontSize: "clamp(20px, 2vw, 30px)",
                      padding: "18px 20px",
                      minHeight: 90,
                      display: "flex",
                      alignItems: "center",
                      animation: "answerFlashPop 0.25s ease",
                    }}
                  >
                    C - {currentQuestion.option_c}
                  </div>
                )}

                {currentQuestion.option_d && (
                  <div
                    style={{
                      ...getTvOptionStyle("D"),
                      fontSize: "clamp(20px, 2vw, 30px)",
                      padding: "18px 20px",
                      minHeight: 90,
                      display: "flex",
                      alignItems: "center",
                      animation: "answerFlashPop 0.25s ease",
                    }}
                  >
                    D - {currentQuestion.option_d}
                  </div>
                )}
              </div>
            </div>
          )}

          {game?.phase === "stats" && currentQuestion && !game?.show_leaderboard && (
            <div
              style={{
                ...panelStyle,
                padding: "24px 28px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                overflow: "hidden",
                textAlign: "center",
                animation: "correctRevealGlow 0.35s ease",
              }}
            >
              {renderQuestionMedia(currentQuestion, "tv")}

              <h2
                style={{
                  fontSize: "clamp(28px, 3.6vw, 48px)",
                  margin: "0 0 10px 0",
                  flexShrink: 0,
                }}
              >
                📊 Percentuali risposte
              </h2>

              <div
                style={{
                  fontSize: "clamp(18px, 2vw, 28px)",
                  color: GOLD,
                  marginBottom: 18,
                  flexShrink: 0,
                }}
              >
                {answerStats.totalAnswered} / {answerStats.totalPlayers} giocatori hanno risposto
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  width: "100%",
                  maxWidth: 1100,
                  margin: "0 auto",
                  flex: 1,
                  alignContent: "center",
                }}
              >
                {renderStatsBar("A", currentQuestion.option_a)}
                {renderStatsBar("B", currentQuestion.option_b)}
                {currentQuestion.option_c && renderStatsBar("C", currentQuestion.option_c)}
                {currentQuestion.option_d && renderStatsBar("D", currentQuestion.option_d)}
              </div>
            </div>
          )}

          {game?.phase === "reveal" && currentQuestion && !game?.show_leaderboard && (
            <div
              style={{
                ...panelStyle,
                padding: "24px 28px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                overflow: "hidden",
                textAlign: "center",
                animation: "correctRevealGlow 0.45s ease",
              }}
            >
              {renderQuestionMedia(currentQuestion, "tv")}

              <h2
                style={{
                  fontSize: "clamp(32px, 4vw, 54px)",
                  color: GREEN,
                  margin: "0 0 12px 0",
                  flexShrink: 0,
                }}
              >
                ✅ Risposta corretta: {currentQuestion.correct_answer}
              </h2>

              {currentQuestion.explanation && (
                <p
                  style={{
                    fontSize: "clamp(18px, 2vw, 28px)",
                    margin: "0 0 20px 0",
                    opacity: 0.96,
                    flexShrink: 0,
                  }}
                >
                  {currentQuestion.explanation}
                </p>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  width: "100%",
                  maxWidth: 1100,
                  margin: "0 auto",
                  flex: 1,
                  alignContent: "center",
                }}
              >
                <div style={getTvRevealOptionStyle("A", currentQuestion.correct_answer)}>
                  A - {currentQuestion.option_a}
                </div>

                <div style={getTvRevealOptionStyle("B", currentQuestion.correct_answer)}>
                  B - {currentQuestion.option_b}
                </div>

                {currentQuestion.option_c && (
                  <div style={getTvRevealOptionStyle("C", currentQuestion.correct_answer)}>
                    C - {currentQuestion.option_c}
                  </div>
                )}

                {currentQuestion.option_d && (
                  <div style={getTvRevealOptionStyle("D", currentQuestion.correct_answer)}>
                    D - {currentQuestion.option_d}
                  </div>
                )}
              </div>
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