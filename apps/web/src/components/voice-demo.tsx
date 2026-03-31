"use client";

import { useEffect, useRef, useState } from "react";
import { notifyFinanceDataUpdated } from "./data-sync";
import { authenticatedFetch } from "../lib/api";

type Message = {
  id: string;
  speaker: "user" | "assistant";
  content: string;
};

type TransactionItem = {
  id: string;
  direction: "expense" | "income" | "transfer";
  description: string;
  amount: number | null;
  created_at: string;
};

type ParsedSummary = {
  intent: "transaction" | "commitment" | "correction" | "unknown";
  inferredIntent: "transaction" | "commitment" | "correction" | "unknown";
  direction: "expense" | "income" | null;
  amount: number | null;
  description: string | null;
  category: string | null;
  summaryKind: "fixed" | "variable" | "income" | null;
  recurrence: string | null;
  timeReference: "today" | "yesterday" | "tomorrow" | null;
  dueDay: number | null;
  counterparty: string | null;
  confidence: "low" | "medium";
  missingFields: string[];
};

type SpeechRecognitionResultLike = {
  0: {
    transcript: string;
  };
  isFinal: boolean;
};

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const examplePhrases = [
  "gastei 38 no almoço",
  "recebi 1200 do cliente Marcos",
  "todo dia 10 aluguel 1800",
];

const initialMessages: Message[] = [];

type ConversationApiResponse = {
  message: string;
  assistantReply: string;
  payload: {
    text: string;
  };
  parsed: ParsedSummary;
  persistence: {
    saved: boolean;
    provider: "supabase" | "none";
    conversationId: string | null;
    recordId: string | null;
    reason?: string;
  };
};

