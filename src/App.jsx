/* =====================================================
   PARTE 1 - IMPORT, CONFIGURAZIONE, COSTANTI E DATI DEMO
===================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { QRCodeSVG } from "qrcode.react";

// FIX BASE PAGINA: ELIMINA MARGINI BIANCHI SENZA SPACCARE HOST/PLAYER
if (typeof document !== "undefined") {
  document.documentElement.style.margin = "0";
  document.documentElement.style.padding = "0";
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";

  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.width = "100%";
  document.body.style.minHeight = "100%";
  document.body.style.background = "#0f172a";
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GAME_CODE = "PUB2026";
const COUNTDOWN_DURATION = 10;
const QUESTION_START_DELAY_MS = 3000;
const COUNTDOWN_AUDIO_SRC = "/media/countdown10.m4a";
const REVEAL_AUDIO_SRC = "";
const HOST_PASSWORD = "Cromos6339";

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

const PLAYER_JOIN_URL = "https://quizzone-live-three.vercel.app/?role=player";
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

/* =====================================================
   PARTE 2 - FUNZIONI UTILITY
===================================================== */

function getGameTitle(game) {
  return game?.title || "Il Quizzone di Simone";
}

function sortPlayers(players) {
  return [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

function getCurrentQuestion(questions, index) {
  return questions?.[index] || null;
}

function toMs(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;

  const parsedNumber = Number(value);
  if (Number.isFinite(parsedNumber)) return parsedNumber;

  const parsedDate = new Date(value).getTime();
  return Number.isFinite(parsedDate) ? parsedDate : NaN;
}

function getRemainingMs(game, nowMs) {
  if (!game) return 0;

  if (game.phase === "countdown") {
    const startMs = toMs(game.countdown_started_at_ms);
    const questionStartMs = toMs(game.question_started_at_ms);

    if (!Number.isFinite(startMs) || !Number.isFinite(questionStartMs)) return 0;
    return Math.max(0, questionStartMs - nowMs);
  }

  if (game.phase === "question") {
    const startMs = toMs(game.question_started_at_ms);
    const durationMs = Number(game.question_duration || COUNTDOWN_DURATION) * 1000;

    if (!Number.isFinite(startMs) || durationMs <= 0) return 0;
    return Math.max(0, startMs + durationMs - nowMs);
  }

  return 0;
}

function getRemainingTime(game, nowMs) {
  return Math.ceil(getRemainingMs(game, nowMs) / 1000);
}

function getCountdownSecondsBeforeStart(game, nowMs) {
  if (!game || game.phase !== "countdown") return 0;

  const questionStartMs = toMs(game.question_started_at_ms);
  if (!Number.isFinite(questionStartMs)) return 0;

  return Math.max(0, Math.ceil((questionStartMs - nowMs) / 1000));
}

function getEffectivePhase(game, nowMs) {
  if (!game) return "lobby";

  if (game.phase === "countdown") {
    const questionStartMs = toMs(game.question_started_at_ms);
    if (Number.isFinite(questionStartMs) && nowMs >= questionStartMs) {
      return "question";
    }
    return "countdown";
  }

  if (game.phase === "question") {
    return "question";
  }

  return game.phase || "lobby";
}

function formatSeconds(ms) {
  return Math.ceil(ms / 1000);
}

function getQuestionMediaHint(question) {
  if (!question) return "";

  if (question.youtube_url || question.video_url) {
    return "🎬 GUARDA IN TV";
  }

  if (question.audio_url) {
    return "🎧 ASCOLTA BENE";
  }

  if (question.image_url) {
    return "🖼️ GUARDA ATTENTAMENTE";
  }

  return "";
}

function isCorrectAnswer(question, answer) {
  if (!question) return false;
  return question.correct_answer === answer;
}

function getAnswerColor(letter) {
  if (letter === "A") return ANSWER_A;
  if (letter === "B") return ANSWER_B;
  if (letter === "C") return ANSWER_C;
  if (letter === "D") return ANSWER_D;
  return PRIMARY;
}

function getTvOptionStyle(letter) {
  return {
    background: getAnswerColor(letter),
    color: "white",
    borderRadius: 18,
    padding: "20px 24px",
    fontWeight: "bold",
    fontSize: 30,
    minHeight: 110,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.18)",
  };
}

function getPlayerAnswerButtonStyle(letter, disabled, selected) {
  return {
    background: getAnswerColor(letter),
    color: "white",
    border: selected ? "3px solid rgba(255,255,255,0.95)" : "1px solid rgba(255,255,255,0.18)",
    borderRadius: 14,
    fontWeight: "bold",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled && !selected ? 0.55 : 1,
    boxShadow: selected
      ? "0 0 24px rgba(255,255,255,0.35)"
      : "0 8px 18px rgba(0,0,0,0.22)",
    animation: selected ? "selectedPulse 1s infinite" : "none",
  };
}

function getTvRevealOptionStyle(letter, correctAnswer) {
  const isCorrect = letter === correctAnswer;

  return {
    ...getTvOptionStyle(letter),
    background: isCorrect ? GREEN : "rgba(255,255,255,0.08)",
    opacity: isCorrect ? 1 : 0.45,
    border: isCorrect
      ? "3px solid rgba(255,255,255,0.95)"
      : "1px solid rgba(255,255,255,0.14)",
    boxShadow: isCorrect
      ? "0 0 34px rgba(34,197,94,0.55)"
      : "0 8px 18px rgba(0,0,0,0.18)",
  };
}

/* =====================================================
   PARTE 3 - HOOK AUDIO
===================================================== */

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

/* =====================================================
   PARTE 4A - COMPONENTE APP: STATE E REF
===================================================== */

export default function App() {
  const [role, setRole] = useState(null);

  const [status, setStatus] = useState("Pronto");
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [roundName, setRoundName] = useState("");

  const [playerName, setPlayerName] = useState("");
  const [joinedPlayer, setJoinedPlayer] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [jollyUsed, setJollyUsed] = useState(false);

  const [hostAuthorized, setHostAuthorized] = useState(false);
  const [hostPasswordInput, setHostPasswordInput] = useState("");
  const [hostPasswordError, setHostPasswordError] = useState("");

  const [hostBanner] = useState(null);
  const [finalRevealIndex, setFinalRevealIndex] = useState(-1);
  const [leaderboardRevealCount, setLeaderboardRevealCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [tvRevealEffect, setTvRevealEffect] = useState(null);
  const [tvJollyEffect, setTvJollyEffect] = useState(null);
  const [tvAudioReady, setTvAudioReady] = useState(false);
  const [hideTvAudioOverlay, setHideTvAudioOverlay] = useState(false);

  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [renderNow, setRenderNow] = useState(Date.now());

  const [playerQuestionScale, setPlayerQuestionScale] = useState(1);
  const [playerQuestionFitReady, setPlayerQuestionFitReady] = useState(false);

  const [stop10Results, setStop10Results] = useState([]);
  const [stop10PlayerStopped, setStop10PlayerStopped] = useState(false);
  const [stop10PlayerResult, setStop10PlayerResult] = useState(null);
  const [stop10TvEffect, setStop10TvEffect] = useState(null);

  const bannerTimeoutRef = useRef(null);
  const lastTvJollyEventIdRef = useRef(null);
  const tvJollyTimeoutRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const submitLockRef = useRef(false);
  const jollyLockRef = useRef(false);
  const stop10LockRef = useRef(false);
  const fallbackRefreshRef = useRef(null);
  const phaseSwitchInFlightRef = useRef(false);
  const syncedNowRef = useRef(Date.now());
  const lastRevealQuestionIdRef = useRef(null);
  const lastTvQuestionAudioKeyRef = useRef(null);
  const tvQuestionAudioRef = useRef(null);

  const playerQuestionOuterRef = useRef(null);
  const playerQuestionInnerRef = useRef(null);

/* =====================================================
   PARTE 4B - TEMPO, CLOCK SERVER, AUDIO E RUOLO
===================================================== */

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
/* =====================================================
   PARTE 4C - MEMO QUIZ, STOP10, STATISTICHE, JOLLY E TV
===================================================== */

const effectivePhase = useMemo(() => {
  return getEffectivePhase(game, syncedNowMs);
}, [game, syncedNowMs]);

const localTimeLeft = useMemo(() => {
  return getRemainingTime(game, syncedNowMs);
}, [game, syncedNowMs]);

const countdownTimeLeft = useMemo(() => {
  return getCountdownSecondsBeforeStart(game, syncedNowMs);
}, [game, syncedNowMs]);

/* ===== STOP10 ===== */

const stop10RoundId = useMemo(() => {
  if (!game?.stop10_round_id) return "";
  return String(game.stop10_round_id);
}, [game?.stop10_round_id]);

const stop10StartedAtMs = useMemo(() => {
  return toMs(game?.stop10_started_at_ms);
}, [game?.stop10_started_at_ms]);

const stop10ElapsedMs = useMemo(() => {
  if (!Number.isFinite(stop10StartedAtMs)) return 0;
  return Math.max(0, syncedNowMs - stop10StartedAtMs);
}, [syncedNowMs, stop10StartedAtMs]);

const stop10ElapsedSeconds = useMemo(() => {
  return stop10ElapsedMs / 1000;
}, [stop10ElapsedMs]);

const stop10HideTimer = stop10ElapsedMs >= 5000;

const stop10DisplayTime = useMemo(() => {
  if (!Number.isFinite(stop10ElapsedMs)) return "0.0";
  if (stop10ElapsedMs >= 5000) return "???";

  const remaining = Math.max(0, 10 - stop10ElapsedMs / 1000);
  return remaining.toFixed(1);
}, [stop10ElapsedMs]);

const stop10IsRunning =
  effectivePhase === "stop10" && stop10ElapsedMs < 10000;

const stop10IsFinished =
  effectivePhase === "stop10_results" || stop10ElapsedMs >= 10000;

const currentStop10Results = useMemo(() => {
  if (!stop10RoundId) return [];

  return stop10Results
    .filter((r) => String(r.round_id) === String(stop10RoundId))
    .sort((a, b) => Number(a.diff_ms || 0) - Number(b.diff_ms || 0));
}, [stop10Results, stop10RoundId]);

const myStop10Result = useMemo(() => {
  if (!joinedPlayer?.id || !stop10RoundId) return null;

  return (
    stop10Results.find(
      (r) =>
        String(r.round_id) === String(stop10RoundId) &&
        r.player_id === joinedPlayer.id
    ) || null
  );
}, [stop10Results, stop10RoundId, joinedPlayer?.id]);

/* ===== HOST TIMER ===== */

const hostDisplayedTime = useMemo(() => {
  if (effectivePhase === "countdown") return countdownTimeLeft;
  if (effectivePhase === "question") return localTimeLeft;

  if (effectivePhase === "stop10") {
    return Math.max(0, Math.ceil((10000 - stop10ElapsedMs) / 1000));
  }

  return 0;
}, [effectivePhase, countdownTimeLeft, localTimeLeft, stop10ElapsedMs]);

/* ===== DOMANDA ===== */

const currentQuestion = useMemo(() => {
  if (!game || questions.length === 0) return null;

  return (
    questions.find((q) => q.position === game.current_question_index) || null
  );
}, [game, questions]);

const currentQuestionAnswers = useMemo(() => {
  if (!currentQuestion?.id) return [];

  return answers.filter((a) => a.question_id === currentQuestion.id);
}, [answers, currentQuestion?.id]);

/* ===== STATS ===== */

const answerStats = useMemo(() => {
  const countA = currentQuestionAnswers.filter((a) => a.answer === "A").length;
  const countB = currentQuestionAnswers.filter((a) => a.answer === "B").length;
  const countC = currentQuestionAnswers.filter((a) => a.answer === "C").length;
  const countD = currentQuestionAnswers.filter((a) => a.answer === "D").length;

  const totalAnswered = currentQuestionAnswers.length;
  const totalPlayers = players.length;

  const percent = (value) =>
    totalAnswered > 0 ? Math.round((value / totalAnswered) * 100) : 0;

  return {
    totalAnswered,
    totalPlayers,
    A: { count: countA, percent: percent(countA) },
    B: { count: countB, percent: percent(countB) },
    C: { count: countC, percent: percent(countC) },
    D: { count: countD, percent: percent(countD) },
  };
}, [currentQuestionAnswers, players.length]);

/* ===== JOLLY TV ===== */

const jollyQuestionDetails = useMemo(() => {
  if (!currentQuestion?.id) return [];

  const questionAnswers = answers.filter(
    (a) => a.question_id === currentQuestion.id
  );

  const jollyAnswers = questionAnswers.filter((a) => a.is_jolly === true);
  if (!jollyAnswers.length) return [];

  const normalCorrectAnswers = questionAnswers.filter(
    (a) => a.is_correct === true && a.is_jolly !== true
  );

  const normalCorrectScores = normalCorrectAnswers
    .map((a) => Number(a.score_awarded || 0))
    .filter((score) => score > 100);

  const bestTimeBonus =
    normalCorrectScores.length > 0
      ? Math.max(...normalCorrectScores) - 100
      : 100;

  const sourceText =
    normalCorrectScores.length > 0
      ? "miglior risposta corretta"
      : "bonus massimo";

  return jollyAnswers.map((answer) => {
    const player = players.find((p) => p.id === answer.player_id);

    return {
      playerId: answer.player_id,
      playerName: player?.name || "Giocatore",
      totalPoints: 100 + bestTimeBonus,
      bonusPoints: bestTimeBonus,
      sourceText,
    };
  });
}, [answers, players, currentQuestion?.id]);

/* ===== CLASSIFICHE TV ===== */

const sortedPlayers = useMemo(() => {
  return [...players].sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;

    return (a.name || "").localeCompare(b.name || "", "it", {
      sensitivity: "base",
    });
  });
}, [players]);

const podiumPlayers = useMemo(() => {
  return sortedPlayers.slice(0, 3);
}, [sortedPlayers]);

/* ===== LAYOUT LOBBY TV ===== */

const tvQrSize = useMemo(() => {
  const count = players.length;

  if (count >= 30) return 210;
  if (count >= 20) return 240;
  if (count >= 12) return 270;
  return 300;
}, [players.length]);

const tvLobbyPlayerColumns = useMemo(() => {
  const count = players.length;

  if (count >= 36) return 4;
  if (count >= 18) return 3;
  if (count >= 8) return 2;
  return 1;
}, [players.length]);

const tvLobbyPlayerFontSize = useMemo(() => {
  const count = players.length;

  if (count >= 36) return 18;
  if (count >= 24) return 20;
  if (count >= 14) return 22;
  return 26;
}, [players.length]);

const tvLobbyPlayerPadding = useMemo(() => {
  const count = players.length;

  if (count >= 30) return "8px 10px";
  if (count >= 18) return "10px 12px";
  return "12px 14px";
}, [players.length]);

/* =====================================================
   PARTE 5A - CARICAMENTO DATI BASE
===================================================== */

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
        stop10_round_id: null,
        stop10_started_at_ms: null,
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

  const { data, error } = await supabase
    .from("answers")
    .select("*")
    .eq("game_id", gameId);

  if (error) throw error;

  setAnswers(data || []);
  return data || [];
}

