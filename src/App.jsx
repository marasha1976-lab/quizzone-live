/* =====================================================
    1 - IMPORT, CONFIPARTEGURAZIONE, COSTANTI E DATI DEMO
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

// TEMPO TECNICO PER FAR ARRIVARE REALTIME A TV/PLAYER
const SYNC_START_GRACE_MS = 1200;

// COUNTDOWN PRE-DOMANDA HOST -> QUESTION
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
const STOPZERO_BG = "/images/stopzero.png";
const STOPZERO_AUDIO = "/media/stop10_intro.mp3";
const STOPZERO_PLAYER_BG = "/images/stopzeroplayer.png";
const STOPZERO_TENSION_AUDIO = "/media/stop10_tension.mp3";
const STOPZERO_BUZZER_AUDIO = "/media/stop10_buzzer.mp3";
const FINAL_PODIUM_AUDIO = "/media/classificafinale.mp3";

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

  const questionStartMs = toMs(game.question_started_at_ms);
  const durationMs = Number(game.question_duration || COUNTDOWN_DURATION) * 1000;

  // FIX PLAYER:
  // se il countdown è finito ma Supabase non ha ancora aggiornato phase a "question",
  // calcoliamo già il tempo domanda.
  if (
    game.phase === "countdown" &&
    Number.isFinite(questionStartMs) &&
    durationMs > 0 &&
    nowMs >= questionStartMs
  ) {
    return Math.max(0, questionStartMs + durationMs - nowMs);
  }

  if (game.phase === "countdown") {
    const startMs = toMs(game.countdown_started_at_ms);

    if (!Number.isFinite(startMs) || !Number.isFinite(questionStartMs)) return 0;
    return Math.max(0, questionStartMs - nowMs);
  }

  if (game.phase === "question") {
    if (!Number.isFinite(questionStartMs) || durationMs <= 0) return 0;
    return Math.max(0, questionStartMs + durationMs - nowMs);
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

  const type = String(question.type || "").trim().toLowerCase();

  if (type === "audio" || question.audio_url) {
    return "🎧 ASCOLTA BENE";
  }

  if (type === "video" || question.youtube_url || question.video_url) {
    return "🎬 GUARDA IN TV";
  }

  if (type === "image" || question.image_url) {
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
      const questionStartedAtMs = toMs(startedAtMsValue);
      if (Number.isNaN(questionStartedAtMs)) return;

      activeRef.current = true;

      const QUESTION_AUDIO_SECONDS = COUNTDOWN_DURATION;
      const GONG_TAIL_SECONDS = 5;

      const duration = Number(durationSeconds || COUNTDOWN_DURATION);

      // FIX:
      // l'audio countdown deve partire solo negli ultimi 10 secondi della domanda.
      // Se la domanda dura 10 sec parte subito.
      // Se dura 15 sec parte dopo 5 sec.
      // Se dura 20 sec parte dopo 10 sec.
      // Se dura 25 sec parte dopo 15 sec.
      const audioStartDelaySeconds = Math.max(0, duration - QUESTION_AUDIO_SECONDS);
      const audioStartAtMs = questionStartedAtMs + audioStartDelaySeconds * 1000;

      const syncPlayback = () => {
        if (!activeRef.current) return;

        const nowMs = typeof nowProvider === "function" ? nowProvider() : Date.now();

        if (nowMs < audioStartAtMs) {
          return;
        }

        const elapsed = Math.max(0, (nowMs - audioStartAtMs) / 1000);

        const audioDuration =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : QUESTION_AUDIO_SECONDS + GONG_TAIL_SECONDS;

        const maxPlayableTime = Math.min(
          audioDuration,
          QUESTION_AUDIO_SECONDS + GONG_TAIL_SECONDS
        );

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
  const [mediaCheckReport, setMediaCheckReport] = useState([]);
  const [mediaCheckRunning, setMediaCheckRunning] = useState(false);
  const [liveCsvRow, setLiveCsvRow] = useState("");
  const [liveCsvPreview, setLiveCsvPreview] = useState(null);
  const [liveCsvError, setLiveCsvError] = useState("");
  const [liveCsvLoading, setLiveCsvLoading] = useState(false);

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
  const [stop10ExpiredFlash, setStop10ExpiredFlash] = useState(false);
  const [stop10Closing, setStop10Closing] = useState(false);

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

  const finalPodiumAudioRef = useRef(null);
  const finalPodiumAudioPlayedRef = useRef(false);

  const stop10TensionAudioRef = useRef(null);
  const stop10BuzzerAudioRef = useRef(null);
  const stop10TensionRoundRef = useRef(null);
  const stop10BuzzerRoundRef = useRef(null);

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

  const { unlockAudio, startSyncedCountdown, stopCountdownAudio } =
    useCountdownAudio(() => syncedNowRef.current);

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
        } catch {}

        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.muted = false;
        audioEl.removeAttribute("src");
        audioEl.load();
      }

      if (!stop10TensionAudioRef.current) {
        stop10TensionAudioRef.current = new Audio(STOPZERO_TENSION_AUDIO);
        stop10TensionAudioRef.current.preload = "auto";
        stop10TensionAudioRef.current.playsInline = true;
      }

      if (!stop10BuzzerAudioRef.current) {
        stop10BuzzerAudioRef.current = new Audio(STOPZERO_BUZZER_AUDIO);
        stop10BuzzerAudioRef.current.preload = "auto";
        stop10BuzzerAudioRef.current.playsInline = true;
      }

      if (!finalPodiumAudioRef.current) {
        finalPodiumAudioRef.current = new Audio(FINAL_PODIUM_AUDIO);
        finalPodiumAudioRef.current.preload = "auto";
        finalPodiumAudioRef.current.playsInline = true;
      }

      const tension = stop10TensionAudioRef.current;
      tension.pause();
      tension.currentTime = 0;
      tension.muted = true;

      try {
        await tension.play();
      } catch {}

      tension.pause();
      tension.currentTime = 0;
      tension.muted = false;

      const buzzer = stop10BuzzerAudioRef.current;
      buzzer.pause();
      buzzer.currentTime = 0;
      buzzer.muted = true;

      try {
        await buzzer.play();
      } catch {}

      buzzer.pause();
      buzzer.currentTime = 0;
      buzzer.muted = false;

      const finalAudio = finalPodiumAudioRef.current;
      finalAudio.pause();
      finalAudio.currentTime = 0;
      finalAudio.muted = true;

      try {
        await finalAudio.play();
      } catch {}

      finalAudio.pause();
      finalAudio.currentTime = 0;
      finalAudio.muted = false;

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

/* ===== FASE, TIMER DOMANDA E COUNTDOWN ===== */

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

const stop10WaitingToStart =
  effectivePhase === "stop10" &&
  Number.isFinite(stop10StartedAtMs) &&
  syncedNowMs < stop10StartedAtMs;

const stop10HideTimer = !stop10WaitingToStart && stop10ElapsedMs >= 5000;

const stop10DisplayTime = useMemo(() => {
  if (stop10WaitingToStart) return "10.0";
  if (stop10ElapsedMs >= 10000) return "TEMPO SCADUTO";
  if (stop10ElapsedMs >= 5000) return "???";

  const remaining = Math.max(0, 10 - stop10ElapsedMs / 1000);
  return remaining.toFixed(2);
}, [stop10ElapsedMs, stop10WaitingToStart]);

const stop10IsRunning =
  effectivePhase === "stop10" &&
  !stop10WaitingToStart &&
  stop10ElapsedMs < 10000;

const stop10IsFinished =
  effectivePhase === "stop10_results" ||
  (!stop10WaitingToStart && stop10ElapsedMs >= 10000);

/* ===== HOST TIMER ===== */

const hostDisplayedTime = useMemo(() => {
  if (effectivePhase === "countdown") return countdownTimeLeft;
  if (effectivePhase === "question") return localTimeLeft;

  if (effectivePhase === "stop10") {
    return Math.max(0, Math.ceil((10000 - stop10ElapsedMs) / 1000));
  }

  return 0;
}, [effectivePhase, countdownTimeLeft, localTimeLeft, stop10ElapsedMs]);

/* AUDIO TENSIONE STOP ZERO - SOLO TV */

