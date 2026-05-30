import { useState, useRef, useCallback, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

interface SteamApp {
  appid: number;
  name: string;
  img: string;
  price: string;
}

type ProtocolKind = "steam" | "web" | "ai";

interface Protocol {
  id: string;
  aliases: string[];
  name: string;
  favicon: string;
  faviconFilter?: string;
  color: string;
  kind: ProtocolKind;
  rawUrl?: string;
  copyQuery?: boolean;
  buildUrl: (query: string) => string;
  placeholder?: string;
}

const FaviconIcon = ({ domain, filter }: { domain: string; filter?: string }) => (
  <img
    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
    alt=""
    className="w-4 h-4 rounded-sm object-contain shrink-0"
    style={filter ? { filter } : undefined}
  />
);

const WIKI_LANGS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
];

const PROTOCOLS: Protocol[] = [
  {
    id: "google",
    aliases: ["g"],
    name: "Google",
    favicon: "google.com",
    color: "#4285F4",
    kind: "web",
    rawUrl: "https://www.google.com/",
    buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    placeholder: "Rechercher sur Google…",
  },
  {
    id: "duckduckgo",
    aliases: ["ddg", "duck"],
    name: "DuckDuckGo",
    favicon: "duckduckgo.com",
    color: "#DE5833",
    kind: "web",
    rawUrl: "https://duckduckgo.com/",
    buildUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    placeholder: "Rechercher sur DuckDuckGo…",
  },
  {
    id: "chatgpt",
    aliases: ["gpt", "openai"],
    name: "ChatGPT",
    favicon: "chatgpt.com",
    color: "#10a37f",
    kind: "ai",
    rawUrl: "https://chatgpt.com/",
    buildUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    placeholder: "Tapez votre prompt…",
  },
  {
    id: "claude",
    aliases: ["anthropic"],
    name: "Claude",
    favicon: "claude.ai",
    color: "#D97757",
    kind: "ai",
    rawUrl: "https://claude.ai/",
    buildUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    placeholder: "Tapez votre prompt…",
  },
  {
    id: "perplexity",
    aliases: ["perp"],
    name: "Perplexity",
    favicon: "perplexity.ai",
    color: "#20B8CD",
    kind: "web",
    rawUrl: "https://www.perplexity.ai/",
    buildUrl: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
    placeholder: "Poser une question…",
  },
  {
    id: "youtube",
    aliases: ["yt", "y"],
    name: "YouTube",
    favicon: "youtube.com",
    color: "#FF0000",
    kind: "web",
    rawUrl: "https://www.youtube.com/",
    buildUrl: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    placeholder: "Rechercher sur YouTube…",
  },
  {
    id: "github",
    aliases: ["gh"],
    name: "GitHub",
    favicon: "github.com",
    faviconFilter: "invert(1) brightness(0.9)",
    color: "#24292e",
    kind: "web",
    rawUrl: "https://github.com/",
    buildUrl: (q) => `https://github.com/search?q=${encodeURIComponent(q)}`,
    placeholder: "Rechercher sur GitHub…",
  },
  {
    id: "wikipedia",
    aliases: ["wiki", "wp", "w"],
    name: "Wikipedia",
    favicon: "wikipedia.org",
    color: "#3366cc",
    kind: "web",
    rawUrl: "https://wikipedia.org/",
    buildUrl: (q) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
    placeholder: "Rechercher sur Wikipedia…",
  },
  {
    id: "steam",
    aliases: ["s"],
    name: "Steam",
    favicon: "store.steampowered.com",
    color: "#1b2838",
    kind: "steam",
    rawUrl: "steam:launchapp",
    buildUrl: (appId) => `steam://rungameid/${appId}`,
    placeholder: "Tapez un nom de jeu…",
  },
];

function resolveProtocol(input: string): Protocol | null {
  const q = input.trim().toLowerCase();
  return (
    PROTOCOLS.find(
      (p) => p.id === q || p.name.toLowerCase() === q || p.aliases.includes(q),
    ) ?? null
  );
}

interface Chip {
  protocol: Protocol;
}

async function searchSteam(query: string): Promise<SteamApp[]> {
  const res = await fetch(
    `/api/steam/search?q=${encodeURIComponent(query)}&limit=8`,
  );
  if (!res.ok) throw new Error("Search failed");
  const data = (await res.json()) as { results: SteamApp[] };
  return data.results;
}