async function loadStop10ResultsOnly(gameId) {
  if (!gameId) return [];

  const { data, error } = await supabase
    .from("stop10_results")
    .select("*")
    .eq("game_id", gameId);

  if (error) throw error;

  setStop10Results(data || []);
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
      loadStop10ResultsOnly(g.id),
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

/* =====================================================
   PARTE 5B - IMPORT CSV E NORMALIZZAZIONE
===================================================== */

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
        video_url: String(row.video_url || "").trim(),
        youtube_url: String(row.youtube_url || "").trim(),
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
            stop10_round_id: null,
            stop10_started_at_ms: null,
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
        setStop10Results([]);
        setStop10PlayerStopped(false);
        setStop10PlayerResult(null);
        setStop10TvEffect(null);

        submitLockRef.current = false;
        jollyLockRef.current = false;
        stop10LockRef.current = false;
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

/* =====================================================
   PARTE 6 - AZIONI PRINCIPALI DEL QUIZ
===================================================== */

  /* =========================
     6.1 - Entrata giocatore
  ========================= */

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

      await Promise.all([
        loadGameOnly(),
        loadQuestionsOnly(freshGame.id),
        loadPlayersOnly(freshGame.id),
        loadAnswersOnly(freshGame.id),
        loadEventsOnly(freshGame.id),
      ]);
    } catch (error) {
      console.error(error);
      setStatus("Errore inserimento: " + error.message);
    }
  }

  /* =========================
     6.2 - Avvio quiz
  ========================= */

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

  /* =========================
     6.3 - Reveal risposta
  ========================= */

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

  /* =========================
     6.4 - Domanda successiva / fine quiz
  ========================= */

  async function nextQuestion() {
    if (!game) return;

    const nextIndex = Number(game.current_question_index || 0) + 1;

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
            show_leaderboard: true,
          })
          .eq("id", game.id)
          .select()
          .single();

        if (error) throw error;

        await addLiveEvent(game.id, "final_started", "🏁 Quiz terminato! Classifica finale.");

        setGame(data);
        setSelectedAnswer(null);
        setFinalRevealIndex(-1);
        submitLockRef.current = false;
        jollyLockRef.current = false;
        phaseSwitchInFlightRef.current = false;
        setTvRevealEffect(null);
        setTvJollyEffect(null);
        lastTvQuestionAudioKeyRef.current = null;

        await Promise.all([
          loadPlayersOnly(game.id),
          loadAnswersOnly(game.id),
          loadEventsOnly(game.id),
        ]);

        setStatus("Quiz finito");
      } catch (error) {
        console.error(error);
        setStatus("Errore fine quiz: " + error.message);
      }
      return;
    }

    const q = questions.find((item) => item.position === nextIndex);

    if (!q) {
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
            show_leaderboard: true,
          })
          .eq("id", game.id)
          .select()
          .single();

        if (error) throw error;

        await addLiveEvent(game.id, "final_started", "🏁 Quiz terminato! Classifica finale.");

        setGame(data);
        setSelectedAnswer(null);
        setFinalRevealIndex(-1);
        submitLockRef.current = false;
        jollyLockRef.current = false;
        phaseSwitchInFlightRef.current = false;
        setTvRevealEffect(null);
        setTvJollyEffect(null);
        lastTvQuestionAudioKeyRef.current = null;

        await Promise.all([
          loadPlayersOnly(game.id),
          loadAnswersOnly(game.id),
          loadEventsOnly(game.id),
        ]);

        setStatus("Quiz finito");
      } catch (error) {
        console.error(error);
        setStatus("Errore fine quiz: " + error.message);
      }
      return;
    }

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

  /* =========================
     6.5 - Export classifica CSV
  ========================= */

  function downloadLeaderboardCsv() {
    if (!players.length) {
      setStatus("Nessun giocatore da esportare");
      return;
    }

    const ranking = [...players].sort((a, b) => {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.name || "").localeCompare(b.name || "", "it", { sensitivity: "base" });
    });

    const rows = [
      ["Posizione", "Nome", "Punteggio"],
      ...ranking.map((player, index) => [
        index + 1,
        player.name || "",
        Number(player.score || 0),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5).replace(":", "-");

    link.href = url;
    link.download = `classifica_${GAME_CODE}_${date}_${time}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setStatus("Classifica scaricata in CSV sul PC");
  }

  /* =========================
     6.6 - Reset completo partita
  ========================= */

  async function resetAll() {
    if (!game) return;

    const ok = window.confirm(
      "Hai già scaricato la classifica CSV? Il reset cancellerà giocatori, risposte, domande ed eventi."
    );

    if (!ok) return;

    try {
      await supabase.from("answers").delete().eq("game_id", game.id);
      await supabase.from("players").delete().eq("game_id", game.id);
      await supabase.from("questions").delete().eq("game_id", game.id);
      await supabase.from("live_events").delete().eq("game_id", game.id);
      await supabase.from("stop10_results").delete().eq("game_id", game.id);

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
          stop10_round_id: null,
          stop10_started_at_ms: null,
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
      setStop10Results([]);
      setStop10PlayerStopped(false);
      setStop10PlayerResult(null);
      setStop10TvEffect(null);
      setLiveEvents([]);
      setFinalRevealIndex(-1);
      setRoundName("");

      submitLockRef.current = false;
      jollyLockRef.current = false;
      stop10LockRef.current = false;
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
  
  /* =========================
     6.7 - Mostra/nascondi classifica TV
  ========================= */

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

  /* =========================
     6.8 - Uso JOLLY
  ========================= */

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
          is_jolly: true,
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
        `🔥 ${joinedPlayer.name} ha usato il JOLLY! Bonus finale calcolato a fine domanda`,
        joinedPlayer.name
      );

      setJoinedPlayer(updatedPlayer);
      setJollyUsed(true);
      setSelectedAnswer(currentQuestion.correct_answer);
      setAnswerFeedback({ type: "correct", points: gainedPoints });
      setStatus("💥 JOLLY USATO: +100 provvisori, bonus calcolato a fine domanda");

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

  /* =========================
     6.9 - Invio risposta giocatore
  ========================= */

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
        const remainingSecondsExact = Math.max(
          0,
          getRemainingMs(game, syncedNowRef.current) / 1000
        );
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
          is_jolly: false,
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

    /* =========================
     6.10 - Minigioco STOP 10: avvio host
  ========================= */

  async function startStop10Game() {
    if (!game?.id) return;

    const roundId = Date.now();
    const startedAtMs = Math.round(syncedNowRef.current);

    try {
      await supabase.from("stop10_results").delete().eq("game_id", game.id);

      const { data, error } = await supabase
        .from("games")
        .update({
          phase: "stop10",
          stop10_round_id: roundId,
          stop10_started_at_ms: startedAtMs,
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

      await addLiveEvent(game.id, "stop10_start", "⏱️ PARTITO IL MINIGIOCO STOP 10!");

      setGame(data);
      setStop10Results([]);
      setStop10PlayerStopped(false);
      setStop10PlayerResult(null);
      stop10LockRef.current = false;

      setStatus("Stop10 avviato");
    } catch (error) {
      console.error(error);
      setStatus("Errore avvio Stop10: " + error.message);
    }
  }

  /* =========================
     6.11 - Minigioco STOP 10: stop player
  ========================= */

  async function stop10SubmitStop() {
    if (!game?.id || !joinedPlayer?.id) return;
    if (!stop10RoundId) return;
    if (stop10LockRef.current) return;
    if (effectivePhase !== "stop10") return;
    if (!Number.isFinite(stop10StartedAtMs)) return;
    if (myStop10Result || stop10PlayerStopped) return;

    const stoppedMs = Math.max(0, Math.round(syncedNowRef.current - stop10StartedAtMs));

    if (stoppedMs > 10000) {
      setStatus("Tempo scaduto");
      return;
    }

    try {
      stop10LockRef.current = true;

      const diffMs = Math.abs(10000 - stoppedMs);

      const { data, error } = await supabase
        .from("stop10_results")
        .insert([
          {
            game_id: game.id,
            player_id: joinedPlayer.id,
            player_name: joinedPlayer.name,
            round_id: stop10RoundId,
            stopped_ms: stoppedMs,
            diff_ms: diffMs,
            score_awarded: 0,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setStop10PlayerStopped(true);
      setStop10PlayerResult(data);
      setStatus(`STOP registrato: ${(stoppedMs / 1000).toFixed(2)}s`);

      await loadStop10ResultsOnly(game.id);
    } catch (error) {
      console.error(error);
      setStatus("Errore STOP 10: " + error.message);
    } finally {
      stop10LockRef.current = false;
    }
  }

  /* =========================
     6.12 - Minigioco STOP 10: chiusura e punteggi
  ========================= */

  async function finishStop10Game() {
    if (!game?.id) return;
    if (!stop10RoundId) {
      setStatus("Nessuno Stop10 attivo");
      return;
    }

    try {
      const { data: freshGame, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", game.id)
        .single();

      if (gameError) throw gameError;

      if (freshGame.phase !== "stop10") {
        setStatus("Lo Stop10 non è in corso oppure è già stato chiuso");
        return;
      }

      const { data: resultsData, error: resultsError } = await supabase
        .from("stop10_results")
        .select("*")
        .eq("game_id", game.id)
        .eq("round_id", stop10RoundId);

      if (resultsError) throw resultsError;

      const validResults = (resultsData || [])
        .filter((r) => {
          const stoppedMs = Number(r.stopped_ms || 0);
          return stoppedMs > 0 && stoppedMs <= 10000;
        })
        .sort((a, b) => {
          const diff = Number(a.diff_ms || 0) - Number(b.diff_ms || 0);
          if (diff !== 0) return diff;
          return Number(b.stopped_ms || 0) - Number(a.stopped_ms || 0);
        });

      const pointsByPosition = [200, 150, 100, 70, 50];

      for (let index = 0; index < validResults.length; index += 1) {
        const result = validResults[index];
        const points = pointsByPosition[index] || 30;

        const { data: player, error: playerError } = await supabase
          .from("players")
          .select("id, score")
          .eq("id", result.player_id)
          .single();

        if (playerError) throw playerError;

        const newScore = Number(player.score || 0) + points;

        const { error: updatePlayerError } = await supabase
          .from("players")
          .update({ score: newScore })
          .eq("id", result.player_id);

        if (updatePlayerError) throw updatePlayerError;

        const { error: updateResultError } = await supabase
          .from("stop10_results")
          .update({ score_awarded: points })
          .eq("id", result.id);

        if (updateResultError) throw updateResultError;
      }

      const { data: updatedGame, error: updateGameError } = await supabase
        .from("games")
        .update({
          phase: "stop10_results",
          time_left: 0,
          show_leaderboard: false,
        })
        .eq("id", game.id)
        .select()
        .single();

      if (updateGameError) throw updateGameError;

      await addLiveEvent(
        game.id,
        "stop10_results",
        `🏆 Stop10 concluso! Assegnati punti a ${validResults.length} giocatori`
      );

      setGame(updatedGame);

      await Promise.all([
        loadPlayersOnly(game.id),
        loadStop10ResultsOnly(game.id),
        loadEventsOnly(game.id),
      ]);

      setStatus("Stop10 concluso: punti assegnati");
    } catch (error) {
      console.error(error);
      setStatus("Errore chiusura Stop10: " + error.message);
    }
  }

/* =====================================================
   PARTE 7 - USEEFFECT, REALTIME E SINCRONIZZAZIONI
===================================================== */

/* =========================
   7.1 - Finalizzazione punteggi Jolly
========================= */

async function finalizeJollyScoresForQuestion(gameId, questionId) {
  if (!gameId || !questionId) return;

  const { data: questionAnswers, error: answersError } = await supabase
    .from("answers")
    .select("id, player_id, is_correct, is_jolly, score_awarded")
    .eq("game_id", gameId)
    .eq("question_id", questionId);

  if (answersError) throw answersError;

  const allAnswers = questionAnswers || [];
  const jollyAnswers = allAnswers.filter((a) => a.is_jolly === true);

  if (!jollyAnswers.length) return;

  const normalCorrectAnswers = allAnswers.filter(
    (a) => a.is_correct === true && a.is_jolly !== true
  );

  const normalCorrectScores = normalCorrectAnswers
    .map((a) => Number(a.score_awarded || 0))
    .filter((score) => score > 100);

  const bestTimeBonus =
    normalCorrectScores.length > 0
      ? Math.max(...normalCorrectScores) - 100
      : 100;

  const finalJollyPoints = 100 + bestTimeBonus;

  const { data: currentPlayers, error: playersError } = await supabase
    .from("players")
    .select("id, score")
    .eq("game_id", gameId);

  if (playersError) throw playersError;

  const playersById = new Map(
    (currentPlayers || []).map((p) => [p.id, p])
  );

  for (const jollyAnswer of jollyAnswers) {
    const oldPoints = Number(jollyAnswer.score_awarded || 0);
    const difference = finalJollyPoints - oldPoints;

    if (difference === 0) continue;

    const player = playersById.get(jollyAnswer.player_id);
    if (!player) continue;

    const currentScore = Number(player.score || 0);
    const newScore = currentScore + difference;

    // 🔧 aggiorna answer
    const { error: updateAnswerError } = await supabase
      .from("answers")
      .update({
        score_awarded: finalJollyPoints,
      })
      .eq("id", jollyAnswer.id);

    if (updateAnswerError) throw updateAnswerError;

    // 🔧 aggiorna player
    const { error: updatePlayerError } = await supabase
      .from("players")
      .update({
        score: newScore,
      })
      .eq("id", jollyAnswer.player_id);

    if (updatePlayerError) throw updatePlayerError;
  }
}

/* =========================
   7.2 - Bootstrap iniziale dati
========================= */

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



/* =========================
   7.3 - Realtime Supabase
========================= */

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

  const refreshAllGameData = async () => {
    try {
      await Promise.all([
        loadGameOnly(),
        loadQuestionsOnly(game.id),
        loadPlayersOnly(game.id),
        loadAnswersOnly(game.id),
        loadStop10ResultsOnly(game.id),
        loadEventsOnly(game.id),
      ]);
    } catch (error) {
      console.error(error);
    }
  };

  const channel = supabase
    .channel(`quiz-live-${game.id}`)

    /* games */
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `id=eq.${game.id}` },
      async (payload) => {
        if (payload?.new) setGame(payload.new);
        else await loadGameOnly();
      }
    )

    /* players */
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "players", filter: `game_id=eq.${game.id}` },
      async (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;

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

    /* questions */
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "questions", filter: `game_id=eq.${game.id}` },
      async () => {
        await loadQuestionsOnly(game.id);
      }
    )

    /* answers */
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "answers", filter: `game_id=eq.${game.id}` },
      async () => {
        await loadAnswersOnly(game.id);
      }
    )

    /* stop10_results */
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "stop10_results", filter: `game_id=eq.${game.id}` },
      async () => {
        await loadStop10ResultsOnly(game.id);
      }
    )

    /* events */
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_events", filter: `game_id=eq.${game.id}` },
      async (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;

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
        refreshAllGameData();
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

/* =========================
   7.4 - Refresh fallback
========================= */

useEffect(() => {
  if (fallbackRefreshRef.current) {
    clearInterval(fallbackRefreshRef.current);
    fallbackRefreshRef.current = null;
  }

  if (!game?.id) return;

  fallbackRefreshRef.current = setInterval(() => {
    loadGameOnly().catch(() => {});
    loadQuestionsOnly(game.id).catch(() => {});
    loadPlayersOnly(game.id).catch(() => {});
    loadAnswersOnly(game.id).catch(() => {});
    loadStop10ResultsOnly(game.id).catch(() => {}); // 👈 AGGIUNTO
    loadEventsOnly(game.id).catch(() => {});
  }, 3000);

  return () => {
    if (fallbackRefreshRef.current) {
      clearInterval(fallbackRefreshRef.current);
      fallbackRefreshRef.current = null;
    }
  };
}, [game?.id]);

/* =========================
   7.5 - Refresh visibilità pagina
========================= */

useEffect(() => {
  if (!game?.id) return;

  const refresh = () => {
    loadGameOnly().catch(() => {});
    loadQuestionsOnly(game.id).catch(() => {});
    loadPlayersOnly(game.id).catch(() => {});
    loadAnswersOnly(game.id).catch(() => {});
    loadEventsOnly(game.id).catch(() => {});
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") refresh();
  };

  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", onVisible);
  };
}, [game?.id]);


/* =========================
   7.6 - Reset risposta su cambio fase
========================= */

useEffect(() => {
  if (effectivePhase === "countdown" || effectivePhase === "question") {
    setSelectedAnswer(null);
    setAnswerFeedback(null);
    submitLockRef.current = false;

    if (game?.id) {
      loadGameOnly().catch(() => {});
      loadQuestionsOnly(game.id).catch(() => {});
      loadAnswersOnly(game.id).catch(() => {});
    }
  }
}, [game?.id, game?.current_question_index, effectivePhase]);


/* =========================
   7.7 - Auto clear feedback risposta
========================= */

useEffect(() => {
  if (!answerFeedback) return;

  const timeout = setTimeout(() => {
    setAnswerFeedback(null);
  }, 1200);

  return () => clearTimeout(timeout);
}, [answerFeedback]);

/* =========================
   7.8 - Passaggio automatico countdown → question
========================= */

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


/* =========================
   7.9 - Fine timer domanda → stats
========================= */

useEffect(() => {
  if (role !== "host") return;
  if (!game?.id) return;
  if (!currentQuestion?.id) return;
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

      await finalizeJollyScoresForQuestion(game.id, currentQuestion.id);

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

      await Promise.all([
        loadPlayersOnly(game.id),
        loadAnswersOnly(game.id),
        loadEventsOnly(game.id),
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => {
        phaseSwitchInFlightRef.current = false;
      }, 300);
    }
  })();
}, [role, game, game?.id, currentQuestion?.id, effectivePhase, syncedNowMs]);
/* =========================
   7.10 - Audio countdown TV
========================= */

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


/* =========================
   7.11 - Audio domanda TV
========================= */

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


/* =========================
   7.12 - Cleanup audio TV
========================= */

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

/* =========================
   7.13 - Pulizia effetto Jolly TV
========================= */

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


/* =========================
   7.14 - Reveal risposta TV
========================= */

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


/* =========================
   7.15 - Overlay Jolly TV
========================= */

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


/* =========================
   7.16 - Cleanup generale TV
========================= */

useEffect(() => {
  return () => {
    stopCountdownAudio();
    if (tvJollyTimeoutRef.current) clearTimeout(tvJollyTimeoutRef.current);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
  };
}, [stopCountdownAudio]);


/* =========================
   7.17 - Animazione podio finale
========================= */

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

/* =========================
   7.17B - Reveal progressivo classifica provvisoria TV
========================= */

useEffect(() => {
  if (role !== "tv") return;

  if (!game?.show_leaderboard || game?.phase === "final") {
    setLeaderboardRevealCount(0);
    return;
  }

  const totalPlayers = players.length;

  if (totalPlayers <= 0) {
    setLeaderboardRevealCount(0);
    return;
  }

  setLeaderboardRevealCount(1);

  const interval = setInterval(() => {
    setLeaderboardRevealCount((current) => {
      if (current >= totalPlayers) {
        clearInterval(interval);
        return current;
      }

      return current + 1;
    });
  }, 3000);

  return () => clearInterval(interval);
}, [role, game?.show_leaderboard, game?.phase, players.length]);

/* =========================
   7.18 - AUTOSCALE PLAYER
========================= */

useEffect(() => {
  if (role !== "player") return;

  if (effectivePhase !== "question") {
    setPlayerQuestionScale(1);
    setPlayerQuestionFitReady(false);
    return;
  }

  const outer = playerQuestionOuterRef.current;
  const inner = playerQuestionInnerRef.current;

  if (!outer || !inner) return;

  let frameId = null;

  setPlayerQuestionFitReady(false);

  const fitPlayerQuestion = () => {
    inner.style.transform = "scale(1)";
    inner.style.width = "100%";

    const outerHeight = outer.clientHeight;
    const innerHeight = inner.scrollHeight;

    if (!outerHeight || !innerHeight) {
      setPlayerQuestionScale(1);
      setPlayerQuestionFitReady(true);
      return;
    }

    let scale = 1;

    while (innerHeight * scale > outerHeight && scale > 0.78) {
      scale -= 0.02;
    }

    scale = Math.max(0.78, Math.min(1, scale));

    setPlayerQuestionScale(scale);
    setPlayerQuestionFitReady(true);
  };

  const requestFit = () => {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(fitPlayerQuestion);
  };

  requestFit();

  const timeout1 = setTimeout(requestFit, 40);
  const timeout2 = setTimeout(requestFit, 120);
  const timeout3 = setTimeout(requestFit, 260);

  window.addEventListener("resize", requestFit);
  window.addEventListener("orientationchange", requestFit);

  return () => {
    if (frameId) cancelAnimationFrame(frameId);
    clearTimeout(timeout1);
    clearTimeout(timeout2);
    clearTimeout(timeout3);
    window.removeEventListener("resize", requestFit);
    window.removeEventListener("orientationchange", requestFit);
  };
}, [
  role,
  effectivePhase,
  currentQuestion?.id,
  currentQuestion?.question,
  currentQuestion?.image_url,
  currentQuestion?.audio_url,
  currentQuestion?.option_a,
  currentQuestion?.option_b,
  currentQuestion?.option_c,
  currentQuestion?.option_d,
  localTimeLeft,
  selectedAnswer,
]);

/* =========================
   7.19 - Reset stato Stop10
========================= */

useEffect(() => {
  if (!game?.stop10_round_id) return;

  setStop10PlayerStopped(false);
  setStop10PlayerResult(null);
  stop10LockRef.current = false;
}, [game?.stop10_round_id]);

/* =====================================================
   PARTE 8 - STILI LOCALI E FUNZIONI RENDER
===================================================== */

/* =========================
   8.1 - Stili base layout
========================= */

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


/* =========================
   8.2 - Stili feedback e media
========================= */

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


/* =========================
   8.3 - Render statistiche TV
========================= */

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 30,
        }}
      >
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

/* =========================
   8.4 - Render media domanda
========================= */

const renderQuestionMedia = (question, mode = "player") => {
  if (!question) return null;

  const hasImage = Boolean(question.image_url);
  const hasAudio = Boolean(question.audio_url);

  if (!hasImage && !hasAudio) return null;

  const imageMaxHeight =
    mode === "tv" ? "26vh" : mode === "host" ? "160px" : "14dvh";

  return (
    <div
      style={{
        display: "grid",
        gap: mode === "player" ? 6 : 14,
        width: "100%",
        maxWidth: mode === "tv" ? 1000 : 700,
        margin: mode === "player" ? "0 auto 6px" : "0 auto 18px",
        minHeight: 0,
        flexShrink: 0,
      }}
    >
      {hasImage && (
        <div
          style={{
            width: "100%",
            borderRadius: mode === "player" ? 12 : 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.06)",
            boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
            maxHeight: imageMaxHeight,
          }}
        >
          <img
            src={question.image_url}
            alt="Immagine domanda"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              maxHeight: imageMaxHeight,
              objectFit: "contain",
              background: "rgba(0,0,0,0.18)",
            }}
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

/* =====================================================
   PARTE 9 - RENDER SCHERMATA SCELTA RUOLO E PLAYER
===================================================== */

/* =========================
   9.1 - Scelta ruolo
========================= */

if (!role) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: APP_BG,
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
        <h1 style={{ fontSize: 44, marginBottom: 10 }}>
          🍻 {getGameTitle(game)}
        </h1>

        <p style={{ opacity: 0.85, marginBottom: 24 }}>
          Scegli come vuoi entrare
        </p>

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


/* =========================
   9.2 - Accesso HOST (password)
========================= */

if (role === "host" && !hostAuthorized) {
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

      <div
        style={{
          ...panelStyle,
          width: "100%",
          maxWidth: 520,
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1 style={{ marginBottom: 10 }}>🔐 Accesso Host</h1>

        <p style={{ opacity: 0.85, marginBottom: 22 }}>
          Inserisci la password per accedere al pannello host
        </p>

        <input
          type="password"
          placeholder="Password host"
          value={hostPasswordInput}
          onChange={(e) => {
            setHostPasswordInput(e.target.value);
            if (hostPasswordError) setHostPasswordError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (hostPasswordInput === HOST_PASSWORD) {
                setHostAuthorized(true);
                setHostPasswordError("");
              } else {
                setHostPasswordError("Password errata");
              }
            }
          }}
          style={{
            padding: 14,
            width: "100%",
            maxWidth: 320,
            borderRadius: 12,
            border: "none",
            marginBottom: 14,
            fontSize: 16,
          }}
        />

        <div>
          <button
            onClick={() => {
              if (hostPasswordInput === HOST_PASSWORD) {
                setHostAuthorized(true);
                setHostPasswordError("");
              } else {
                setHostPasswordError("Password errata");
              }
            }}
            style={buttonStyle}
          >
            ENTRA COME HOST
          </button>
        </div>

        {hostPasswordError && (
          <div
            style={{
              marginTop: 12,
              color: "#f87171",
              fontWeight: "bold",
            }}
          >
            {hostPasswordError}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => {
              setRole(null);
              setHostPasswordInput("");
              setHostPasswordError("");
            }}
            style={{
              background: "transparent",
              color: "white",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 12,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Torna indietro
          </button>
        </div>
      </div>
    </div>
  );
}


/* =========================
   9.3 - Login PLAYER (join partita)
========================= */

if (role === "player" && !joinedPlayer) {
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

      <div
        style={{
          ...panelStyle,
          width: "100%",
          maxWidth: 560,
          textAlign: "center",
        }}
      >
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

/* =========================
   9.4 - Dati e layout dinamico PLAYER
========================= */

if (role === "player") {
  const finalRanking = [...(players || [])].sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.name || "").localeCompare(b.name || "", "it", { sensitivity: "base" });
  });

  const myFinalIndex = finalRanking.findIndex((p) => p.id === joinedPlayer.id);
  const myFinalPosition = myFinalIndex >= 0 ? myFinalIndex + 1 : null;
  const myFinalPlayer = myFinalIndex >= 0 ? finalRanking[myFinalIndex] : joinedPlayer;

  const questionText = currentQuestion?.question || "";
  const optionAText = currentQuestion?.option_a || "";
  const optionBText = currentQuestion?.option_b || "";
  const optionCText = currentQuestion?.option_c || "";
  const optionDText = currentQuestion?.option_d || "";

  const longestAnswerLength = Math.max(
    optionAText.length,
    optionBText.length,
    optionCText.length,
    optionDText.length
  );

  const playerMediaHint = getQuestionMediaHint(currentQuestion);

  const isVeryLongQuestion = questionText.length > 140;
  const isLongQuestion = questionText.length > 100;
  const hasVeryLongAnswers = longestAnswerLength > 34;
  const hasLongAnswers = longestAnswerLength > 24;

  const compactQuestionLayout = isVeryLongQuestion || hasVeryLongAnswers;
  const mediumQuestionLayout =
    !compactQuestionLayout && (isLongQuestion || hasLongAnswers);

  const playerTopPanelPadding =
    effectivePhase === "question"
      ? compactQuestionLayout
        ? "8px 10px"
        : mediumQuestionLayout
        ? "9px 11px"
        : "10px 12px"
      : undefined;

  const playerTopPanelMarginBottom =
    effectivePhase === "question"
      ? compactQuestionLayout
        ? 6
        : 8
      : 20;

  const playerNameFontSize =
    effectivePhase === "question"
      ? compactQuestionLayout
        ? "clamp(16px, 4.2vw, 20px)"
        : "clamp(18px, 5vw, 22px)"
      : undefined;

  const playerTopTextFontSize =
    effectivePhase === "question"
      ? compactQuestionLayout
        ? "clamp(12px, 3.2vw, 14px)"
        : "clamp(13px, 3.4vw, 15px)"
      : undefined;

  const playerJollyFontSize = compactQuestionLayout
    ? "clamp(11px, 3vw, 13px)"
    : "clamp(12px, 3.4vw, 14px)";

  const playerQuestionCardPadding = compactQuestionLayout
    ? "10px 10px"
    : mediumQuestionLayout
    ? "12px 12px"
    : "14px 14px";

  const playerTimerFontSize = compactQuestionLayout
    ? "clamp(20px, 5vw, 28px)"
    : mediumQuestionLayout
    ? "clamp(22px, 5.5vw, 30px)"
    : "clamp(24px, 6vw, 32px)";

  const playerQuestionFontSize = compactQuestionLayout
    ? "clamp(15px, 3.6vw, 19px)"
    : mediumQuestionLayout
    ? "clamp(17px, 4vw, 21px)"
    : "clamp(19px, 4.6vw, 25px)";

  const playerAnswerFontSize = compactQuestionLayout
    ? "clamp(12px, 3.2vw, 15px)"
    : mediumQuestionLayout
    ? "clamp(13px, 3.4vw, 16px)"
    : "clamp(14px, 3.8vw, 17px)";

  const playerAnswerMinHeight = compactQuestionLayout
    ? 44
    : mediumQuestionLayout
    ? 48
    : 52;

  const playerAnswerPadding = compactQuestionLayout ? "8px 10px" : "10px 12px";
  const playerAnswersGap = compactQuestionLayout ? 6 : 8;
  const playerQuestionMarginBottom = compactQuestionLayout ? 8 : 10;
  const playerTimerMarginBottom = compactQuestionLayout ? 6 : 8;
  const playerMediaMarginBottom = compactQuestionLayout ? 6 : 8;
  const playerStatusMarginTop = compactQuestionLayout ? 8 : 10;

  const playerHintStyle = {
    width: "fit-content",
    maxWidth: "100%",
    margin: "0 auto 10px",
    padding: compactQuestionLayout ? "6px 12px" : "8px 16px",
    borderRadius: 999,
    background: "rgba(255,215,64,0.16)",
    border: "1px solid rgba(255,215,64,0.55)",
    color: GOLD,
    fontSize: compactQuestionLayout ? "clamp(13px, 3.5vw, 16px)" : "clamp(15px, 4vw, 19px)",
    fontWeight: "bold",
    boxShadow: "0 0 18px rgba(255,215,64,0.18)",
    textAlign: "center",
  };


  /* =========================
     9.5 - Schermata PLAYER principale
  ========================= */

  return (
    <div
      style={{
        ...containerStyle,
        position: "relative",
        minHeight: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
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

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 10px 22px",
        }}
      >
        <div
          style={{
            ...panelStyle,
            textAlign: "center",
            marginBottom: playerTopPanelMarginBottom,
            padding: playerTopPanelPadding,
          }}
        >
          <h1
            style={{
              marginBottom: effectivePhase === "question" ? 4 : 8,
              fontSize: playerNameFontSize,
            }}
          >
            🎮 {joinedPlayer.name}
          </h1>

          <p style={{ margin: "2px 0", fontSize: playerTopTextFontSize }}>
            <b>Punti:</b> {joinedPlayer.score || 0}
          </p>

          <p style={{ margin: "2px 0", fontSize: playerTopTextFontSize }}>
            <b>Stato:</b> {status}
          </p>

          {!jollyUsed && effectivePhase === "question" && localTimeLeft > 0 && (
            <button
              onClick={useJollyCard}
              style={{
                ...buttonStyle,
                marginTop: 6,
                padding: compactQuestionLayout ? "7px 10px" : "8px 12px",
                fontSize: playerJollyFontSize,
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              }}
            >
              USA JOLLY
            </button>
          )}

          {jollyUsed && (
            <p
              style={{
                color: GOLD,
                fontWeight: "bold",
                marginTop: 6,
                fontSize: playerTopTextFontSize,
              }}
            >
              JOLLY già usato
            </p>
          )}
        </div>

                {/* =========================
           9.5B - Minigioco STOP 10 PLAYER
        ========================= */}

        {effectivePhase === "stop10" && (
          <div style={{ ...panelStyle, textAlign: "center" }}>
            <h2 style={{ fontSize: 34, marginBottom: 12 }}>
              ⏱️ STOP ALLO ZERO
            </h2>

            <p style={{ fontSize: 18, opacity: 0.9, marginBottom: 18 }}>
              Premi STOP il più vicino possibile allo zero.
              <br />
              A 3 secondi il timer sparisce.
            </p>

            {!stop10HideTimer ? (
              <div
                style={{
                  fontSize: 76,
                  fontWeight: "bold",
                  color: GOLD,
                  marginBottom: 22,
                  animation: "pulseTime 1s infinite",
                }}
              >
                {Math.max(0, (10 - stop10ElapsedSeconds)).toFixed(1)}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 38,
                  fontWeight: "bold",
                  color: GOLD,
                  marginBottom: 22,
                }}
              >
                TIMER NASCOSTO
              </div>
            )}

            {myStop10Result || stop10PlayerResult ? (
              <div
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(34,197,94,0.16)",
                  border: "1px solid rgba(34,197,94,0.45)",
                  fontWeight: "bold",
                  fontSize: 22,
                }}
              >
                ✅ STOP registrato
                <div style={{ marginTop: 10, color: GOLD }}>
                  Mancavano{" "}
                  {Math.max(
                    0,
                    (10000 - Number((myStop10Result || stop10PlayerResult).stopped_ms || 0)) / 1000
                  ).toFixed(2)}
                  s
                </div>
              </div>
            ) : stop10ElapsedMs >= 10000 ? (
              <div
                style={{
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(239,68,68,0.16)",
                  border: "1px solid rgba(239,68,68,0.45)",
                  fontWeight: "bold",
                  fontSize: 22,
                }}
              >
                ⛔ Tempo scaduto
              </div>
            ) : (
              <button
                onClick={stop10SubmitStop}
                disabled={stop10PlayerStopped || stop10LockRef.current}
                style={{
                  ...buttonStyle,
                  width: "100%",
                  maxWidth: 360,
                  fontSize: 30,
                  padding: "22px 26px",
                  background: "linear-gradient(135deg, #ef4444 0%, #991b1b 100%)",
                }}
              >
                STOP
              </button>
            )}
          </div>
        )}

        {/* =========================
           9.6 - Lobby PLAYER
        ========================= */}

        {game?.phase === "lobby" && (
          <div style={{ ...panelStyle, textAlign: "center" }}>
            <h2>Attendi l'inizio del quiz...</h2>
          </div>
        )}


        {/* =========================
           9.7 - Countdown PLAYER
        ========================= */}

        {effectivePhase === "countdown" && currentQuestion && (
          <div style={{ ...panelStyle, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
              Preparati...
            </div>

            {playerMediaHint && <div style={playerHintStyle}>{playerMediaHint}</div>}

            <div style={{ fontSize: 24, opacity: 0.85, marginBottom: 12 }}>
              Prossima domanda tra...
            </div>

            <div style={{ fontSize: 64, fontWeight: "bold", color: GOLD }}>
              {countdownTimeLeft}
            </div>
          </div>
        )}

        {/* =========================
           9.8 - PLAYER - DOMANDA
        ========================= */}

        {effectivePhase === "question" && currentQuestion && (
          <div
            ref={playerQuestionOuterRef}
            style={{
              position: "fixed",
              inset: 0,
              background: APP_BG,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              overflow: "hidden",
              padding: "10px",
              boxSizing: "border-box",
              zIndex: 50,
            }}
          >
            <div
              ref={playerQuestionInnerRef}
              style={{
                ...panelStyle,
                width: "100%",
                maxWidth: "700px",
                textAlign: "center",
                padding: "10px",
                transform: `scale(${playerQuestionScale})`,
                opacity: playerQuestionFitReady ? 1 : 0,
                transformOrigin: "top center",
                transition: "opacity 0.06s ease",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 8 }}>
                ⏱ {Math.max(0, localTimeLeft)}s
              </div>

              <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
                {currentQuestion.question}
              </div>

              {currentQuestion.image_url && (
                <img
                  src={currentQuestion.image_url}
                  alt="Immagine domanda"
                  style={{
                    width: "100%",
                    maxHeight: "40vh",
                    objectFit: "contain",
                    marginBottom: 8,
                    borderRadius: 10,
                  }}
                />
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["A", "B", "C", "D"].map((letter) => {
                  const text = currentQuestion[`option_${letter.toLowerCase()}`];
                  if (!text) return null;

                  return (
                    <button
                      key={letter}
                      onClick={() => submitAnswer(letter)}
                      disabled={!!selectedAnswer}
                      style={{
                        ...getPlayerAnswerButtonStyle(
                          letter,
                          !!selectedAnswer,
                          selectedAnswer === letter
                        ),
                        padding: "10px",
                        fontSize: 16,
                        borderRadius: 10,
                      }}
                    >
                      {letter}) {text}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
       
        {/* =========================
   9.9 - Stats / Reveal / Finale PLAYER
========================= */}

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

            <h2 style={{ color: GREEN }}>
              ✅ Risposta corretta: {currentQuestion.correct_answer}
            </h2>

            <p style={{ fontSize: 18 }}>
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {game?.phase === "final" && (
          <div style={{ ...panelStyle, textAlign: "center" }}>
            <h2 style={{ marginBottom: 12 }}>🏁 Quiz terminato</h2>

            {myFinalPosition && (
              <div
                style={{
                  margin: "0 auto 24px",
                  maxWidth: 420,
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(255,215,64,0.14)",
                  border: "1px solid rgba(255,215,64,0.45)",
                }}
              >
                <div style={{ fontSize: 18, opacity: 0.9, marginBottom: 6 }}>
                  La tua posizione
                </div>

                <div style={{ fontSize: 42, fontWeight: "bold", color: GOLD }}>
                  #{myFinalPosition}
                </div>

                <div style={{ marginTop: 10, fontSize: 18 }}>
                  {myFinalPlayer?.name} • {myFinalPlayer?.score || 0} punti
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 10,
                textAlign: "left",
                maxWidth: 560,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              <h3 style={{ textAlign: "center", marginBottom: 16 }}>
                Classifica finale
              </h3>

              <div style={{ display: "grid", gap: 10 }}>
                {finalRanking.map((player, index) => {
                  const isMe = player.id === joinedPlayer.id;
                  const position = index + 1;

                  return (
                    <div
                      key={player.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: isMe
                          ? "rgba(255,215,64,0.16)"
                          : "rgba(255,255,255,0.08)",
                        border: isMe
                          ? "1px solid rgba(255,215,64,0.45)"
                          : "1px solid rgba(255,255,255,0.12)",
                        fontWeight: isMe ? "bold" : "normal",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                        <div
                          style={{
                            minWidth: 44,
                            textAlign: "center",
                            fontSize: 20,
                            fontWeight: "bold",
                            color:
                              position === 1
                                ? GOLD
                                : position === 2
                                ? "#d1d5db"
                                : position === 3
                                ? "#cd7f32"
                                : "white",
                          }}
                        >
                          {position === 1
                            ? "🥇"
                            : position === 2
                            ? "🥈"
                            : position === 3
                            ? "🥉"
                            : `#${position}`}
                        </div>

                        <div style={{ fontSize: 18 }}>
                          {player.name} {player.jolly_used ? "🃏" : ""} {isMe ? "(Tu)" : ""}
                        </div>
                      </div>

                      <div style={{ fontSize: 18, fontWeight: "bold", color: isMe ? GOLD : "white" }}>
                        {player.score || 0} pt
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* =====================================================
   PARTE 10 - RENDER SCHERMATA TV
===================================================== */

if (role === "tv") {

  /* =========================
     10.1 - Helper YouTube embed
  ========================= */

  const getTvYouTubeEmbedUrl = (url) => {
    if (!url) return "";

    try {
      const parsed = new URL(String(url).trim());
      let videoId = "";

      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "").split("?")[0];
      } else if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname.startsWith("/watch")) {
          videoId = parsed.searchParams.get("v") || "";
        } else if (parsed.pathname.startsWith("/shorts/")) {
          videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
        } else if (parsed.pathname.startsWith("/embed/")) {
          videoId = parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        }
      }

      if (!videoId) return "";

      const startRaw = parsed.searchParams.get("start") || parsed.searchParams.get("t") || "";
      const start = String(startRaw).replace("s", "").trim();

      const params = new URLSearchParams({
        autoplay: "1",
        controls: "1",
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
      });

      if (/^\d+$/.test(start)) {
        params.set("start", start);
      }

      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    } catch {
      return "";
    }
  };


  /* =========================
     10.2 - Helper hint media (audio/video/img)
  ========================= */

  const getTvMediaHint = (question) => {
    if (!question) return "";
    if (question.audio_url) return "🎧 ASCOLTA BENE";
    if (question.youtube_url || question.video_url) return "🎬 GUARDA ATTENTAMENTE";
    if (question.image_url) return "🖼️ GUARDA ATTENTAMENTE";
    return "";
  };


  /* =========================
     10.3 - Render media domanda TV
  ========================= */

  const renderTvQuestionMedia = (question, variant = "question") => {
    if (!question) return null;

    const hasImage = Boolean(question.image_url) && variant !== "countdown";
    const hasAudio = Boolean(question.audio_url) && variant !== "countdown";
    const hasVideo = Boolean(question.video_url) && variant === "question";
    const hasYouTube = Boolean(question.youtube_url) && variant === "question";
    const youtubeEmbedUrl = getTvYouTubeEmbedUrl(question.youtube_url);

    if (!hasImage && !hasAudio && !hasVideo && !hasYouTube) return null;

    const imageMaxHeight =
      variant === "question" ? "20vh" : variant === "stats" ? "18vh" : "18vh";

    const videoHeight = "28vh";

    return (
      <div
        style={{
          width: "100%",
          maxWidth: 1000,
          margin: "0 auto",
          display: "grid",
          gap: 10,
          alignContent: "start",
          justifyItems: "center",
          minHeight: 0,
        }}
      >
        {hasImage && (
          <div
            style={{
              width: "100%",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.06)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
            }}
          >
            <img
              src={question.image_url}
              alt="Immagine domanda"
              style={{
                display: "block",
                width: "100%",
                maxHeight: imageMaxHeight,
                objectFit: "contain",
                background: "rgba(0,0,0,0.18)",
              }}
            />
          </div>
        )}

        {hasYouTube && youtubeEmbedUrl && (
          <div
            style={{
              width: "100%",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(0,0,0,0.35)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
            }}
          >
            <iframe
              src={youtubeEmbedUrl}
              title="Video YouTube domanda"
              style={{
                display: "block",
                width: "100%",
                height: videoHeight,
                border: "none",
                background: "black",
              }}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {hasVideo && !hasYouTube && (
          <div
            style={{
              width: "100%",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(0,0,0,0.35)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
            }}
          >
            <video
              src={question.video_url}
              controls
              autoPlay
              playsInline
              style={{
                display: "block",
                width: "100%",
                maxHeight: videoHeight,
                background: "black",
              }}
            />
          </div>
        )}

        {hasAudio && !hasVideo && !hasYouTube && (
          <div
            style={{
              width: "fit-content",
              maxWidth: "100%",
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.07)",
              fontSize: "clamp(15px, 1.25vw, 22px)",
              fontWeight: "bold",
            }}
          >
            🔊 Audio domanda in riproduzione
          </div>
        )}
      </div>
    );
  };


  /* =========================
     10.4 - Layout base TV (contenitore principale)
  ========================= */

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

      {/* =========================
         10.5 - Audio TV nascosto e logo
      ========================= */}

      <audio
        ref={tvQuestionAudioRef}
        preload="auto"
        playsInline
        style={{ display: "none" }}
      />

      <img src={LOGO_BG} alt="Logo quiz" style={tvLogoStyle} />


      {/* =========================
         10.6 - Badge numero domanda
      ========================= */}

      {game?.phase !== "final" && questions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 104,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            padding: "8px 18px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.22)",
            color: GOLD,
            fontSize: "clamp(18px, 1.6vw, 28px)",
            fontWeight: "bold",
            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
          }}
        >
          🎯 Domanda {Number(game?.current_question_index || 0) + 1} / {questions.length}
        </div>
      )}


      {/* =========================
         10.7 - Overlay attivazione audio TV
      ========================= */}

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