useEffect(() => {
  if (role !== "tv") return;
  if (effectivePhase !== "stop10") return;
  if (stop10WaitingToStart) return;
  if (!stop10RoundId) return;

  if (stop10TensionRoundRef.current === stop10RoundId) return;

  stop10TensionRoundRef.current = stop10RoundId;

  try {
    if (!stop10TensionAudioRef.current) {
      stop10TensionAudioRef.current = new Audio(STOPZERO_TENSION_AUDIO);
      stop10TensionAudioRef.current.preload = "auto";
      stop10TensionAudioRef.current.playsInline = true;
    }

    const audio = stop10TensionAudioRef.current;
    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}, [
  role,
  effectivePhase,
  stop10WaitingToStart,
  stop10RoundId,
]);

/* BUZZER TEMPO SCADUTO STOP ZERO - SOLO TV */

useEffect(() => {
  if (role !== "tv") return;
  if (effectivePhase !== "stop10") return;
  if (stop10WaitingToStart) return;
  if (!stop10RoundId) return;
  if (stop10ElapsedMs < 10000) return;

  if (stop10BuzzerRoundRef.current === stop10RoundId) return;

  stop10BuzzerRoundRef.current = stop10RoundId;

  try {
    if (stop10TensionAudioRef.current) {
      stop10TensionAudioRef.current.pause();
      stop10TensionAudioRef.current.currentTime = 0;
    }

    if (!stop10BuzzerAudioRef.current) {
      stop10BuzzerAudioRef.current = new Audio(STOPZERO_BUZZER_AUDIO);
      stop10BuzzerAudioRef.current.preload = "auto";
      stop10BuzzerAudioRef.current.playsInline = true;
    }

    const buzzer = stop10BuzzerAudioRef.current;
    buzzer.pause();
    buzzer.currentTime = 0;
    buzzer.play().catch(() => {});
  } catch {
    // ignore
  }
}, [
  role,
  effectivePhase,
  stop10WaitingToStart,
  stop10RoundId,
  stop10ElapsedMs,
]);

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
    5PARTEA - CARICAMENTO DATI BASE
===================================================== */

function normalizeQuestionTime(question) {
  const type = String(question?.type || "multiple").trim().toLowerCase();

  if (type === "audio" || type === "video") return 20;

  return 10;
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
    time_limit: normalizeQuestionTime(q),
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("questions")
    .insert(rows)
    .select();

  if (insertError) throw insertError;

  return (inserted || []).sort((a, b) => a.position - b.position);
}

async function addLiveEvent(
  gameId,
  eventType,
  eventText,
  extraData = {}
) {
  if (!gameId) return;

  const payload = {
    game_id: gameId,
    event_type: eventType,
    event_text: eventText,
    ...extraData,
  };

  const { error } = await supabase
    .from("live_events")
    .insert([payload]);

  if (error) {
    console.error("Errore live event:", error);
  }
}

async function loadGameOnly() {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("code", GAME_CODE)
    .single();

  if (error) throw error;

  setGame(data);
  return data;
}

async function loadQuestionsOnly(gameId) {
  if (!gameId) return [];

  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("game_id", gameId)
    .order("position");

  if (error) throw error;

  const normalized = (data || []).map((q) => ({
    ...q,
    time_limit: normalizeQuestionTime(q),
  }));

  setQuestions(normalized);

  return normalized;
}

async function loadPlayersOnly(gameId) {
  if (!gameId) return [];

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("game_id", gameId);

  if (error) throw error;

  const sortedPlayers = sortPlayers(data || []);

  setPlayers(sortedPlayers);

if (role === "player" && joinedPlayer?.id) {
  const updatedJoined = sortedPlayers.find(
    (p) => p.id === joinedPlayer.id
  );

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
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
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
   PARTE 5B - IMPORT CSV, NORMALIZZAZIONE E CONTROLLO MEDIA
===================================================== */

async function checkCsvMediaLinks(rows) {
  const TIMEOUT_MS = 8000;

  const withTimeout = (promise, type, url) => {
    return Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            type,
            url,
            status: "warning",
            message:
              "Controllo scaduto: potrebbe funzionare, ma il server risponde lento",
          });
        }, TIMEOUT_MS);
      }),
    ]);
  };

  const checkImage = (url) => {
    return withTimeout(
      new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
          resolve({
            type: "image",
            url,
            status: "ok",
            message: "Immagine caricabile",
          });
        };

        img.onerror = () => {
          resolve({
            type: "image",
            url,
            status: "error",
            message: "Immagine non caricabile",
          });
        };

        img.src = url;
      }),
      "image",
      url
    );
  };

  const checkAudio = (url) => {
    return withTimeout(
      new Promise((resolve) => {
        const audio = document.createElement("audio");

        audio.preload = "metadata";
        audio.muted = true;

        audio.onloadedmetadata = () => {
          resolve({
            type: "audio",
            url,
            status: "ok",
            message: "Audio caricabile dal browser",
          });
        };

        audio.oncanplay = () => {
          resolve({
            type: "audio",
            url,
            status: "ok",
            message: "Audio riproducibile dal browser",
          });
        };

        audio.onerror = () => {
          resolve({
            type: "audio",
            url,
            status: "error",
            message: "Audio non caricabile",
          });
        };

        audio.src = url;
        audio.load();
      }),
      "audio",
      url
    );
  };

  const checkVideo = (url) => {
    return withTimeout(
      new Promise((resolve) => {
        const video = document.createElement("video");

        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
          resolve({
            type: "video",
            url,
            status: "ok",
            message: "Video diretto caricabile dal browser",
          });
        };

        video.oncanplay = () => {
          resolve({
            type: "video",
            url,
            status: "ok",
            message: "Video diretto riproducibile dal browser",
          });
        };

        video.onerror = () => {
          resolve({
            type: "video",
            url,
            status: "error",
            message:
              "Video non caricabile. Se è YouTube, va messo in youtube_url, non in video_url",
          });
        };

        video.src = url;
        video.load();
      }),
      "video",
      url
    );
  };

  const getYoutubeId = (url) => {
    try {
      const parsed = new URL(String(url).trim());

      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "").split("?")[0];
      }

      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname.startsWith("/watch")) {
          return parsed.searchParams.get("v") || "";
        }

        if (parsed.pathname.startsWith("/shorts/")) {
          return (
            parsed.pathname
              .split("/shorts/")[1]
              ?.split("/")[0] || ""
          );
        }

        if (parsed.pathname.startsWith("/embed/")) {
          return (
            parsed.pathname
              .split("/embed/")[1]
              ?.split("/")[0] || ""
          );
        }
      }

      return "";
    } catch {
      return "";
    }
  };

  const checkYoutube = (url) => {
    return withTimeout(
      new Promise((resolve) => {
        const videoId = getYoutubeId(url);

        if (!videoId) {
          resolve({
            type: "youtube",
            url,
            status: "error",
            message: "Link YouTube non valido",
          });

          return;
        }

        const img = new Image();

        img.onload = () => {
          resolve({
            type: "youtube",
            url,
            status: "ok",
            message:
              "Video YouTube trovato. Embed da verificare in TV",
          });
        };

        img.onerror = () => {
          resolve({
            type: "youtube",
            url,
            status: "warning",
            message:
              "ID YouTube valido, ma thumbnail non verificata",
          });
        };

        img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }),
      "youtube",
      url
    );
  };

  const report = [];

  for (const row of rows) {
    const checks = [];

    if (row.image_url) checks.push(checkImage(row.image_url));
    if (row.audio_url) checks.push(checkAudio(row.audio_url));
    if (row.video_url) checks.push(checkVideo(row.video_url));
    if (row.youtube_url) checks.push(checkYoutube(row.youtube_url));

    const results = await Promise.all(checks);

    results.filter(Boolean).forEach((check) => {
      report.push({
        position: row.position,
        question: row.question,
        ...check,
      });
    });
  }

  return report;
}

function normalizeCsvRows(rows) {
  return rows
    .filter((row) => row.question && row.correct_answer)
    .map((row, index) => {
      const type = String(
        row.type || "multiple"
      )
        .trim()
        .toLowerCase();

      const cleanedType =
        type === "truefalse" || type === "vero_falso"
          ? "truefalse"
          : ["multiple", "image", "audio", "video"].includes(type)
          ? type
          : "multiple";

      return {
        position: index,
        round: Number(row.round || 1),
        type: cleanedType,

        question: String(
          row.question || ""
        ).trim(),

        option_a:
          cleanedType === "truefalse"
            ? String(row.option_a || "Vero").trim() || "Vero"
            : String(row.option_a || "").trim(),

        option_b:
          cleanedType === "truefalse"
            ? String(row.option_b || "Falso").trim() || "Falso"
            : String(row.option_b || "").trim(),

        option_c:
          cleanedType === "truefalse"
            ? null
            : String(row.option_c || "").trim() || null,

        option_d:
          cleanedType === "truefalse"
            ? null
            : String(row.option_d || "").trim() || null,

        correct_answer: String(
          row.correct_answer || ""
        )
          .trim()
          .toUpperCase(),

        explanation: String(
          row.explanation || ""
        ).trim(),

time_limit:
  cleanedType === "audio" || cleanedType === "video"
    ? 20
    : 10,
                        
        points: Number(row.points || 100),

        image_url: String(
          row.image_url || ""
        ).trim(),

        audio_url: String(
          row.audio_url || ""
        ).trim(),

        video_url: String(
          row.video_url || ""
        ).trim(),

        youtube_url: String(
          row.youtube_url || ""
        ).trim(),
      };
    });
}

function parseSingleLiveCsvRow(
  csvText,
  currentQuestionsLength = 0
) {
  const text = String(csvText || "").trim();

  if (!text) {
    throw new Error("Incolla una riga CSV.");
  }

  const hasHeader = text
    .split(/\r?\n/)[0]
    .toLowerCase()
    .includes("question");

  const csvWithHeader = hasHeader
    ? text
    : `position,round,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,time_limit,points,image_url,audio_url,video_url,youtube_url
${text}`;

  const parsed = Papa.parse(csvWithHeader, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    throw new Error(
      "CSV non valido: controlla virgole, virgolette e colonne."
    );
  }

  const rows = normalizeCsvRows(parsed.data || []);

  if (!rows.length) {
    throw new Error(
      "Nessuna domanda valida trovata nella riga CSV."
    );
  }

  if (rows.length > 1) {
    throw new Error(
      "Incolla una sola domanda alla volta."
    );
  }

  return {
    ...rows[0],
    position: currentQuestionsLength,
  };
}