type TransactionsApiResponse = {
  items: TransactionItem[];
  placeholder: boolean;
  provider: "supabase" | "none";
  reason?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const pushPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "";
const notificationsPromptStorageKey = "financeiro-notifications-prompt";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function capitalizeFirst(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function VoiceDemo() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [currentPhrase, setCurrentPhrase] = useState(examplePhrases[0]);
  const [status, setStatus] = useState<
    "idle" | "listening" | "sending" | "responding" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [parsedSummary, setParsedSummary] = useState<ParsedSummary | null>(null);
  const [persistenceStatus, setPersistenceStatus] =
    useState<ConversationApiResponse["persistence"] | null>(null);
  const [latestTransactions, setLatestTransactions] = useState<TransactionItem[]>([]);
  const [transactionsStatus, setTransactionsStatus] = useState<{
    provider: "supabase" | "none";
    reason?: string;
  } | null>(null);
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationsMessage, setNotificationsMessage] = useState<string | null>(null);
  const [notificationsPromptState, setNotificationsPromptState] = useState<
    "unknown" | "pending" | "enabled" | "dismissed"
  >("unknown");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pendingTranscriptRef = useRef("");
  const shouldSubmitRef = useRef(false);
  const isPressingRef = useRef(false);
  const isRecognitionActiveRef = useRef(false);
  const shouldShowConversation =
    messages.length > 0 || Boolean(errorMessage);

  useEffect(() => {
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }

      const normalizedTranscript = transcript.trim();
      pendingTranscriptRef.current = normalizedTranscript;
      setLiveTranscript(normalizedTranscript);
    };

    recognition.onerror = (event) => {
      isRecognitionActiveRef.current = false;
      shouldSubmitRef.current = false;
      setStatus("error");
      setErrorMessage(
        "O microfone não respondeu. Tente novamente.",
      );
    };

    recognition.onend = () => {
      isRecognitionActiveRef.current = false;
      const transcript = pendingTranscriptRef.current.trim();

      if (!shouldSubmitRef.current) {
        return;
      }

      if (isPressingRef.current) {
        window.setTimeout(() => {
          if (!isPressingRef.current || isRecognitionActiveRef.current || !recognitionRef.current) {
            return;
          }

          try {
            recognitionRef.current.start();
            isRecognitionActiveRef.current = true;
          } catch {
            // O iPhone pode levar um instante para permitir um novo start.
          }
        }, 120);
        return;
      }

      shouldSubmitRef.current = false;

      if (!transcript) {
        setStatus("error");
        setErrorMessage(
          "Não consegui entender. Tente novamente.",
        );
        return;
      }

      void runConversation(transcript, { simulateListening: false });
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      isRecognitionActiveRef.current = false;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    void fetchLatestTransactions();
  }, []);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      Boolean(pushPublicKey);

    setNotificationsSupported(supported);

    if (!supported) {
      setNotificationsPromptState("dismissed");
      return;
    }

    const storedPromptState =
      window.localStorage.getItem(notificationsPromptStorageKey) as
        | "enabled"
        | "dismissed"
        | null;

    if (storedPromptState === "enabled") {
      setNotificationsEnabled(true);
      setNotificationsPromptState("enabled");
    } else if (storedPromptState === "dismissed") {
      setNotificationsPromptState("dismissed");
    } else {
      setNotificationsPromptState("pending");
    }

    if (Notification.permission === "denied") {
      window.localStorage.setItem(notificationsPromptStorageKey, "dismissed");
      setNotificationsPromptState("dismissed");
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    void syncPushSubscription();
  }, []);

  async function runConversation(
    phrase: string,
    options?: { simulateListening?: boolean },
  ) {
    setCurrentPhrase(phrase);
    setErrorMessage(null);
    setLiveTranscript("");
    setMessages([]);
    setParsedSummary(null);
    setPersistenceStatus(null);
    setStatus(options?.simulateListening === false ? "sending" : "listening");

    if (options?.simulateListening !== false) {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      speaker: "user",
      content: phrase,
    };

      setMessages((current) => [...current, userMessage]);
    setStatus("sending");

    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/conversation/turns`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: phrase }),
      });

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`);
      }

      const data = (await response.json()) as ConversationApiResponse;

      setStatus("responding");
      setParsedSummary(data.parsed);
      setPersistenceStatus(data.persistence);
      notifyFinanceDataUpdated();
      await fetchLatestTransactions();

      await new Promise((resolve) => window.setTimeout(resolve, 500));

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          speaker: "assistant",
          content: data.assistantReply,
        },
      ]);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        "Não foi possível concluir agora. Verifique a conexão e tente novamente.",
      );
    }
  }

  async function fetchLatestTransactions() {
    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/transactions`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`);
      }

      const data = (await response.json()) as TransactionsApiResponse;
      setLatestTransactions(data.items);
      setTransactionsStatus({
        provider: data.provider,
        reason: data.reason,
      });
    } catch {
      setTransactionsStatus({
        provider: "none",
        reason: "Não consegui carregar o histórico de transações.",
      });
    }
  }

  async function syncPushSubscription() {
    if (!notificationsSupported) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (!existingSubscription) {
        setNotificationsEnabled(false);
        if (notificationsPromptState !== "dismissed") {
          setNotificationsPromptState("pending");
        }
        return;
      }

      const response = await authenticatedFetch(`${apiBaseUrl}/api/reminders/subscriptions`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: existingSubscription.endpoint,
          expirationTime: existingSubscription.expirationTime,
          keys: existingSubscription.toJSON().keys,
          userAgent: navigator.userAgent,
          deviceLabel: "PWA",
        }),
      });

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`);
      }

      setNotificationsEnabled(true);
      setNotificationsPromptState("enabled");
      window.localStorage.setItem(notificationsPromptStorageKey, "enabled");
      setNotificationsMessage("Alertas ativos neste aparelho.");
    } catch {
      setNotificationsEnabled(false);
      setNotificationsMessage("Não consegui ativar os alertas agora.");
    }
  }

  async function enablePushNotifications() {
    if (!notificationsSupported || notificationsBusy) {
      return;
    }

    setNotificationsBusy(true);
    setNotificationsMessage(null);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setNotificationsEnabled(false);
        if (permission === "denied") {
          setNotificationsPromptState("dismissed");
          window.localStorage.setItem(notificationsPromptStorageKey, "dismissed");
        }
        setNotificationsMessage("Permissão de alerta não concedida.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pushPublicKey),
        });
      }

      const response = await authenticatedFetch(`${apiBaseUrl}/api/reminders/subscriptions`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: subscription.toJSON().keys,
          userAgent: navigator.userAgent,
          deviceLabel: "PWA",
        }),
      });

      if (!response.ok) {
        throw new Error(`API retornou status ${response.status}`);
      }

      setNotificationsEnabled(true);
      setNotificationsPromptState("enabled");
      window.localStorage.setItem(notificationsPromptStorageKey, "enabled");
      setNotificationsMessage("Pronto. Seus alertas de vencimento ficaram ativos.");
    } catch {
      setNotificationsEnabled(false);
      setNotificationsMessage("Não consegui ativar os alertas agora.");
    } finally {
      setNotificationsBusy(false);
    }
  }

  function startVoiceCapture() {
    if (!speechSupported || !recognitionRef.current) {
      void runConversation(currentPhrase);
      return;
    }

    if (status === "sending" || status === "responding" || isRecognitionActiveRef.current) {
      return;
    }

    isPressingRef.current = true;
    pendingTranscriptRef.current = "";
    setLiveTranscript("");
    setErrorMessage(null);
    setStatus("listening");
    shouldSubmitRef.current = true;

    try {
      recognitionRef.current.start();
      isRecognitionActiveRef.current = true;
    } catch {
      isPressingRef.current = false;
      isRecognitionActiveRef.current = false;
      shouldSubmitRef.current = false;
      setStatus("error");
      setErrorMessage(
        "Não foi possível iniciar o microfone.",
      );
    }
  }

  function stopVoiceCapture() {
    if (!speechSupported || !recognitionRef.current || !isPressingRef.current) {
      return;
    }

    isPressingRef.current = false;

    if (!isRecognitionActiveRef.current) {
      return;
    }

    try {
      recognitionRef.current.stop();
    } catch {
      isRecognitionActiveRef.current = false;
    }
  }

  const statusLabel = {
    idle: "Pronto",
    listening: "Segure para falar",
    sending: "Analisando",
    responding: "Registrando",
    error: "Algo falhou",
  }[status];

  const shouldShowNotificationsSetup =
    notificationsSupported &&
    notificationsPromptState === "pending" &&
    !notificationsEnabled;

  return (
    <section className="demo-shell">
      {shouldShowConversation ? (
        <section className="conversation-panel conversation-panel--minimal">
          <div className="message-list">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`message-bubble message-bubble--${message.speaker}`}
              >
                <p>{capitalizeFirst(message.content)}</p>
              </article>
            ))}
          </div>

          {errorMessage ? (
            <article className="error-card">
              <strong>Não foi possível concluir.</strong>
              <p className="error-text">{errorMessage}</p>
            </article>
          ) : null}
        </section>
      ) : null}

      {!speechSupported ? (
        <div className="phrase-grid phrase-grid--minimal">
          {examplePhrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              className={`mini-card mini-card--button${
                currentPhrase === phrase ? " mini-card--active" : ""
              }`}
              onClick={() => void runConversation(phrase)}
            >
              <span className="mini-label">Exemplo</span>
              <p>&quot;{phrase}&quot;</p>
            </button>
          ))}
        </div>
      ) : null}

      <section className="voice-stage voice-stage--hero voice-stage--bottom">
        {shouldShowNotificationsSetup ? (
          <div className="alerts-setup">
            <button
              type="button"
              className="alerts-setup__button"
              onClick={enablePushNotifications}
              disabled={notificationsBusy}
            >
              {notificationsBusy ? "Ativando alertas..." : "Ativar alertas"}
            </button>
            <p className="alerts-setup__hint">
              Receba aviso quando um gasto fixo vencer no dia.
            </p>
            {notificationsMessage ? (
              <p className="alerts-setup__hint alerts-setup__hint--error">
                {notificationsMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="status-row">
          {status !== "idle" ? <p className="status-pill">{statusLabel}</p> : null}
          {liveTranscript ? (
            <p className="transcript-pill">“{liveTranscript}”</p>
          ) : null}
        </div>
        <div className="voice-center">
          <span className="voice-particle voice-particle--one" aria-hidden="true" />
          <span className="voice-particle voice-particle--two" aria-hidden="true" />
          <span className="voice-particle voice-particle--three" aria-hidden="true" />
          <span className="voice-particle voice-particle--four" aria-hidden="true" />
          <span className="voice-particle voice-particle--five" aria-hidden="true" />
          <span className="voice-particle voice-particle--six" aria-hidden="true" />
          <span className="voice-halo voice-halo--one" aria-hidden="true" />
          <span className="voice-halo voice-halo--two" aria-hidden="true" />
          <button
            type="button"
            className={`voice-trigger voice-trigger--${status}`}
            onPointerDown={startVoiceCapture}
            onPointerUp={stopVoiceCapture}
            onPointerCancel={stopVoiceCapture}
            onPointerLeave={stopVoiceCapture}
            onKeyDown={(event) => {
              if (event.repeat) {
                return;
              }

              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                startVoiceCapture();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                stopVoiceCapture();
              }
            }}
            onClick={(event) => {
              if (speechSupported) {
                event.preventDefault();
              }
            }}
            disabled={status === "sending" || status === "responding"}
            aria-label={speechSupported ? "Segure para falar e solte para enviar" : "Enviar exemplo"}
          >
            <span className="voice-orb" aria-hidden="true" />
          </button>
        </div>
      </section>
    </section>
  );
}