{/* =========================
   10.8 - TV STOP10 RISULTATI (FIX DEFINITIVO)
========================= */}

{effectivePhase === "stop10_results" && !Boolean(game?.show_leaderboard) && (() => {
  const sorted = [...(stop10Results || [])].sort(
    (a, b) => Number(a.diff_ms || 0) - Number(b.diff_ms || 0)
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(circle at center, #020617 0%, #000 100%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 9996,
      }}
    >
      {/* TITOLO */}
      <div
        style={{
          fontSize: 60,
          fontWeight: "bold",
          marginBottom: 40,
          textShadow: "0 0 20px rgba(255,255,255,0.3)",
        }}
      >
        ⏱ STOP A 10 SECONDI
      </div>

      {/* LISTA */}
      <div style={{ width: "80%", maxWidth: 900 }}>
        {sorted.map((p, i) => {
          const isWinner = i === 0;
          const seconds = (Number(p.stopped_ms || 0) / 1000).toFixed(2);
          const diff = (Number(p.diff_ms || 0) / 1000).toFixed(2);

          return (
            <div
              key={p.id || p.player_id}
              style={{
                marginBottom: 15,
                padding: "15px 25px",
                borderRadius: 12,
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: 22,
                alignItems: "center",
                background: isWinner
                  ? "linear-gradient(135deg,#facc15,#ca8a04)"
                  : "rgba(255,255,255,0.05)",
                color: isWinner ? "#111827" : "white",
                animation: "slideUp 0.6s ease forwards",
              }}
            >
              {/* NOME */}
              <div style={{ fontSize: 26, fontWeight: "bold" }}>
                {i + 1}. {p.player_name}
              </div>

              {/* TEMPO */}
              <div style={{ fontSize: 26 }}>
                {seconds}s
              </div>

              {/* DIFFERENZA */}
              <div style={{ fontSize: 20, opacity: 0.75 }}>
                Δ {diff}s
              </div>

              {/* PUNTI */}
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: isWinner ? "#14532d" : "#22c55e",
                }}
              >
                +{p.score_awarded || 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* VINCITORE */}
      {sorted[0] && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            fontSize: 50,
            fontWeight: "bold",
            color: "#facc15",
            textShadow: "0 0 25px rgba(250,204,21,0.9)",
            animation: "winnerPop 1s ease forwards",
          }}
        >
          🏆 VINCE {String(sorted[0].player_name || "").toUpperCase()}
        </div>
      )}
    </div>
  );
})()}
      