export default function App() {
  const [chip, setChip] = useState<Chip | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [shake, setShake] = useState(false);
  const [suggestions, setSuggestions] = useState<SteamApp[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wikiLang, setWikiLang] = useState<string>(
    () => localStorage.getItem("wikiLang") ?? "fr",
  );
  const [defaultProtocolId, setDefaultProtocolId] = useState<string>(
    () => localStorage.getItem("defaultProtocol") ?? "duckduckgo",
  );
  const wikiLangRef = useRef(wikiLang);
  const defaultProtocolIdRef = useRef(defaultProtocolId);
  useEffect(() => { wikiLangRef.current = wikiLang; }, [wikiLang]);
  useEffect(() => { defaultProtocolIdRef.current = defaultProtocolId; }, [defaultProtocolId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const removeChip = useCallback(() => {
    setChip(null);
    setStatus(null);
    setSuggestions([]);
    setSelectedIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const launchWeb = useCallback(
    (protocol: Protocol, query: string) => {
      const url = !query && protocol.rawUrl
        ? protocol.rawUrl
        : protocol.id === "wikipedia"
          ? `https://${wikiLangRef.current}.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`
          : protocol.buildUrl(query);
      if (protocol.copyQuery && query) {
        navigator.clipboard.writeText(query).catch(() => {});
        setStatus({
          type: "success",
          message: `Opening ${protocol.name} — prompt copied to clipboard`,
        });
      } else {
        setStatus({ type: "success", message: `Opening ${protocol.name}…` });
      }
      setSuggestions([]);
      setTimeout(() => {
        window.open(url, "_blank");
      }, 120);
    },
    [],
  );

  const launchSteam = useCallback(
    (app: SteamApp, protocol: Protocol) => {
      const url = protocol.buildUrl(String(app.appid));
      setStatus({
        type: "success",
        message: `Launching ${app.name} — ${url}`,
      });
      setSuggestions([]);
      setInputValue(app.name);
      setSelectedIndex(-1);
      setTimeout(() => {
        window.location.href = url;
      }, 150);
    },
    [],
  );

  useEffect(() => {
    if (!chip || chip.protocol.kind !== "steam" || !inputValue.trim()) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchSteam(inputValue);
        setSuggestions(results);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 220);
  }, [inputValue, chip]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Escape") {
        setSuggestions([]);
        setSelectedIndex(-1);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (chip) return;
        const proto = resolveProtocol(inputValue);
        if (proto) {
          setChip({ protocol: proto });
          setInputValue("");
          setStatus(null);
          setSuggestions([]);
        } else if (inputValue.trim()) {
          setStatus({
            type: "error",
            message: `"${inputValue.trim()}" inconnu. Essayez : ${PROTOCOLS.map((p) => p.id).join(", ")}`,
          });
          triggerShake();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();

        if (!chip) {
          const proto = resolveProtocol(inputValue);
          if (proto) {
            setChip({ protocol: proto });
            setInputValue("");
            setStatus(null);
          } else if (inputValue.trim()) {
            const def = PROTOCOLS.find((p) => p.id === defaultProtocolIdRef.current);
            if (def) {
              launchWeb(def, inputValue.trim());
            } else {
              setStatus({
                type: "error",
                message: `Protocole inconnu. Essayez : ${PROTOCOLS.map((p) => p.id).join(", ")}`,
              });
              triggerShake();
            }
          }
          return;
        }

        const query = inputValue.trim();

        if (chip.protocol.kind === "steam") {
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            launchSteam(suggestions[selectedIndex], chip.protocol);
            return;
          }
          if (suggestions.length > 0) {
            launchSteam(suggestions[0], chip.protocol);
            return;
          }
          const numericId = parseInt(query, 10);
          if (!isNaN(numericId) && numericId > 0) {
            const url = chip.protocol.buildUrl(String(numericId));
            setStatus({
              type: "success",
              message: `Launching app ID ${numericId} — ${url}`,
            });
            setTimeout(() => {
              window.location.href = url;
            }, 150);
            return;
          }
          if (query) {
            setStatus({
              type: "error",
              message: `Aucun jeu trouvé pour "${query}".`,
            });
            triggerShake();
          }
          return;
        }

        launchWeb(chip.protocol, query);
        return;
      }

      if (e.key === "Backspace" && inputValue === "" && chip) {
        removeChip();
      }
    },
    [chip, inputValue, suggestions, selectedIndex, removeChip, triggerShake, launchSteam, launchWeb],
  );

  const placeholder =
    chip?.protocol.placeholder ??
    (chip ? "Tapez votre recherche…" : "Tapez un service (google, chatgpt…) et appuyez sur Tab…");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f12] px-4"
      onClick={() => {
        setSuggestions([]);
        setSelectedIndex(-1);
      }}
    >
      <div
        className="w-full max-w-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-8">
          <p className="text-zinc-500 text-sm tracking-widest uppercase font-medium select-none">
            Launcher
          </p>
        </div>

        <div className="relative">
          <div
            className={`
              flex items-center gap-2 px-3 py-2.5
              bg-[#1a1a1f] border border-zinc-700/60 rounded-xl
              focus-within:border-zinc-500/80 focus-within:bg-[#1e1e24]
              transition-all duration-200 shadow-lg cursor-text
              ${shake ? "animate-shake" : ""}
            `}
            onClick={() => inputRef.current?.focus()}
          >
            {chip && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium shrink-0 select-none"
                style={{
                  backgroundColor: chip.protocol.color + "33",
                  color: "#e4e4e7",
                }}
              >
                <FaviconIcon domain={chip.protocol.favicon} filter={chip.protocol.faviconFilter} />
                <span>{chip.protocol.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip();
                  }}
                  className="ml-0.5 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                  tabIndex={-1}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setStatus(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 text-sm outline-none min-w-0"
              spellCheck={false}
              autoComplete="off"
            />

            <div className="flex gap-1.5 shrink-0 text-zinc-600 text-xs select-none items-center">
              {searching && (
                <Loader2 className="w-3.5 h-3.5 text-zinc-600 animate-spin" />
              )}
              {!chip && (
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">
                  Tab
                </kbd>
              )}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">
                ↵
              </kbd>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a1a1f] border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden z-10">
              {suggestions.map((app, i) => (
                <button
                  key={app.appid}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-left
                    transition-colors duration-100 group
                    ${i === selectedIndex ? "bg-zinc-700/40 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"}
                    ${i !== 0 ? "border-t border-zinc-800/60" : ""}
                  `}
                  onClick={() => chip && launchSteam(app, chip.protocol)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <img
                    src={app.img}
                    alt=""
                    className="w-10 h-[30px] rounded object-cover shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-zinc-600">ID {app.appid}</p>
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0">
                    {app.price}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {status && (
          <div
            className={`
              text-xs px-3 py-2 rounded-lg transition-all duration-200
              ${status.type === "error" ? "bg-red-900/30 text-red-400 border border-red-800/40" : ""}
              ${status.type === "success" ? "bg-green-900/30 text-green-400 border border-green-800/40" : ""}
              ${status.type === "info" ? "bg-zinc-800/50 text-zinc-400 border border-zinc-700/40" : ""}
              font-mono break-all
            `}
          >
            {status.message}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 justify-center mt-4">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setChip({ protocol: p });
                setInputValue("");
                setStatus(null);
                setSuggestions([]);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 hover:border-zinc-600/60 transition-all duration-150 select-none"
            >
              <FaviconIcon domain={p.favicon} filter={p.faviconFilter} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 select-none">
            <span>🌐 Wikipedia</span>
            <select
              value={wikiLang}
              onChange={(e) => {
                setWikiLang(e.target.value);
                localStorage.setItem("wikiLang", e.target.value);
              }}
              className="bg-zinc-800/60 border border-zinc-700/40 rounded px-1.5 py-0.5 text-zinc-400 text-xs focus:outline-none hover:border-zinc-600/60 transition-colors cursor-pointer"
            >
              {WIKI_LANGS.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-600 select-none">
            <span>⌨ Par défaut</span>
            <select
              value={defaultProtocolId}
              onChange={(e) => {
                setDefaultProtocolId(e.target.value);
                localStorage.setItem("defaultProtocol", e.target.value);
              }}
              className="bg-zinc-800/60 border border-zinc-700/40 rounded px-1.5 py-0.5 text-zinc-400 text-xs focus:outline-none hover:border-zinc-600/60 transition-colors cursor-pointer"
            >
              {PROTOCOLS.filter((p) => p.kind !== "steam").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 text-center text-zinc-700 text-xs select-none">
          <p>
            Tapez un service →{" "}
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 font-mono text-xs">
              Tab
            </kbd>{" "}
            → tapez votre recherche →{" "}
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 font-mono text-xs">
              Enter
            </kbd>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
