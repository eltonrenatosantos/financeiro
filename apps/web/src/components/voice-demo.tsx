"use client";

import { useEffect, useRef, useState } from "react";

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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pendingTranscriptRef = useRef("");
  const shouldSubmitRef = useRef(false);
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
    recognition.continuous = false;
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
      shouldSubmitRef.current = false;
      setStatus("error");
      setErrorMessage(
        "O microfone não respondeu. Tente novamente.",
      );
    };

    recognition.onend = () => {
      const transcript = pendingTranscriptRef.current.trim();

      if (!shouldSubmitRef.current) {
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
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    void fetchLatestTransactions();
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
      const response = await fetch(`${apiBaseUrl}/api/conversation/turns`, {
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
      const response = await fetch(`${apiBaseUrl}/api/transactions`, {
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

  function startVoiceCapture() {
    if (!speechSupported || !recognitionRef.current) {
      void runConversation(currentPhrase);
      return;
    }

    pendingTranscriptRef.current = "";
    setLiveTranscript("");
    setErrorMessage(null);
    setStatus("listening");
    shouldSubmitRef.current = true;

    try {
      recognitionRef.current.start();
    } catch {
      shouldSubmitRef.current = false;
      setStatus("error");
      setErrorMessage(
        "Não foi possível iniciar o microfone.",
      );
    }
  }

  const statusLabel = {
    idle: "Pronto",
    listening: "Escutando",
    sending: "Analisando",
    responding: "Registrando",
    error: "Algo falhou",
  }[status];

  return (
    <section className="demo-shell">
      <section className="voice-stage voice-stage--hero">
        <div className="voice-center">
          <span className="voice-halo voice-halo--one" aria-hidden="true" />
          <span className="voice-halo voice-halo--two" aria-hidden="true" />
          <button
            type="button"
            className={`voice-trigger voice-trigger--${status}`}
            onClick={startVoiceCapture}
            disabled={status === "listening" || status === "sending" || status === "responding"}
          >
            <span className="voice-orb" aria-hidden="true" />
          </button>
        </div>
        <div className="status-row">
          {status !== "idle" ? <p className="status-pill">{statusLabel}</p> : null}
          {liveTranscript ? (
            <p className="transcript-pill">“{liveTranscript}”</p>
          ) : null}
        </div>
      </section>

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
    </section>
  );
}