{/* =========================
   10.9 - STILI GLOBALI TV
========================= */}
<style>
{`
/* ===== BASE ===== */
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

/* ===== STOP10 ENTRY (nomi giocatori) ===== */
@keyframes stopEntry {
  0% { transform: translateX(90px) scale(0.88); opacity: 0; }
  70% { transform: translateX(-8px) scale(1.04); opacity: 1; }
  100% { transform: translateX(0) scale(1); opacity: 1; }
}

/* ===== LEADER HIGHLIGHT ===== */
@keyframes leaderPulse {
  0% { transform: scale(1); box-shadow: 0 0 22px rgba(250,204,21,0.42); }
  50% { transform: scale(1.045); box-shadow: 0 0 64px rgba(250,204,21,0.90); }
  100% { transform: scale(1); box-shadow: 0 0 22px rgba(250,204,21,0.42); }
}

/* ===== SFONDO DINAMICO STOP10 ===== */
@keyframes stopBackgroundMove {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* ===== GLOW TESTO ===== */
@keyframes textGlow {
  0% { text-shadow: 0 0 10px rgba(255,255,255,0.2); }
  50% { text-shadow: 0 0 30px rgba(255,255,255,0.9); }
  100% { text-shadow: 0 0 10px rgba(255,255,255,0.2); }
}

/* ===== COUNTDOWN DRAMMATICO ===== */
@keyframes countdownPulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

/* ===== PARTICELLE LENTE ===== */
@keyframes floatParticles {
  0% { transform: translateY(0px); opacity: 0.2; }
  50% { transform: translateY(-20px); opacity: 0.6; }
  100% { transform: translateY(0px); opacity: 0.2; }
}

/* ===== CLASSIFICA SLIDE ===== */
@keyframes slideUp {
  0% { transform: translateY(40px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

/* ===== GENERALE ===== */
.tv-anim-fade {
  animation: fadeIn 0.4s ease;
}

.stop-entry {
  animation: stopEntry 0.6s ease;
}

.leader-highlight {
  animation: leaderPulse 1.6s infinite;
}

.stop-bg {
  background: linear-gradient(270deg, #0f172a, #1e293b, #020617);
  background-size: 600% 600%;
  animation: stopBackgroundMove 10s ease infinite;
}

.glow-text {
  animation: textGlow 2s ease-in-out infinite;
}

.countdown-effect {
  animation: countdownPulse 1s infinite;
}

.float-particles {
  animation: floatParticles 6s ease-in-out infinite;
}

.slide-up {
  animation: slideUp 0.5s ease;
}
`}
</style>
      
      {/* =========================
         10.10 - Contenitore schermate TV
      ========================= */}

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