async function addLiveCsvQuestion() {
  try {
    setLiveCsvError("");

    if (!liveCsvRow.trim()) {
      setLiveCsvError("Incolla una riga CSV.");
      return;
    }

    if (!game?.id) {
      setLiveCsvError("Game non caricato.");
      return;
    }

    setLiveCsvLoading(true);

    const parsedQuestion = parseSingleLiveCsvRow(
      liveCsvRow,
      questions.length
    );

    const questionToInsert = {
      ...parsedQuestion,
      game_id: game.id,
      position: questions.length,
    };

    const { error } = await supabase
      .from("questions")
      .insert([questionToInsert]);

    if (error) throw error;

    await loadAll();

    setLiveCsvRow("");
    setLiveCsvError("");

    setStatus(
      "Domanda CSV live aggiunta in fondo al quiz."
    );
  } catch (err) {
    console.error(err);

    setLiveCsvError(
      err?.message ||
        "Errore aggiunta domanda CSV live."
    );
  } finally {
    setLiveCsvLoading(false);
  }
}

async function importCsvQuestions(file) {
  if (!file || !game) return;

  setStatus("Import CSV in corso...");
  setMediaCheckRunning(false);
  setMediaCheckReport([]);

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,

    complete: async (results) => {
      try {
        const parsedRows = normalizeCsvRows(
          results.data || []
        );

        if (!parsedRows.length) {
          setStatus("CSV vuoto o non valido");
          return;
        }

        setMediaCheckRunning(true);

        const mediaReport =
          await checkCsvMediaLinks(parsedRows);

        setMediaCheckReport(mediaReport);

        setMediaCheckRunning(false);

        await supabase
          .from("answers")
          .delete()
          .eq("game_id", game.id);

        await supabase
          .from("questions")
          .delete()
          .eq("game_id", game.id);

        const rowsToInsert = parsedRows.map(
          (row) => ({
            game_id: game.id,
            ...row,
          })
        );

        const { error } = await supabase
          .from("questions")
          .insert(rowsToInsert);

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

        setStatus(
          `Import completato: ${parsedRows.length} domande`
        );
      } catch (error) {
        console.error(error);

        setMediaCheckRunning(false);

        setStatus(
          "Errore import CSV: " + error.message
        );
      }
    },

    error: () => {
      setMediaCheckRunning(false);
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
        setStatus("Nomevgià presente, scegline un altro");
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

      const countdownStartedAtMs = Math.round(
  syncedNowRef.current + SYNC_START_GRACE_MS
);

const questionStartedAtMs =
  countdownStartedAtMs + QUESTION_START_DELAY_MS;

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
      const countdownStartedAtMs = Math.round(
  syncedNowRef.current + SYNC_START_GRACE_MS
);

const questionStartedAtMs =
  countdownStartedAtMs + QUESTION_START_DELAY_MS;
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
setMediaCheckReport([]);
setMediaCheckRunning(false);

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

  const INTRO_DURATION_MS = 25000;

  try {
    setStatus("Intro Stop Zero avviata");

    await supabase
      .from("stop10_results")
      .delete()
      .eq("game_id", game.id);

    const { data, error } = await supabase
      .from("games")
      .update({
        phase: "stop10_intro",
        stop10_round_id: null,
        stop10_started_at_ms: null,
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
      "stop10_intro",
      "🎙️ INTRO MINIGIOCO STOP ZERO!"
    );

    setGame(data);
    setStop10Results([]);
    setStop10PlayerStopped(false);
    setStop10PlayerResult(null);
    setStop10ExpiredFlash(false);

    stop10LockRef.current = false;
    stop10TensionRoundRef.current = null;
    stop10BuzzerRoundRef.current = null;

    try {
      if (stop10TensionAudioRef.current) {
        stop10TensionAudioRef.current.pause();
        stop10TensionAudioRef.current.currentTime = 0;
      }

      if (stop10BuzzerAudioRef.current) {
        stop10BuzzerAudioRef.current.pause();
        stop10BuzzerAudioRef.current.currentTime = 0;
      }
    } catch {
      // ignore
    }

    window.setTimeout(async () => {
      const roundId = Date.now();

      const startedAtMs = Math.round(
        syncedNowRef.current + SYNC_START_GRACE_MS
      );

      try {
        const { data: startedGame, error: startError } = await supabase
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

        if (startError) throw startError;

        await addLiveEvent(
          game.id,
          "stop10_start",
          "⏱️ PARTITO IL MINIGIOCO STOP ZERO!"
        );

        setGame(startedGame);
        setStatus("Stop Zero avviato");
      } catch (startError) {
        console.error(startError);
        setStatus("Errore avvio Stop Zero: " + startError.message);
      }
    }, INTRO_DURATION_MS);

  } catch (error) {
    console.error(error);
    setStatus("Errore intro Stop Zero: " + error.message);
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
  if (stop10Closing) return;

  const activeStop10RoundId = game?.stop10_round_id || stop10RoundId;

  if (!activeStop10RoundId) {
    setStatus("Nessuno Stop Zero attivo");
    return;
  }

  try {
    setStop10Closing(true);
    setStatus("Calcolo punteggi Stop Zero in corso...");

    const { data: freshGame, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", game.id)
      .single();

    if (gameError) throw gameError;

    if (freshGame.phase !== "stop10") {
      setStatus("Lo Stop Zero non è in corso oppure è già stato chiuso");
      return;
    }

    const [{ data: resultsData, error: resultsError }, { data: playersData, error: playersError }] =
      await Promise.all([
        supabase
          .from("stop10_results")
          .select("*")
          .eq("game_id", game.id)
          .eq("round_id", activeStop10RoundId),

        supabase
          .from("players")
          .select("id, score")
          .eq("game_id", game.id),
      ]);

    if (resultsError) throw resultsError;
    if (playersError) throw playersError;

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

    const playersById = new Map(
      (playersData || []).map((player) => [player.id, player])
    );

    const updates = validResults
      .map((result, index) => {
        const diffMs = Number(result.diff_ms || 0);

        let points;

        if (index === 0) points = 200;
        else if (index === 1) points = 150;
        else if (index === 2) points = 100;
        else if (index === 3) points = 50;
        else if (index === 4) points = 30;
        else {
          points = Math.max(
            5,
            Math.round(30 - (diffMs / 10000) * 25)
          );
        }

        const player = playersById.get(result.player_id);
        if (!player) return null;

        const newScore = Number(player.score || 0) + points;

        return {
          resultId: result.id,
          playerId: result.player_id,
          points,
          newScore,
        };
      })
      .filter(Boolean);

    await Promise.all([
      ...updates.map((item) =>
        supabase
          .from("players")
          .update({ score: item.newScore })
          .eq("id", item.playerId)
      ),

      ...updates.map((item) =>
        supabase
          .from("stop10_results")
          .update({ score_awarded: item.points })
          .eq("id", item.resultId)
      ),
    ]);

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
      `🏆 Stop Zero concluso! Assegnati punti a ${updates.length} giocatori`
    );

    setGame(updatedGame);

    await Promise.all([
      loadPlayersOnly(game.id),
      loadStop10ResultsOnly(game.id),
      loadEventsOnly(game.id),
    ]);

    setStatus(
      updates.length > 0
        ? "Stop Zero concluso: punti assegnati"
        : "Stop Zero chiuso: nessun risultato valido"
    );
  } catch (error) {
    console.error(error);
    setStatus("Errore chiusura Stop Zero: " + error.message);
  } finally {
    setStop10Closing(false);
  }
}

  
  /* =========================
     6.13 - Elimina singola domanda e riordina
  ========================= */

  async function deleteQuestionFromQuiz(questionId) {
    if (!game?.id || !questionId) return;

    const ok = window.confirm(
      "Vuoi eliminare questa domanda dal quiz? Verranno eliminate anche le risposte collegate."
    );

    if (!ok) return;

    try {
      const remainingQuestions = [...questions]
        .filter((q) => q.id !== questionId)
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));

      await supabase.from("answers").delete().eq("question_id", questionId);
      await supabase.from("questions").delete().eq("id", questionId);

      for (let index = 0; index < remainingQuestions.length; index += 1) {
        await supabase
          .from("questions")
          .update({ position: index })
          .eq("id", remainingQuestions[index].id);
      }

      const safeCurrentIndex = Math.min(
        Number(game.current_question_index || 0),
        Math.max(0, remainingQuestions.length - 1)
      );

      await supabase
        .from("games")
        .update({
          current_question_index: safeCurrentIndex,
          phase: remainingQuestions.length === 0 ? "lobby" : game.phase,
        })
        .eq("id", game.id);

      await addLiveEvent(game.id, "question_deleted", "🗑️ Domanda eliminata dal quiz");

      await loadAll({ silent: true });
      setStatus("Domanda eliminata e quiz riordinato");
    } catch (error) {
      console.error(error);
      setStatus("Errore eliminazione domanda: " + error.message);
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
   7.6B - Reset stato player Stop10 su nuovo round
========================= */

useEffect(() => {
  if (role !== "player") return;

  setStop10PlayerStopped(false);
  setStop10PlayerResult(null);
  stop10LockRef.current = false;
}, [role, stop10RoundId]);

/* =========================
   7.6C - Aggiorna punti player dopo Stop10
========================= */

useEffect(() => {
  if (role !== "player") return;
  if (!game?.id) return;
  if (!joinedPlayer?.id) return;
  if (effectivePhase !== "stop10_results") return;

  let cancelled = false;

  (async () => {
    try {
      const updatedPlayers = await loadPlayersOnly(game.id);

      const updatedMe = updatedPlayers.find(
        (p) => p.id === joinedPlayer.id
      );

      if (!cancelled && updatedMe) {
        setJoinedPlayer(updatedMe);
      }

      const { data, error } = await supabase
        .from("stop10_results")
        .select("*")
        .eq("game_id", game.id)
        .eq("player_id", joinedPlayer.id)
        .eq("round_id", game.stop10_round_id)
        .maybeSingle();

      if (error) throw error;

      if (!cancelled && data) {
        setStop10PlayerResult(data);
        setStop10PlayerStopped(true);
      }
    } catch (error) {
      console.error("Errore aggiornamento player Stop10:", error);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [
  role,
  game?.id,
  game?.stop10_round_id,
  effectivePhase,
  joinedPlayer?.id,
]);

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
   7.17 - Animazione podio finale + musica finale
========================= */

useEffect(() => {
  if (game?.phase !== "final") {
    setFinalRevealIndex(-1);

    if (finalPodiumAudioRef.current) {
      finalPodiumAudioRef.current.pause();
      finalPodiumAudioRef.current.currentTime = 0;
    }

    finalPodiumAudioPlayedRef.current = false;
    return;
  }

  setFinalRevealIndex(-1);

  if (
    role === "tv" &&
    finalPodiumAudioRef.current &&
    !finalPodiumAudioPlayedRef.current
  ) {
    finalPodiumAudioPlayedRef.current = true;

    const audio = finalPodiumAudioRef.current;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;

    audio.play().catch((err) => {
      console.warn("Errore audio finale:", err);
    });
  }

  const t1 = setTimeout(() => setFinalRevealIndex(5), 1000);
  const t2 = setTimeout(() => setFinalRevealIndex(4), 2800);
  const t3 = setTimeout(() => setFinalRevealIndex(3), 4600);
  const t4 = setTimeout(() => setFinalRevealIndex(2), 7600);
  const t5 = setTimeout(() => setFinalRevealIndex(1), 10500);

  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
    clearTimeout(t3);
    clearTimeout(t4);
    clearTimeout(t5);
  };
}, [game?.phase, role]);


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

  const instantPlayers = Math.max(0, totalPlayers - 5);

  setLeaderboardRevealCount(instantPlayers);

  const interval = setInterval(() => {
    setLeaderboardRevealCount((current) => {
      if (current >= totalPlayers) {
        clearInterval(interval);
        return current;
      }

      return current + 1;
    });
  }, 2500);

  return () => clearInterval(interval);
}, [role, game?.show_leaderboard, game?.phase, players.length]);


/* =========================
   7.18 - AUTOSCALE PLAYER DISATTIVATO
========================= */

useEffect(() => {
  if (role !== "player") return;

  // disattiviamo completamente l’autoscale dinamico
  setPlayerQuestionScale(1);
  setPlayerQuestionFitReady(true);

}, [
  role,
  effectivePhase,
  currentQuestion?.id
]);

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

/* ===== STILI TV RESPONSIVE / ADATTIVI ===== */

const tvScrollBoxStyle = {
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 8,
  scrollbarWidth: "thin",
};

const tvFullScreenPanelStyle = {
  ...panelStyle,
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const tvAdaptiveTitleStyle = {
  fontSize: "clamp(34px, 4.2vw, 56px)",
  marginBottom: 18,
  textAlign: "center",
  flexShrink: 0,
};

const tvAdaptiveRowTextStyle = {
  fontSize: "clamp(18px, 2.2vw, 32px)",
  lineHeight: 1.15,
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
  const hasVideo = Boolean(question.video_url);
  const hasYouTube = Boolean(question.youtube_url);

  if (!hasImage && !hasAudio && !hasVideo && !hasYouTube) return null;

  const getYouTubeEmbedUrl = (url) => {
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
          videoId =
            parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
        } else if (parsed.pathname.startsWith("/embed/")) {
          videoId =
            parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        }
      }

      if (!videoId) return "";

      const startRaw =
        parsed.searchParams.get("start") ||
        parsed.searchParams.get("t") ||
        "";

      const start = String(startRaw).replace("s", "").trim();

      // DEFAULT: tutti i media YouTube partono da 4 secondi
      const effectiveStart = /^\d+$/.test(start) ? start : "4";

      const params = new URLSearchParams({
        controls: "1",
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
      });

      if (mode === "tv") {
        params.set("autoplay", "1");
      }

      params.set("start", effectiveStart);

      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    } catch {
      return "";
    }
  };

  const youtubeEmbedUrl = getYouTubeEmbedUrl(question.youtube_url);

  const imageMaxHeight =
    mode === "tv" ? "26vh" : mode === "host" ? "180px" : "22dvh";

  const videoHeight =
    mode === "tv" ? "30vh" : mode === "host" ? "220px" : "22dvh";

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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={question.image_url}
            alt="Immagine domanda"
            style={{
              display: "block",
              maxWidth: "100%",
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

      {hasAudio && (
        <div style={questionAudioBoxStyle}>
          <div style={{ fontWeight: "bold", marginBottom: 10 }}>
            🔊 Audio domanda
          </div>
          <audio
            src={question.audio_url}
            controls
            style={{ width: "100%" }}
          />
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
            placeholder="Nome giocatore o squadra"
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
  <div
    style={{
      ...panelStyle,
      minHeight: "72vh",
      textAlign: "center",
      backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.72)), url(${STOPZERO_PLAYER_BG})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      border: "1px solid rgba(255,255,255,0.22)",
      boxShadow: "0 0 30px rgba(239,68,68,0.35)",
    }}
  >
    <h2 style={{ fontSize: 34, marginBottom: 10 }}>
      ⏱️ STOP ZERO
    </h2>

    <p style={{ fontSize: 17, opacity: 0.95, marginBottom: 18 }}>
      Premi STOP il più vicino possibile allo zero.
      <br />
      A 5 secondi il timer sparisce.
    </p>

    {stop10WaitingToStart ? (
      <div style={{ fontSize: 38, fontWeight: "bold", color: GOLD, marginBottom: 22 }}>
        Preparati...
      </div>
    ) : !stop10HideTimer ? (
      <div
        style={{
          fontSize: 74,
          fontWeight: 900,
          fontFamily: "'Orbitron', monospace",
          color: "#dbeafe",
          marginBottom: 22,
          textShadow: "0 0 15px #fff, 0 0 35px #60a5fa",
        }}
      >
        {stop10DisplayTime}
      </div>
    ) : (
      <div style={{ fontSize: 34, fontWeight: "bold", color: GOLD, marginBottom: 22 }}>
        TIMER NASCOSTO
      </div>
    )}

    {myStop10Result || stop10PlayerResult ? (
      <div
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(34,197,94,0.20)",
          border: "1px solid rgba(34,197,94,0.55)",
          fontWeight: "bold",
          fontSize: 22,
          backdropFilter: "blur(6px)",
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
    ) : stop10IsFinished ? (
      <div
        style={{
          padding: 18,
          borderRadius: 18,
          background: "rgba(239,68,68,0.20)",
          border: "1px solid rgba(239,68,68,0.55)",
          fontWeight: "bold",
          fontSize: 22,
          backdropFilter: "blur(6px)",
        }}
      >
        ⛔ Tempo scaduto
      </div>
    ) : (
      <button
        onClick={stop10SubmitStop}
        disabled={
          stop10WaitingToStart ||
          stop10PlayerStopped ||
          stop10LockRef.current
        }
        style={{
          ...buttonStyle,
          width: "100%",
          maxWidth: 360,
          fontSize: 34,
          padding: "24px 28px",
          opacity: stop10WaitingToStart ? 0.45 : 1,
          background: "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
          border: "2px solid rgba(255,255,255,0.35)",
          boxShadow: "0 0 30px rgba(239,68,68,0.75)",
        }}
      >
        {stop10WaitingToStart ? "ASPETTA..." : "STOP"}
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
      overflowY: "auto",
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
        boxSizing: "border-box",
      }}
    >
      {/* TIMER */}
      <div style={{ fontSize: 18, marginBottom: 8 }}>
        ⏱ {Math.max(0, localTimeLeft)}s
      </div>

      {/* JOLLY */}
      {!jollyUsed && localTimeLeft > 0 && !selectedAnswer && (
        <button
          onClick={useJollyCard}
          style={{
            ...buttonStyle,
            marginBottom: 8,
            padding: "8px 12px",
            fontSize: 14,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          }}
        >
          🃏 USA JOLLY
        </button>
      )}

      {jollyUsed && (
        <div
          style={{
            color: GOLD,
            fontWeight: "bold",
            marginBottom: 8,
            fontSize: 14,
          }}
        >
          🃏 JOLLY già usato
        </div>
      )}

      {/* DOMANDA */}
      <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
        {currentQuestion.question}
      </div>

      {/* IMMAGINE (ADATTIVA) */}
      {currentQuestion.image_url && (
        <div
          style={{
            width: "100%",
            maxHeight: "22dvh",
            marginBottom: 8,
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
              maxHeight: "22dvh",
              objectFit: "contain",
              borderRadius: 10,
            }}
          />
        </div>
      )}

      {/* RISPOSTE */}
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
        videoId =
          parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId =
          parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
      }
    }

    if (!videoId) return "";

    const startRaw =
      parsed.searchParams.get("start") ||
      parsed.searchParams.get("t") ||
      "";

    const start = String(startRaw).replace("s", "").trim();

    // DEFAULT: tutti i media YouTube partono da 4 secondi
    const effectiveStart = /^\d+$/.test(start) ? start : "4";

    const params = new URLSearchParams({
      autoplay: "1",
      controls: "0",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      fs: "0",
      disablekb: "1",
      iv_load_policy: "3",
    });

    params.set("start", effectiveStart);

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

  const type = String(question.type || "").trim().toLowerCase();

  if (type === "audio" || question.audio_url) {
    return "🎧 ASCOLTA BENE";
  }

  if (type === "video" || question.youtube_url || question.video_url) {
    return "🎬 GUARDA ATTENTAMENTE";
  }

  if (type === "image" || question.image_url) {
    return "🖼️ GUARDA ATTENTAMENTE";
  }

  return "";
};
  
/* =========================
   10.3 - Render media domanda TV
========================= */

const renderTvQuestionMedia = (question, variant = "question") => {
  if (!question) return null;

  const isAudioQuestion =
    String(question.type || "").trim().toLowerCase() === "audio";

  const hasImage = Boolean(question.image_url) && variant !== "countdown";
  const hasAudio = Boolean(question.audio_url) && variant !== "countdown";
  const hasVideo = Boolean(question.video_url) && variant === "question";

  const hasYouTube =
    Boolean(question.youtube_url) &&
    variant === "question" &&
    !isAudioQuestion;

  const hasYouTubeAudio =
    Boolean(question.youtube_url) &&
    variant === "question" &&
    isAudioQuestion;

  const youtubeEmbedUrl = getTvYouTubeEmbedUrl(question.youtube_url);

  if (!hasImage && !hasAudio && !hasVideo && !hasYouTube && !hasYouTubeAudio) {
    return null;
  }

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

      {hasYouTubeAudio && youtubeEmbedUrl && (
        <div
          style={{
            width: "100%",
            minHeight: videoHeight,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.16)",
            background:
              "radial-gradient(circle at center, rgba(124,58,237,0.35) 0%, rgba(15,23,42,0.95) 58%, #000 100%)",
            boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <iframe
            src={youtubeEmbedUrl}
            title="Audio YouTube domanda"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
              border: "none",
            }}
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              textAlign: "center",
              padding: "18px 24px",
            }}
          >
            <div
              style={{
                fontSize: "clamp(42px, 5vw, 76px)",
                marginBottom: 10,
                animation: "pulseTime 1s infinite",
              }}
            >
              🎧
            </div>

            <div
              style={{
                fontSize: "clamp(24px, 2.4vw, 40px)",
                fontWeight: "bold",
                color: GOLD,
                textShadow: "0 0 22px rgba(250,204,21,0.35)",
              }}
            >
              AUDIO IN RIPRODUZIONE
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: "clamp(15px, 1.3vw, 22px)",
                opacity: 0.88,
              }}
            >
              Ascolta bene e rispondi dal telefono
            </div>
          </div>
        </div>
      )}

      {hasYouTube && youtubeEmbedUrl && (
        <div
          style={{
            width: "100%",
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.16)",
            background: "black",
            boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
            position: "relative",
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
            allowFullScreen={false}
          />

          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 54,
              background: "black",
              zIndex: 5,
              pointerEvents: "none",
            }}
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

      {hasAudio && !hasVideo && !hasYouTube && !hasYouTubeAudio && (
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
   10.8 - TV STOP10 RISULTATI
========================= */}

{effectivePhase === "stop10_results" && !game?.show_leaderboard && (
  <div
    style={{
      ...tvFullScreenPanelStyle,
      justifyContent: "flex-start",
      padding: "clamp(18px, 3vw, 40px)",
      boxSizing: "border-box",
      textAlign: "center",
      gap: 18,
    }}
  >
    <h2 style={tvAdaptiveTitleStyle}>
      ⏱️ RISULTATI STOP ZERO
    </h2>

    {currentStop10Results.length === 0 ? (
      <div
        style={{
          fontSize: "clamp(24px, 3vw, 42px)",
          opacity: 0.85,
          marginTop: 40,
        }}
      >
        Nessun risultato registrato
      </div>
    ) : (
      <div
        style={{
          ...tvScrollBoxStyle,
          width: "min(1100px, 94vw)",
          flex: 1,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {currentStop10Results.map((result, index) => {
          const isWinner = index === 0;

          return (
            <div
              key={result.id}
              style={{
                ...panelStyle,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 20,
                padding: "clamp(12px, 1.5vw, 20px)",
                fontSize: "clamp(18px, 2vw, 30px)",
                background: isWinner
                  ? "rgba(250,204,21,0.22)"
                  : "rgba(255,255,255,0.08)",
                border: isWinner
                  ? "2px solid rgba(250,204,21,0.55)"
                  : BORDER,
                animation: isWinner
                  ? "winnerPulse 1.2s ease-in-out infinite"
                  : "slideUp 0.45s ease",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  textAlign: "left",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {index + 1}. {result.player_name}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  flexShrink: 0,
                  fontWeight: "bold",
                }}
              >
                <span style={{ color: GOLD }}>
                  {(Number(result.stopped_ms || 0) / 1000).toFixed(2)}s
                </span>

                <span style={{ opacity: 0.8 }}>
                  ±{(Number(result.diff_ms || 0) / 1000).toFixed(2)}s
                </span>

                <span style={{ color: GREEN }}>
                  +{Number(result.score_awarded || 0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}

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

/* ===== NUOVA ANIMAZIONE INTRO STOP ZERO ===== */
@keyframes stopZeroZoom {

  0% {
    transform: scale(1);
    filter: brightness(0.92);
  }

  30% {
    transform: scale(1.015);
    filter: brightness(1);
  }

  60% {
    transform: scale(1.03);
    filter: brightness(1.05);
  }

  100% {
    transform: scale(1.06);
    filter: brightness(1.08);
  }
}

/* ===== LEGGERO RESPIRO LUMINOSO ===== */
@keyframes stopZeroGlow {

  0% {
    box-shadow: inset 0 0 0 rgba(255,255,255,0);
  }

  50% {
    box-shadow: inset 0 0 120px rgba(255,255,255,0.08);
  }

  100% {
    box-shadow: inset 0 0 0 rgba(255,255,255,0);
  }
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

/* ===== INTRO STOP ZERO TV ===== */

.stopzero-intro {

  overflow: hidden;
  position: relative;
}

.stopzero-intro::before {

  content: "";
  position: absolute;
  inset: 0;

  background: inherit;
  background-size: cover;
  background-position: center;

  animation: stopZeroZoom 25s ease-in-out forwards;
  transform-origin: center center;

  z-index: 0;
}

.stopzero-intro::after {

  content: "";
  position: absolute;
  inset: 0;

  animation: stopZeroGlow 4s ease-in-out infinite;

  z-index: 1;
}

.stopzero-intro > * {

  position: relative;
  z-index: 2;
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

{effectivePhase === "stop10_intro" && (
  <div
    className="tv-anim-fade"
    style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      zIndex: 9998,
    }}
  >
    <audio autoPlay src={STOPZERO_AUDIO} />

    <img
      src={STOPZERO_BG}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        animation: "stopZeroIntroImageZoom 5s ease-in-out infinite alternate",
        transformOrigin: "center center",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />

    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        background:
          "radial-gradient(circle at center, rgba(0,0,0,0.02), rgba(0,0,0,0.68))",
      }}
    />

    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        background:
          "linear-gradient(90deg, rgba(0,0,0,0.45), rgba(0,0,0,0.05), rgba(0,0,0,0.45))",
      }}
    />

    <div
      style={{
        position: "relative",
        zIndex: 3,
        textAlign: "center",
        color: "white",
        transform: "translateY(20px)",
      }}
    >
      <div
        style={{
          fontSize: "clamp(90px, 10vw, 170px)",
          fontWeight: 900,
          letterSpacing: 8,
          textTransform: "uppercase",
          animation: "stopZeroTextPulse 0.8s ease-in-out infinite alternate",
          textShadow:
            "0 0 20px rgba(255,0,0,0.9), 0 0 60px rgba(255,0,0,0.7)",
        }}
      >
        STOP ZERO
      </div>

      <div
        style={{
          marginTop: 30,
          fontSize: "clamp(28px, 3vw, 46px)",
          fontWeight: 800,
          color: "#facc15",
          textShadow: "0 0 20px rgba(250,204,21,0.8)",
        }}
      >
        Preparati...
      </div>
    </div>

    <style>
      {`
        @keyframes stopZeroIntroImageZoom {
          0% {
            transform: scale(1) rotate(0deg);
            filter: brightness(0.7) saturate(1);
          }

          100% {
            transform: scale(1.25) rotate(1deg);
            filter: brightness(1.4) saturate(1.25);
          }
        }

        @keyframes stopZeroTextPulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }

          100% {
            transform: scale(1.12);
            opacity: 0.75;
          }
        }

        @keyframes stopExpiredFlash {
          0% {
            opacity: 1;
            transform: scale(1) translateY(-20px);
            filter: brightness(1);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.06) translateY(-20px);
            filter: brightness(1.8);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(-20px);
            filter: brightness(1);
          }
        }
      `}
    </style>
  </div>
)}

{effectivePhase === "stop10" && (
  <div
    style={{
      minHeight: "100vh",
      backgroundImage: `url(${STOPZERO_BG})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent:
        stop10DisplayTime === "TEMPO SCADUTO" ? "flex-start" : "center",
      color: "white",
      position: "relative",
      overflow: "hidden",
      paddingTop:
        stop10DisplayTime === "TEMPO SCADUTO" ? "clamp(90px, 10vh, 140px)" : 0,
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          stop10DisplayTime === "TEMPO SCADUTO"
            ? "radial-gradient(circle at center, rgba(180,0,0,0.68), rgba(0,0,0,0.88))"
            : "rgba(0,0,0,0.45)",
      }}
    />

    <div
      style={{
        position: "relative",
        zIndex: 2,
        textAlign: "center",
        animation:
          stop10DisplayTime === "TEMPO SCADUTO"
            ? "stopExpiredFlash 0.35s infinite"
            : "none",
        transform:
          stop10DisplayTime === "TEMPO SCADUTO" ? "translateY(-20px)" : "none",
      }}
    >
      <div
        style={{
          fontSize:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "clamp(64px, 7vw, 120px)"
              : "clamp(80px, 8vw, 150px)",
          fontWeight: 900,
          marginBottom: stop10DisplayTime === "TEMPO SCADUTO" ? 28 : 40,
          letterSpacing: 6,
          textShadow:
            "0 0 20px rgba(255,0,0,0.9), 0 0 60px rgba(255,0,0,0.7)",
        }}
      >
        STOP ZERO
      </div>

      <div
        style={{
          fontSize:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "clamp(76px, 8vw, 150px)"
              : "clamp(140px, 18vw, 300px)",
          fontWeight: 900,
          fontFamily: "'Orbitron', monospace",
          letterSpacing: stop10DisplayTime === "TEMPO SCADUTO" ? 4 : 12,
          lineHeight: stop10DisplayTime === "TEMPO SCADUTO" ? 1.05 : 0.9,
          color:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "#ff1f1f"
              : stop10DisplayTime === "???"
              ? "#60a5fa"
              : "#dbeafe",
          textShadow:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "0 0 18px #ffffff, 0 0 35px #ff0000, 0 0 100px #ff0000"
              : stop10DisplayTime === "???"
              ? "0 0 20px #3b82f6, 0 0 70px #2563eb"
              : "0 0 15px #fff, 0 0 40px #60a5fa, 0 0 100px #2563eb",
          padding:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "28px 70px"
              : "25px 55px",
          borderRadius: 28,
          background:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "linear-gradient(180deg, rgba(90,0,0,0.96), rgba(0,0,0,0.86))"
              : "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(0,0,0,0.78))",
          border:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "4px solid rgba(255,0,0,0.95)"
              : "2px solid rgba(96,165,250,0.75)",
          boxShadow:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "0 0 55px rgba(255,0,0,0.95), inset 0 0 40px rgba(255,0,0,0.35)"
              : "0 0 35px rgba(37,99,235,0.6), inset 0 0 30px rgba(96,165,250,0.22)",
          minWidth: stop10DisplayTime === "TEMPO SCADUTO" ? 920 : 600,
          display: "inline-block",
        }}
      >
        {stop10DisplayTime}
      </div>

      <div
        style={{
          marginTop: stop10DisplayTime === "TEMPO SCADUTO" ? 28 : 35,
          fontSize: "clamp(26px, 2.8vw, 42px)",
          fontWeight: 800,
          color:
            stop10DisplayTime === "TEMPO SCADUTO" ? "#ff4444" : "#facc15",
          textShadow:
            stop10DisplayTime === "TEMPO SCADUTO"
              ? "0 0 18px rgba(255,0,0,0.9)"
              : "0 0 18px rgba(250,204,21,0.7)",
        }}
      >
        {stop10DisplayTime === "TEMPO SCADUTO"
          ? "STOP ZERO TERMINATO"
          : "Premi STOP quando pensi sia arrivato lo zero"}
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
      padding: "clamp(8px, 1vw, 16px)",
      boxSizing: "border-box",
    }}
  >
    {/* HEADER */}
    <div
      style={{
        textAlign: "center",
        marginBottom: "clamp(6px, 1vw, 12px)",
        flexShrink: 0,
      }}
    >
      <h1
        style={{
          fontSize: "clamp(26px, 3vw, 52px)",
          margin: 0,
          lineHeight: 1.05,
        }}
      >
        🍻 {getGameTitle(game)}
      </h1>

      <div style={{ fontSize: "clamp(14px, 1.3vw, 22px)", opacity: 0.9 }}>
        Inquadra il QR e unisciti
      </div>
    </div>

    {/* GRID */}
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: players.length >= 35 ? "0.65fr 1.35fr" : "0.8fr 1.2fr",
        gap: "clamp(8px, 1vw, 14px)",
        overflow: "hidden",
      }}
    >
      {/* ===== SINISTRA (QR) ===== */}
      <div
        style={{
          ...panelStyle,
          padding: "clamp(8px, 1vw, 14px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(6px, 1vw, 12px)",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "white",
            padding: 6,
            borderRadius: 14,
            flexShrink: 0,
          }}
        >
          <QRCodeSVG
            value={PLAYER_JOIN_URL}
            size={players.length >= 35 ? 150 : 170}
            style={{
              display: "block",
              width: players.length >= 35 ? "150px" : "170px",
              height: players.length >= 35 ? "150px" : "170px",
            }}
          />
        </div>

        <div
          style={{
            fontSize: "clamp(13px, 1.1vw, 20px)",
            fontWeight: "bold",
            textAlign: "center",
            lineHeight: 1.15,
          }}
        >
          📱 Inquadra per partecipare
        </div>

        <div
          style={{
            fontSize: "clamp(12px, 1vw, 18px)",
            color: GOLD,
            fontWeight: "bold",
          }}
        >
          Codice: {GAME_CODE}
        </div>
      </div>

      {/* ===== DESTRA (GIOCATORI) ===== */}
      <div
        style={{
          ...panelStyle,
          padding: "clamp(8px, 1vw, 14px)",
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
            fontSize: "clamp(18px, 1.6vw, 28px)",
            marginBottom: 8,
            flexShrink: 0,
          }}
        >
          Giocatori ({players.length})
        </div>

        {players.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "clamp(18px, 2vw, 30px)",
            }}
          >
            Nessuno collegato
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: "100%",
              overflowY: "auto",
              overflowX: "hidden",
              paddingRight: 6,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${tvLobbyPlayerColumns}, minmax(0, 1fr))`,
                gap: players.length >= 40 ? 6 : 8,
                alignContent: "start",
              }}
            >
              {players.map((p, i) => (
                <div
                  key={p.id}
                  title={p.name}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    padding:
                      players.length >= 40
                        ? "6px 9px"
                        : tvLobbyPlayerPadding,
                    fontSize:
                      players.length >= 40
                        ? "clamp(13px, 1vw, 17px)"
                        : tvLobbyPlayerFontSize,
                    lineHeight: 1.15,
                    fontWeight: "bold",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {i + 1}. {p.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}

{/* =========================
   10.12 - Classifica provvisoria TV responsive
========================= */}

{Boolean(game?.show_leaderboard) && game?.phase !== "final" && (
  <div style={{ ...tvFullScreenPanelStyle, padding: "clamp(18px, 3vw, 40px)" }}>
    <h2 style={tvAdaptiveTitleStyle}>
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
          return (a.name || "").localeCompare(b.name || "", "it", {
            sensitivity: "base",
          });
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
              ...tvScrollBoxStyle,
              flex: 1,
              maxWidth: 1100,
              width: "100%",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {visiblePlayers.map((p) => {
              const realIndex = sortedPlayers.findIndex(
                (player) => player.id === p.id
              );
              const position = realIndex + 1;
              const isFinalWinner =
                position === 1 && revealCount >= sortedPlayers.length;

              return (
                <div
                  key={p.id}
                  style={{
                    ...panelStyle,
                    ...tvAdaptiveRowTextStyle,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 18,
                    padding: "clamp(10px, 1.4vw, 18px) clamp(14px, 2vw, 24px)",
                    background:
                      position === 1
                        ? "rgba(255,215,64,0.24)"
                        : position === 2
                        ? "rgba(203,213,225,0.18)"
                        : position === 3
                        ? "rgba(180,83,9,0.18)"
                        : "rgba(255,255,255,0.08)",
                    border:
                      position <= 3
                        ? "2px solid rgba(250,204,21,0.45)"
                        : BORDER,
                    animation: isFinalWinner
                      ? "winnerPulse 1s ease-in-out infinite"
                      : "slideUp 0.45s ease",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "bold",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {position}. {p.name}
                  </span>

                  <span
                    style={{
                      color: GOLD,
                      fontWeight: "bold",
                      flexShrink: 0,
                    }}
                  >
                    {Number(p.score || 0)} pt
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
      height: "100dvh",
      padding: "70px 22px 18px",
      boxSizing: "border-box",
      background:
        "radial-gradient(circle at top, rgba(250,204,21,0.22), transparent 34%), linear-gradient(135deg, #080816 0%, #190b2f 48%, #050714 100%)",
      color: "white",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }}
  >
    {finalRevealIndex !== -1 && finalRevealIndex <= 1 && sortedPlayers[0] && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={`confetti-${i}`}
            style={{
              position: "absolute",
              top: -40,
              left: `${(i * 17) % 100}%`,
              width: 10,
              height: 18,
              borderRadius: 3,
              background:
                i % 5 === 0
                  ? "#facc15"
                  : i % 5 === 1
                  ? "#ef4444"
                  : i % 5 === 2
                  ? "#22c55e"
                  : i % 5 === 3
                  ? "#3b82f6"
                  : "#ffffff",
              animation: `finalConfettiFall ${3 + (i % 4)}s linear infinite`,
              animationDelay: `${(i % 20) * 0.12}s`,
              opacity: 0.9,
            }}
          />
        ))}

        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={`firework-${i}`}
            style={{
              position: "absolute",
              left: `${12 + i * 12}%`,
              top: `${14 + (i % 3) * 13}%`,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#facc15",
              boxShadow:
                "0 0 18px #fff, 0 0 35px #facc15, 0 0 70px #ef4444",
              animation: "finalFirework 1.4s ease-out infinite",
              animationDelay: `${i * 0.25}s`,
            }}
          />
        ))}

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(92vw, 1050px)",
            padding: "34px 46px",
            borderRadius: 32,
            textAlign: "center",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.72), rgba(30,20,5,0.82))",
            border: "3px solid rgba(250,204,21,0.9)",
            boxShadow:
              "0 0 60px rgba(250,204,21,0.75), inset 0 0 40px rgba(250,204,21,0.18)",
            animation: "winnerOverlayPop 1s ease-out forwards",
          }}
        >
          <div
            style={{
              fontSize: "clamp(34px, 4vw, 64px)",
              fontWeight: 900,
              color: "#facc15",
              letterSpacing: 4,
              textShadow: "0 0 30px rgba(250,204,21,0.95)",
            }}
          >
            🏆 VINCE IL QUIZZONE 🏆
          </div>

          <div
            style={{
              marginTop: 20,
              fontSize: "clamp(46px, 6vw, 96px)",
              fontWeight: 900,
              color: "white",
              textShadow:
                "0 0 20px #fff, 0 0 45px rgba(250,204,21,0.95)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sortedPlayers[0].name}
          </div>

          <div
            style={{
              marginTop: 12,
              fontSize: "clamp(26px, 3vw, 46px)",
              fontWeight: 900,
              color: "#facc15",
            }}
          >
            {sortedPlayers[0].score || 0} punti
          </div>
        </div>
      </div>
    )}

    <h2
      style={{
        fontSize: "clamp(30px, 4vw, 52px)",
        margin: "0 0 12px",
        textAlign: "center",
        fontWeight: 900,
        letterSpacing: 3,
        lineHeight: 1,
        textShadow: "0 0 30px rgba(250,204,21,0.55)",
        zIndex: 2,
      }}
    >
      🏆 TOP 5 FINALE
    </h2>

    {players.length === 0 ? (
      <div
        style={{
          ...panelStyle,
          fontSize: 34,
          textAlign: "center",
        }}
      >
        Nessun giocatore in classifica
      </div>
    ) : (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 14,
          alignItems: "end",
          transform: "translateY(-55px)",
          maxWidth: 1500,
          margin: "0 auto",
          width: "100%",
          overflow: "hidden",
          zIndex: 2,
        }}
      >
        {sortedPlayers.slice(0, 5).map((player, index) => {
          const position = index + 1;
          const isVisible =
            finalRevealIndex !== -1 && position >= finalRevealIndex;

          const cardHeight =
            position === 1
              ? "88%"
              : position === 2
              ? "78%"
              : position === 3
              ? "70%"
              : position === 4
              ? "62%"
              : "56%";

          const medal =
            position === 1
              ? "🥇"
              : position === 2
              ? "🥈"
              : position === 3
              ? "🥉"
              : `#${position}`;

          return (
            <div
              key={player.id}
              style={{
                height: cardHeight,
                borderRadius: 24,
                padding: 14,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 10,
                alignItems: "center",
                textAlign: "center",
                overflow: "hidden",
                background:
                  position === 1
                    ? "linear-gradient(180deg, rgba(250,204,21,0.42), rgba(120,53,15,0.34))"
                    : position === 2
                    ? "linear-gradient(180deg, rgba(226,232,240,0.30), rgba(71,85,105,0.30))"
                    : position === 3
                    ? "linear-gradient(180deg, rgba(205,127,50,0.32), rgba(92,45,20,0.28))"
                    : "rgba(255,255,255,0.10)",
                border: "2px solid rgba(255,255,255,0.18)",
                boxShadow:
                  position === 1
                    ? "0 0 30px rgba(250,204,21,0.55)"
                    : "0 10px 22px rgba(0,0,0,0.35)",
                opacity: isVisible ? 1 : 0,
                transform: isVisible
                  ? "translateY(0) scale(1)"
                  : "translateY(80px) scale(0.85)",
                transition: "opacity 0.7s ease, transform 0.7s ease",
                animation:
                  isVisible && position === 1
                    ? "winnerPulse 1s ease-in-out infinite"
                    : "none",
              }}
            >
              <div style={{ fontSize: position === 1 ? 52 : 40 }}>
                {medal}
              </div>

              <div
                style={{
                  fontSize: position === 1 ? 28 : 21,
                  fontWeight: 900,
                }}
              >
                {position}° POSTO
              </div>

              <div
                style={{
                  fontSize: position === 1 ? 16 : 13,
                  fontWeight: 900,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {player.name}
              </div>

              <div
                style={{
                  fontSize: position === 1 ? 26 : 20,
                  fontWeight: 900,
                  color: GOLD,
                }}
              >
                {player.score || 0} pt
              </div>

              {position === 1 && (
                <div style={{ fontSize: 15, fontWeight: 900, color: GOLD }}>
                  🎉 VINCITORE
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}

    <style>
      {`
        @keyframes winnerPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.035); }
          100% { transform: scale(1); }
        }

        @keyframes finalConfettiFall {
          0% {
            transform: translateY(-40px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0.1;
          }
        }

        @keyframes finalFirework {
          0% {
            transform: scale(0.2);
            opacity: 1;
          }
          70% {
            transform: scale(5);
            opacity: 0.85;
          }
          100% {
            transform: scale(7);
            opacity: 0;
          }
        }

        @keyframes winnerOverlayPop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.65);
          }
          65% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.06);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}
    </style>
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
  const hostSortedPlayers = [...(players || [])].sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.name || "").localeCompare(b.name || "", "it", { sensitivity: "base" });
  });

  const getHostYoutubeId = (url) => {
    try {
      const parsed = new URL(String(url || "").trim());

      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "").split("?")[0];
      }

      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname.startsWith("/watch")) {
          return parsed.searchParams.get("v") || "";
        }

        if (parsed.pathname.startsWith("/shorts/")) {
          return parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
        }

        if (parsed.pathname.startsWith("/embed/")) {
          return parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        }
      }

      return "";
    } catch {
      return "";
    }
  };

  const getMediaChecksForQuestion = (question) => {
    return mediaCheckReport.filter(
      (item) => Number(item.position) === Number(question.position)
    );
  };

  const getQuestionMediaStatus = (question) => {
    const checks = getMediaChecksForQuestion(question);

    if (!checks.length) {
      if (
        question.image_url ||
        question.audio_url ||
        question.video_url ||
        question.youtube_url
      ) {
        return { label: "⚪ Non controllato", color: "#94a3b8" };
      }

      return { label: "Nessun media", color: "#94a3b8" };
    }

    if (checks.some((c) => c.status === "error")) {
      return { label: "❌ Problema media", color: "#ef4444" };
    }

    if (checks.some((c) => c.status === "warning")) {
      return { label: "⚠️ Da verificare", color: "#facc15" };
    }

    return { label: "✅ Media OK", color: "#22c55e" };
  };

  const hostQuestionsSorted = [...(questions || [])].sort(
    (a, b) => Number(a.position || 0) - Number(b.position || 0)
  );

  return (
    <div
      style={{
        ...containerStyle,
        height: "100dvh",
        maxHeight: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
        padding: 20,
        background: "#020617",
        boxSizing: "border-box",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>
        🎤 HOST PANEL
      </h1>

      <div
        style={{
          ...panelStyle,
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div><b>Fase:</b> {effectivePhase}</div>
        <div><b>Domanda:</b> {Number(game?.current_question_index || 0) + 1} / {questions.length}</div>
        <div><b>Timer:</b> {hostDisplayedTime}s</div>
        <div><b>Giocatori:</b> {players.length}</div>
        <div><b>Risposte:</b> {answerStats.totalAnswered} / {answerStats.totalPlayers}</div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Controlli</h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <label style={{ ...buttonStyle, cursor: "pointer" }}>
            📁 CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => importCsvQuestions(e.target.files?.[0])}
              style={{ display: "none" }}
            />
          </label>

          <button onClick={startQuiz} style={buttonStyle}>▶️ Avvia</button>
          <button onClick={nextQuestion} style={buttonStyle}>➡️ Next</button>
          <button onClick={revealAnswer} style={buttonStyle}>💡 Risposta</button>
          <button onClick={toggleLeaderboardOnTv} style={buttonStyle}>🏆 Classifica</button>
          <button onClick={startStop10Game} style={buttonStyle}>⏱ Stop10</button>
<button onClick={finishStop10Game} style={buttonStyle}>
  🏁 Chiudi Stop10 e assegna punti
</button>

          <button onClick={downloadLeaderboardCsv} style={buttonStyle}>
            ⬇️ Scarica classifica
          </button>

          <button onClick={resetAll} style={{ ...buttonStyle, background: "#ef4444" }}>
            🔄 Reset
          </button>
        </div>

        {status && (
          <div style={{ marginTop: 10 }}>
            <b>Status:</b> {status}
          </div>
        )}
      </div>

{/* ===== REPORT CONTROLLO MEDIA CSV ===== */}

<div style={{ ...panelStyle, marginBottom: 18 }}>
  <h2 style={{ marginTop: 0 }}>
    ➕ Aggiungi domanda CSV live
  </h2>

  <div
    style={{
      fontSize: 14,
      opacity: 0.8,
      marginBottom: 12,
    }}
  >
    Incolla UNA riga CSV completa.
    Verrà aggiunta in fondo al quiz senza resettare la partita.
  </div>

  <textarea
    value={liveCsvRow}
    onChange={(e) => setLiveCsvRow(e.target.value)}
    placeholder="position,round,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,time_limit,points,image_url,audio_url,video_url,youtube_url"
    style={{
      width: "100%",
      minHeight: 120,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "#0f172a",
      color: "white",
      padding: 12,
      resize: "vertical",
      boxSizing: "border-box",
      fontFamily: "monospace",
      marginBottom: 12,
    }}
  />

  <button
    onClick={addLiveCsvQuestion}
    disabled={liveCsvLoading}
    style={{
      ...buttonStyle,
      opacity: liveCsvLoading ? 0.5 : 1,
    }}
  >
    ➕ Aggiungi in fondo
  </button>

  {liveCsvError && (
    <div
      style={{
        marginTop: 12,
        color: "#ef4444",
        fontWeight: "bold",
      }}
    >
      ❌ {liveCsvError}
    </div>
  )}
</div>
      
      {/* ===== LISTA DOMANDE CON PREVIEW ===== */}
      <div style={{ ...panelStyle, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>🧪 Preview domande importate</h2>

        {hostQuestionsSorted.length === 0 ? (
          <div style={{ opacity: 0.85 }}>
            Nessuna domanda caricata.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {hostQuestionsSorted.map((q) => {
              const statusInfo = getQuestionMediaStatus(q);
              const youtubeId = getHostYoutubeId(q.youtube_url);
              const checks = getMediaChecksForQuestion(q);

              return (
                <div
                  key={q.id || q.position}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background:
                      Number(q.position) === Number(game?.current_question_index || 0)
                        ? "rgba(124,58,237,0.22)"
                        : "rgba(255,255,255,0.06)",
                    border:
                      Number(q.position) === Number(game?.current_question_index || 0)
                        ? "1px solid rgba(168,85,247,0.85)"
                        : "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontWeight: "bold", color: GOLD }}>
                          #{Number(q.position) + 1}
                        </span>

                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.10)",
                            fontSize: 12,
                            fontWeight: "bold",
                          }}
                        >
                          {String(q.type || "multiple").toUpperCase()}
                        </span>

                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.10)",
                            color: statusInfo.color,
                            fontSize: 12,
                            fontWeight: "bold",
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
                        {q.question}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        {["A", "B", "C", "D"].map((letter) => {
                          const text = q[`option_${letter.toLowerCase()}`];
                          if (!text) return null;

                          return (
                            <div
                              key={letter}
                              style={{
                                padding: 8,
                                borderRadius: 10,
                                background:
                                  q.correct_answer === letter
                                    ? "rgba(34,197,94,0.18)"
                                    : "rgba(15,23,42,0.85)",
                                border:
                                  q.correct_answer === letter
                                    ? "1px solid rgba(34,197,94,0.55)"
                                    : "1px solid rgba(255,255,255,0.10)",
                              }}
                            >
                              <b>{letter})</b> {text}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            opacity: 0.85,
                          }}
                        >
                          <b>Spiegazione:</b> {q.explanation}
                        </div>
                      )}

                      {checks.length > 0 && (
                        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                          {checks.map((check, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 12,
                                color:
                                  check.status === "ok"
                                    ? "#22c55e"
                                    : check.status === "warning"
                                    ? "#facc15"
                                    : "#ef4444",
                              }}
                            >
                              {check.status === "ok" ? "✅" : check.status === "warning" ? "⚠️" : "❌"}{" "}
                              {check.type}: {check.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        width: 180,
                        display: "grid",
                        gap: 8,
                        justifyItems: "stretch",
                      }}
                    >
                      {q.image_url && (
                        <img
                          src={q.image_url}
                          alt="Preview"
                          style={{
                            width: 180,
                            height: 96,
                            objectFit: "contain",
                            background: "rgba(0,0,0,0.35)",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.14)",
                          }}
                        />
                      )}

                      {youtubeId && (
                        <img
                          src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                          alt="YouTube preview"
                          style={{
                            width: 180,
                            height: 96,
                            objectFit: "cover",
                            background: "rgba(0,0,0,0.35)",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.14)",
                          }}
                        />
                      )}

                      {q.audio_url && (
                        <audio
                          src={q.audio_url}
                          controls
                          style={{ width: 180 }}
                        />
                      )}

                      {q.video_url && !q.youtube_url && (
                        <video
                          src={q.video_url}
                          controls
                          style={{
                            width: 180,
                            maxHeight: 110,
                            borderRadius: 10,
                            background: "black",
                          }}
                        />
                      )}

                      <button
                        onClick={() => deleteQuestionFromQuiz(q.id)}
                        style={{
                          ...buttonStyle,
                          margin: 0,
                          padding: "10px 12px",
                          background: "#ef4444",
                          fontSize: 13,
                        }}
                      >
                        🗑️ Elimina domanda
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== GRID PRINCIPALE ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 18,
        }}
      >
        <div style={panelStyle}>
          <h2>🎯 Domanda corrente</h2>

          {!currentQuestion ? (
            <div>Nessuna domanda</div>
          ) : (
            <>
              <div style={{ marginBottom: 10, fontSize: 22, fontWeight: "bold" }}>
                {currentQuestion.question}
              </div>

              {renderQuestionMedia(currentQuestion, "host")}

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {["A", "B", "C", "D"].map((l) => {
                  const text = currentQuestion[`option_${l.toLowerCase()}`];
                  if (!text) return null;

                  return (
                    <div
                      key={l}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background:
                          currentQuestion.correct_answer === l
                            ? "rgba(34,197,94,0.20)"
                            : "#1e293b",
                        border:
                          currentQuestion.correct_answer === l
                            ? "1px solid rgba(34,197,94,0.55)"
                            : "1px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      <b>{l})</b> {text}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div style={panelStyle}>
            <h2>📊 Risposte</h2>

            {["A", "B", "C", "D"].map((l) => {
              const stat = answerStats[l];

              return (
                <div key={l} style={{ marginBottom: 8 }}>
                  {l}: {stat.count} ({stat.percent}%)
                </div>
              );
            })}
          </div>

          <div style={panelStyle}>
            <h2>🏆 Classifica</h2>

            {hostSortedPlayers.length === 0 ? (
              <div>Nessun giocatore</div>
            ) : (
              hostSortedPlayers.map((p, i) => (
                <div key={p.id}>
                  {i + 1}. {p.name} — {p.score}
                </div>
              ))
            )}
          </div>

          <div style={panelStyle}>
            <h2>📡 Eventi</h2>

            {liveEvents.length === 0 ? (
              <div>Nessun evento</div>
            ) : (
              liveEvents.map((e) => (
                <div key={e.id}>{e.event_text}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

}