{/* =========================
   10.10B - Minigioco STOP 10 TV
========================= */}

{effectivePhase === "stop10" && (
  <div
    className="stop-bg tv-anim-fade"
    style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "40px 20px",
      color: "white",
      overflow: "hidden",
      zIndex: 9995,
    }}
  >
    {/* PARTICELLE SFONDO */}
    <div
      className="float-particles"
      style={{
        position: "absolute",
        width: "200%",
        height: "200%",
        top: "-50%",
        left: "-50%",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />

    {/* CONTENUTO */}
    <div
      style={{
        position: "relative",
        zIndex: 2,
        width: "100%",
        maxWidth: 1100,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* TITOLO */}
      <div
        className="glow-text"
        style={{
          fontSize: "clamp(40px, 6vw, 80px)",
          fontWeight: "900",
          marginBottom: 10,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        ⏱ STOP A 10 SECONDI
      </div>

      <div
        style={{
          fontSize: "clamp(18px, 2vw, 28px)",
          opacity: 0.85,
          marginBottom: 28,
          textAlign: "center",
        }}
      >
        Fermati il più vicino possibile a 10.00
      </div>

      {/* TIMER GRANDE */}
      <div
        className="countdown-effect"
        style={{
          fontSize: "clamp(86px, 13vw, 170px)",
          fontWeight: "900",
          marginBottom: 34,
          lineHeight: 1,
          color: stop10HideTimer ? "white" : GOLD,
          textShadow: stop10HideTimer
            ? "0 0 40px rgba(255,255,255,0.65)"
            : "0 0 45px rgba(250,204,21,0.75)",
        }}
      >
        {stop10DisplayTime}
      </div>

      {/* LISTA GIOCATORI CHE HANNO STOPPATO */}
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          overflow: "hidden",
        }}
      >
        {currentStop10Results.length === 0 ? (
          <div
            style={{
              padding: "18px 24px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              textAlign: "center",
              fontSize: "clamp(22px, 2.4vw, 34px)",
              fontWeight: "bold",
              opacity: 0.9,
            }}
          >
            Nessuno ha ancora premuto STOP
          </div>
        ) : (
          currentStop10Results.slice(0, 8).map((p, i) => {
            const isLeader = i === 0;
            const stoppedSeconds = (Number(p.stopped_ms || 0) / 1000).toFixed(2);
            const diffSeconds = (Number(p.diff_ms || 0) / 1000).toFixed(2);

            return (
              <div
                key={p.id || p.player_id}
                className={`stop-entry ${isLeader ? "leader-highlight" : ""}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 18,
                  alignItems: "center",
                  padding: "14px 20px",
                  borderRadius: 16,
                  background: isLeader
                    ? "linear-gradient(90deg,#facc15,#eab308)"
                    : "rgba(255,255,255,0.06)",
                  color: isLeader ? "#000" : "#fff",
                  fontWeight: 800,
                  fontSize: "clamp(16px, 2vw, 25px)",
                  border: isLeader
                    ? "2px solid rgba(255,255,255,0.65)"
                    : "1px solid rgba(255,255,255,0.12)",
                  boxShadow: isLeader
                    ? "0 0 44px rgba(250,204,21,0.55)"
                    : "0 10px 24px rgba(0,0,0,0.20)",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {i + 1}. {p.player_name || "Giocatore"}
                </span>

                <span>{stoppedSeconds}s</span>

                <span
                  style={{
                    fontSize: "0.78em",
                    opacity: 0.82,
                  }}
                >
                  Δ {diffSeconds}s
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
)}

{/* =========================
   10.11 - Lobby TV
========================= */}

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

{/* =========================
   10.12 - Classifica provvisoria TV con reveal completo dall'ultimo al primo
========================= */}

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
      (() => {
        const sortedPlayers = [...players].sort((a, b) => {
          const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return (a.name || "").localeCompare(b.name || "", "it", { sensitivity: "base" });
        });

        const revealCount = Math.min(
          Math.max(leaderboardRevealCount || 0, 1),
          sortedPlayers.length
        );

        const startIndex = sortedPlayers.length - revealCount;
        const visiblePlayers = sortedPlayers.slice(startIndex);

        return (
          <div
            style={{
              height: "calc(100% - 100px)",
              maxWidth: 1000,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column-reverse",
              gap: 14,
              overflow: "hidden",
              justifyContent: "flex-start",
            }}
          >
            {visiblePlayers.map((p) => {
              const realIndex = sortedPlayers.findIndex((player) => player.id === p.id);
              const position = realIndex + 1;
              const isFinalWinner =
                position === 1 && revealCount >= sortedPlayers.length;

              return (
                <div
                  key={p.id}
                  style={{
                    ...panelStyle,
                    fontSize: position <= 3 ? 36 : 30,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 22px",
                    background:
                      position === 1
                        ? "rgba(255,215,64,0.24)"
                        : position === 2
                        ? "rgba(192,192,192,0.20)"
                        : position === 3
                        ? "rgba(205,127,50,0.20)"
                        : "rgba(255,255,255,0.07)",
                    border:
                      position === 1
                        ? "2px solid rgba(255,215,64,0.85)"
                        : position === 2
                        ? "2px solid rgba(229,231,235,0.45)"
                        : position === 3
                        ? "2px solid rgba(205,127,50,0.55)"
                        : "1px solid rgba(255,255,255,0.14)",
                    animation: isFinalWinner
                      ? "winnerGlow 1.4s infinite"
                      : "slideUp 0.55s ease",
                  }}
                >
                  <span>
                    {position === 1
                      ? "🥇"
                      : position === 2
                      ? "🥈"
                      : position === 3
                      ? "🥉"
                      : `#${position}`}{" "}
                    {p.name} {p.jolly_used ? "🃏" : ""}
                  </span>

                  <span style={{ color: GOLD, fontWeight: "bold" }}>
                    {p.score || 0} pt
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()
    )}
  </div>
)}

{/* =========================
   10.13 - Countdown TV
========================= */}

{!Boolean(game?.show_leaderboard) && effectivePhase === "countdown" && (
  <div
    style={{
      ...panelStyle,
      padding: "24px 28px",
      textAlign: "center",
      height: "100%",
      display: "grid",
      gridTemplateRows: "auto auto auto auto",
      alignContent: "center",
      gap: 22,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        fontSize: "clamp(34px, 3vw, 52px)",
        fontWeight: "bold",
        opacity: 0.95,
      }}
    >
      Preparati...
    </div>

    {currentQuestion && getTvMediaHint(currentQuestion) && (
      <div
        style={{
          width: "fit-content",
          maxWidth: "90%",
          margin: "0 auto",
          padding: "10px 24px",
          borderRadius: 999,
          background: "rgba(255,215,64,0.16)",
          border: "1px solid rgba(255,215,64,0.55)",
          color: GOLD,
          fontSize: "clamp(20px, 2vw, 34px)",
          fontWeight: "bold",
          boxShadow: "0 0 24px rgba(255,215,64,0.25)",
          textAlign: "center",
        }}
      >
        {getTvMediaHint(currentQuestion)}
      </div>
    )}

    <div
      style={{
        fontSize: "clamp(28px, 2.4vw, 38px)",
        opacity: 0.9,
      }}
    >
      Prossima domanda tra...
    </div>

    <div
      style={{
        fontSize: "clamp(72px, 9vw, 130px)",
        fontWeight: "bold",
        color: GOLD,
        lineHeight: 1,
        animation: "pulseTime 1s infinite",
      }}
    >
      {countdownTimeLeft}
    </div>
  </div>
)}

{/* =========================
   10.14 - Domanda TV
========================= */}

{!Boolean(game?.show_leaderboard) && effectivePhase === "question" && (
  <div
    style={{
      ...panelStyle,
      padding: "20px 24px",
      position: "relative",
      height: "100%",
      overflow: "hidden",
      display: "grid",
      gridTemplateRows: "auto auto auto auto minmax(0, 1fr)",
      gap: 10,
    }}
  >
    {!currentQuestion ? (
      <div
        style={{
          fontSize: 34,
          fontWeight: "bold",
          textAlign: "center",
          alignSelf: "center",
        }}
      >
        Caricamento domanda...
      </div>
    ) : (
      <>
        <div
          style={{
            fontSize: "clamp(32px, 4vw, 58px)",
            fontWeight: "bold",
            color: localTimeLeft <= 5 ? GOLD : "white",
            textAlign: "center",
            lineHeight: 1,
            animation:
              localTimeLeft <= 5 && localTimeLeft > 0
                ? "pulseTime 1s infinite"
                : "none",
          }}
        >
          ⏳ {localTimeLeft}
        </div>

        {getTvMediaHint(currentQuestion) && (
          <div
            style={{
              width: "fit-content",
              maxWidth: "90%",
              margin: "0 auto",
              padding: "8px 22px",
              borderRadius: 999,
              background: "rgba(255,215,64,0.16)",
              border: "1px solid rgba(255,215,64,0.55)",
              color: GOLD,
              fontSize: "clamp(18px, 1.8vw, 30px)",
              fontWeight: "bold",
              boxShadow: "0 0 24px rgba(255,215,64,0.20)",
              textAlign: "center",
            }}
          >
            {getTvMediaHint(currentQuestion)}
          </div>
        )}

        {renderTvQuestionMedia(currentQuestion, "question")}

        <h2
          style={{
            fontSize: "clamp(22px, 2.4vw, 36px)",
            lineHeight: 1.15,
            margin: 0,
            textAlign: "center",
            minHeight: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {currentQuestion.question}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridAutoRows: "minmax(0, 1fr)",
            gap: 12,
            width: "100%",
            maxWidth: 1120,
            margin: "0 auto",
            minHeight: 0,
            alignItems: "stretch",
          }}
        >
          <div style={{ ...getTvOptionStyle("A"), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            A - {currentQuestion.option_a}
          </div>

          <div style={{ ...getTvOptionStyle("B"), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            B - {currentQuestion.option_b}
          </div>

          {currentQuestion.option_c && (
            <div style={{ ...getTvOptionStyle("C"), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              C - {currentQuestion.option_c}
            </div>
          )}

          {currentQuestion.option_d && (
            <div style={{ ...getTvOptionStyle("D"), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              D - {currentQuestion.option_d}
            </div>
          )}
        </div>
      </>
    )}
  </div>
)}

{/* =========================
   10.15 - Statistiche risposte TV
========================= */}

{game?.phase === "stats" && !game?.show_leaderboard && (
  <div
    style={{
      ...panelStyle,
      padding: "20px 24px",
      height: "100%",
      display: "grid",
      gridTemplateRows:
        currentQuestion && jollyQuestionDetails.length > 0
          ? "auto auto auto auto minmax(0, 1fr)"
          : "auto auto auto minmax(0, 1fr)",
      gap: 12,
      overflow: "hidden",
      textAlign: "center",
      animation: "correctRevealGlow 0.35s ease",
    }}
  >
    {!currentQuestion ? (
      <div
        style={{
          fontSize: 34,
          fontWeight: "bold",
          color: GOLD,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        📊 Caricamento risultati...
      </div>
    ) : (
      <>
        {renderTvQuestionMedia(currentQuestion, "stats")}

        <h2
          style={{
            fontSize: "clamp(24px, 3vw, 42px)",
            margin: 0,
          }}
        >
          📊 Percentuali risposte
        </h2>

        <div
          style={{
            fontSize: "clamp(16px, 1.6vw, 24px)",
            color: GOLD,
          }}
        >
          {answerStats.totalAnswered} / {answerStats.totalPlayers} giocatori hanno risposto
        </div>

        {jollyQuestionDetails.length > 0 && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 18,
              background: "rgba(255,215,64,0.14)",
              border: "1px solid rgba(255,215,64,0.45)",
              color: "white",
              fontSize: "clamp(15px, 1.3vw, 21px)",
              fontWeight: "bold",
              lineHeight: 1.25,
              boxShadow: "0 0 24px rgba(255,215,64,0.22)",
            }}
          >
            {jollyQuestionDetails.map((jolly) => (
              <div key={jolly.playerId}>
                🃏 {jolly.playerName} ha usato il JOLLY:{" "}
                <span style={{ color: GOLD }}>{jolly.totalPoints} pt</span>{" "}
                (+{jolly.bonusPoints} bonus tempo da {jolly.sourceText})
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            width: "100%",
            maxWidth: 1120,
            margin: "0 auto",
            minHeight: 0,
            alignContent: "stretch",
          }}
        >
          {renderStatsBar("A", currentQuestion.option_a)}
          {renderStatsBar("B", currentQuestion.option_b)}
          {currentQuestion.option_c && renderStatsBar("C", currentQuestion.option_c)}
          {currentQuestion.option_d && renderStatsBar("D", currentQuestion.option_d)}
        </div>
      </>
    )}
  </div>
)}
{/* =========================
   10.16 - Reveal risposta corretta TV
========================= */}

{game?.phase === "reveal" && !game?.show_leaderboard && (
  <div
    style={{
      ...panelStyle,
      padding: "20px 24px",
      height: "100%",
      display: "grid",
      gridTemplateRows: "auto auto auto minmax(0, 1fr)",
      gap: 12,
      overflow: "hidden",
      textAlign: "center",
      animation: "correctRevealGlow 0.45s ease",
    }}
  >
    {!currentQuestion ? (
      <div
        style={{
          fontSize: 34,
          fontWeight: "bold",
          color: GOLD,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        ✅ Caricamento risposta...
      </div>
    ) : (
      <>
        {renderTvQuestionMedia(currentQuestion, "reveal")}

        <h2
          style={{
            fontSize: "clamp(26px, 3.2vw, 44px)",
            color: GREEN,
            margin: 0,
          }}
        >
          ✅ Risposta corretta: {currentQuestion.correct_answer}
        </h2>

        {currentQuestion.explanation ? (
          <p
            style={{
              fontSize: "clamp(16px, 1.6vw, 24px)",
              margin: 0,
              opacity: 0.96,
              lineHeight: 1.2,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {currentQuestion.explanation}
          </p>
        ) : (
          <div />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            width: "100%",
            maxWidth: 1120,
            margin: "0 auto",
            minHeight: 0,
            alignContent: "stretch",
          }}
        >
          <div style={{ ...getTvRevealOptionStyle("A", currentQuestion.correct_answer), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.12, overflow: "hidden", wordBreak: "break-word" }}>
            A - {currentQuestion.option_a}
          </div>

          <div style={{ ...getTvRevealOptionStyle("B", currentQuestion.correct_answer), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.12, overflow: "hidden", wordBreak: "break-word" }}>
            B - {currentQuestion.option_b}
          </div>

          {currentQuestion.option_c && (
            <div style={{ ...getTvRevealOptionStyle("C", currentQuestion.correct_answer), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.12, overflow: "hidden", wordBreak: "break-word" }}>
              C - {currentQuestion.option_c}
            </div>
          )}

          {currentQuestion.option_d && (
            <div style={{ ...getTvRevealOptionStyle("D", currentQuestion.correct_answer), fontSize: "clamp(18px, 1.7vw, 26px)", padding: "14px 16px", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.12, overflow: "hidden", wordBreak: "break-word" }}>
              D - {currentQuestion.option_d}
            </div>
          )}
        </div>
      </>
    )}
  </div>
)}


{/* =========================
   10.17 - Podio finale TV
========================= */}

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
          🥉 3° POSTO — {podiumPlayers[2].name} {podiumPlayers[2].jolly_used ? "🃏" : ""} — {podiumPlayers[2].score} punti
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
          🥈 2° POSTO — {podiumPlayers[1].name} {podiumPlayers[1].jolly_used ? "🃏" : ""} — {podiumPlayers[1].score} punti
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
          🥇 1° POSTO — {podiumPlayers[0].name} {podiumPlayers[0].jolly_used ? "🃏" : ""} — {podiumPlayers[0].score} punti
          <div style={{ fontSize: 56, marginTop: 16 }}>🎉 VINCITORE! 🎉</div>
        </div>
      )}

      {players.length === 0 && (
        <div
          style={{
            ...panelStyle,
            fontSize: 34,
            textAlign: "center",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          Nessun giocatore in classifica
        </div>
      )}
    </div>
  </div>
)}

      </div>
    </div>
  );
}

/* =====================================================
   PARTE 11 - SCHERMATA HOST + CONTROLLI
===================================================== */

if (role === "host") {
  return (
    <div
      style={{
        padding: 20,
        color: "white",
        background: "#020617",
        minHeight: "100vh",
        overflowY: "auto",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>
        🎤 HOST PANEL
      </h1>

      <div style={{ marginBottom: 20 }}>
        <strong>Fase:</strong> {effectivePhase}
      </div>

      <div style={{ marginBottom: 20 }}>
        <strong>Giocatori:</strong> {players.length}
      </div>

      {/* ===== CONTROLLI ===== */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>

        {/* ===== IMPORT CSV ===== */}
        <label
          style={{
            ...buttonStyle,
            cursor: "pointer",
            background: "linear-gradient(135deg,#2563eb,#1e3a8a)",
          }}
        >
          📁 Importa CSV
          <input
            type="file"
            accept=".csv"
            onChange={(e) => importCsvQuestions(e.target.files?.[0])}
            style={{ display: "none" }}
          />
        </label>

        {/* ===== AVVIO QUIZ ===== */}
        <button onClick={startQuiz} style={buttonStyle}>
          ▶️ Avvia Quiz
        </button>

        <button onClick={nextQuestion} style={buttonStyle}>
          ➡️ Prossima domanda
        </button>

        <button onClick={revealAnswer} style={buttonStyle}>
          💡 Mostra risposta
        </button>

        {/* ===== CLASSIFICA TV ===== */}
        <button onClick={toggleLeaderboardOnTv} style={buttonStyle}>
          🏆 Mostra / Nascondi classifica
        </button>

        {/* ===== STOP10 ===== */}
        <button
          onClick={startStop10Game}
          style={{
            ...buttonStyle,
            background: "linear-gradient(135deg,#f59e0b,#b45309)",
          }}
        >
          ⏱ Avvia Stop10
        </button>

        <button
          onClick={finishStop10Game}
          style={{
            ...buttonStyle,
            background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
          }}
        >
          🏆 Risultati Stop10
        </button>

        {/* ===== EXPORT CSV CLASSIFICA ===== */}
        <button
          onClick={downloadLeaderboardCsv}
          style={{
            ...buttonStyle,
            background: "linear-gradient(135deg,#06b6d4,#0e7490)",
          }}
        >
          📊 Esporta classifica CSV
        </button>

        {/* ===== RESET ===== */}
        <button
          onClick={resetAll}
          style={{
            ...buttonStyle,
            background: "linear-gradient(135deg,#ef4444,#7f1d1d)",
          }}
        >
          🔄 Reset completo
        </button>
      </div>

      {/* ===== STATUS ===== */}
      {status && (
        <div
          style={{
            marginTop: 20,
            padding: 10,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 10,
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}

}

