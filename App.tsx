
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, 
  Search, 
  Mic, 
  FileText, 
  Send, 
  X, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  LayoutDashboard, 
  ChevronRight,
  Paperclip,
  ShieldCheck,
  AlertCircle
} from "lucide-react";

// AI Tech Theme Colors - CUD & MED SAWA Identity
const THEME_BLUE_CUD = '#1E3A8A'; // Bleu Nuit (Points clés / Accentuation)
const THEME_ORANGE_SAWA = '#F97316'; // Orange MED SAWA (Titres / Call to Action)

interface ResponseContent {
  titre: string;
  paragraphes: string[];
  motsCles: string[];
  etapeSuivante: string;
  suggestions?: string[];
}

interface Message {
  id: string;
  structuredContent?: ResponseContent;
  rawText?: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: string;
  suggestions?: string[]; 
  isError?: boolean;
}

interface PillarData {
  title: string;
  description: string;
  detail: string;
  roi: string;
  icon: React.ReactNode;
}

// Audio Decoding Utilities
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const cleanJson = (text: string) => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
  }
  return cleaned.trim();
};

const HighlightText = ({ text, keywords, isClosing = false }: { text: string, keywords: string[], isClosing?: boolean }) => {
  if (!text) return null;
  
  // Handle Markdown bold first
  const processMarkdownBold = (input: string) => {
    const parts = input.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`bold-${i}`} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  if (!keywords || keywords.length === 0) return <>{processMarkdownBold(text)}</>;

  const escapedKeywords = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
  const mainParts = text.split(regex);

  return (
    <>
      {mainParts.map((part, i) => {
        const isKeyword = keywords.some(kw => kw.toLowerCase() === part.toLowerCase());
        if (isKeyword) {
          return (
            <span key={i} className="font-bold" style={{ color: isClosing ? THEME_ORANGE_SAWA : THEME_BLUE_CUD }}>
              {part}
            </span>
          );
        }
        return <React.Fragment key={i}>{processMarkdownBold(part)}</React.Fragment>;
      })}
    </>
  );
};

const FormatResponse = ({ content }: { content: ResponseContent }) => {
  const renderParagraph = (para: string, idx: number) => {
    const trimmed = para.trim();
    const bulletMatch = trimmed.match(/^([•\-\*])\s*(.*)/);
    const numberMatch = trimmed.match(/^(\d+)[\.\)]\s*(.*)/);

    if (bulletMatch) {
      return (
        <motion.div 
          key={idx} 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="text-[14px] sm:text-[15px] pl-6 sm:pl-7 relative leading-relaxed mb-3 sm:mb-4 text-slate-700 group/list"
        >
          <span className="absolute left-0 sm:left-1 top-0 text-orange-500 font-black text-lg sm:text-xl leading-none">•</span>
          <div className="inline-block">
            <HighlightText text={bulletMatch[2]} keywords={content.motsCles} />
          </div>
        </motion.div>
      );
    }

    if (numberMatch) {
      return (
        <motion.div 
          key={idx} 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="text-[14px] sm:text-[15px] pl-9 sm:pl-10 relative leading-relaxed mb-4 sm:mb-5 text-slate-700 group/list"
        >
          <span className="absolute left-0 top-0.5 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-100 text-orange-600 text-[10px] sm:text-[11px] font-black shadow-sm">
            {numberMatch[1]}
          </span>
          <div className="inline-block align-middle">
            <HighlightText text={numberMatch[2]} keywords={content.motsCles} />
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        key={idx} 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: idx * 0.1 }}
        className="text-[14px] sm:text-[15px] text-justify sm:text-left leading-relaxed mb-4 sm:mb-6 text-slate-700"
      >
        <HighlightText text={para} keywords={content.motsCles} />
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-1 sm:gap-2 font-normal">
      {content.titre && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <h4 className="text-lg sm:text-xl font-bold tracking-tight uppercase border-l-4 border-orange-500 pl-3 sm:pl-4 py-0.5 sm:py-1" style={{ color: THEME_ORANGE_SAWA }}>
            {content.titre}
          </h4>
        </motion.div>
      )}
      
      <div className="flex flex-col">
        {content.paragraphes.map((para, idx) => renderParagraph(para, idx))}
      </div>

      {content.etapeSuivante && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 sm:mt-6 p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl shadow-inner"
        >
          <div className="flex items-start gap-3 sm:gap-4">
             <div className="mt-0.5 sm:mt-1 flex-none w-5 h-5 sm:w-6 sm:h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg">→</div>
             <p className="text-xs sm:text-sm font-medium italic text-slate-600 leading-relaxed">
               <HighlightText text={content.etapeSuivante} keywords={content.motsCles} isClosing={true} />
             </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const PillarCard: React.FC<{ pillar: PillarData; onClick: (pillar: PillarData) => void }> = ({ pillar, onClick }) => {
  return (
    <motion.div 
      whileHover={{ y: -4, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(pillar)} 
      className="group relative bg-white rounded-xl p-4 sm:p-5 flex flex-col justify-between cursor-pointer border border-slate-100 hover:border-blue-900 overflow-hidden min-h-[120px] sm:min-h-[140px]"
    >
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <div className="text-blue-900 group-hover:text-orange-600 transition-colors">
             {pillar.icon}
          </div>
          <span className="text-[7px] sm:text-[8px] font-black text-white bg-blue-900 px-1.5 sm:px-2 py-0.5 rounded shadow-sm tracking-widest">{pillar.roi}</span>
        </div>
        <h3 className="font-heading font-bold text-xs sm:text-sm mb-1 text-blue-950 group-hover:text-orange-600 transition-colors uppercase">{pillar.title}</h3>
        <p className="text-slate-500 text-[9px] sm:text-[10px] leading-tight font-medium line-clamp-2 sm:line-clamp-3">{pillar.description}</p>
      </div>
    </motion.div>
  );
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false); 
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'audit'>('chat'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true); // Sidebar toggle
  const [sessionRecordId, setSessionRecordId] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(`SESS_${Date.now()}`);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const currentPlayingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const recognitionRef = useRef<any>(null);

  // Airtable Sync Helpers
  const syncConversationToAirtable = async (lang: string) => {
    try {
      const res = await fetch("/api/airtable/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            "fldsAweUhC6u2y9ny": sessionIdRef.current,
            "fldfbaSIUb8KUZD9w": "douliacameroun@gmail.com",
            "fldMLk3YUmBxrlc3M": new Date().toISOString(),
            "fldRe7vGOJjO964at": lang === "en" ? "Anglais" : "Français",
            "fld7Rhw5t8ggDZavZ": "Audit Stratégique"
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSessionRecordId(data.id);
        return data.id;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Airtable sync error:", err.details || err.error || res.statusText);
      }
    } catch (e) {
      console.error("Airtable Sync Network Error", e);
    }
    return null;
  };

  const syncMessageToAirtable = async (msg: Message, recordId: string) => {
    try {
      await fetch("/api/airtable/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            "fldlajUqqcoCMBE6I": msg.id,
            "fldJIozHwNOP8sPQh": [recordId],
            "fldDSeY1fWkfCtjEO": msg.sender === 'user' ? "User" : (msg.sender === 'ai' ? "Doulia" : "Système"),
            "flduQMPHSGJHJO9ym": msg.rawText || "",
            "fldAfgHP5n7PAsIg4": msg.structuredContent ? JSON.stringify(msg.structuredContent) : "",
            "fldzHdgZ7eTKEuBAp": new Date().toISOString()
          }
        })
      });
    } catch (e) { console.error("Msg Sync Error", e); }
  };
  const pillars: PillarData[] = [
    { 
      title: 'Bureautique IA / Office AI', 
      description: 'Réduction des files d\'attente et service 24/7. / Reducing queues and 24/7 service.', 
      detail: 'Efficacité opérationnelle.', 
      roi: 'SERVICE 24/7',
      icon: <FileText size={20} />
    },
    { 
      title: 'Fiscalité / Taxation', 
      description: 'Optimisation de la collecte des recettes. / Revenue collection optimization.', 
      detail: 'Recouvrement intelligent.', 
      roi: 'RECETTES',
      icon: <ShieldCheck size={20} />
    },
    { 
      title: 'Pilotage Urbain / Urban Steering', 
      description: 'Analyse des réclamations voirie/salubrité. / Analyzing road/sanitation complaints.', 
      detail: 'Gestion réactive.', 
      roi: 'URBANISME',
      icon: <LayoutDashboard size={20} />
    },
  ];

  const stopAllAudio = useCallback(() => {
    currentPlayingSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    currentPlayingSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const playAudioResponse = useCallback(async (text: string) => {
    // TTS disabled as we moved to proxy server for Gemini
    // To restore, implement a TTS proxy or initialize GoogleGenAI securely
  }, []);

  const handleSendMessage = useCallback(async (text: string, file?: File | null) => {
    const targetFile = file || selectedFile;
    if (!text.trim() && !targetFile) return;
    
    setIsAnalyzing(true);
    setErrorNotification(null);
    const userMsg: Message = { 
      id: `u-${Date.now()}`, 
      rawText: text || (targetFile ? `Audit document : ${targetFile.name}` : ''), 
      sender: 'user', 
      timestamp: new Date().toLocaleTimeString() 
    };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setSelectedFile(null);

    // Initial Airtable Sync if first message
    let currentRecordId = sessionRecordId;
    if (!currentRecordId) {
      currentRecordId = await syncConversationToAirtable("fr");
    }
    if (currentRecordId) {
      syncMessageToAirtable(userMsg, currentRecordId);
    }

    try {
      // Check if web search is needed
      let contextFromWeb = "";
      const searchKeywords = ["quelles sont", "qui est", "actualité", "météo", "prix", "recherche", "web", "internet"];
      const needsSearch = searchKeywords.some(kw => text.toLowerCase().includes(kw));

      if (needsSearch) {
        try {
          const searchRes = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: text }),
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            contextFromWeb = "\n\nCONTEXTE WEB (Tavily) : " + JSON.stringify(searchData.results);
          }
        } catch (searchError) {
          console.error("Search failed, continuing with Gemini only", searchError);
        }
      }

      // Prepare payload for backend
      const rawContents = newMessages
        .filter(m => m.sender !== 'system')
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: (m.rawText || (m.structuredContent ? JSON.stringify(m.structuredContent) : '')) + (m.id === userMsg.id ? contextFromWeb : '') }]
        }));

      // Merge consecutive same roles or filter to ensure alternating user/model
      const contents: any[] = [];
      rawContents.forEach((msg) => {
        if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
          contents[contents.length - 1].parts[0].text += "\n" + msg.parts[0].text;
        } else {
          contents.push(msg);
        }
      });

      // Ensure it starts with 'user'
      if (contents.length > 0 && contents[0].role === 'model') {
        contents.shift();
      }

      if (contents.length === 0) return;

      if (targetFile) {
        const part = await fileToGenerativePart(targetFile);
        // Add file part to the last message parts list
        contents[contents.length - 1].parts.push({
          inline_data: part.inlineData
        } as any);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contents }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || "Erreur de communication avec Doulia.");
      }

      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(cleanJson(aiText));
      
      const aiMsg: Message = { 
        id: `ai-${Date.now()}`, 
        structuredContent: parsed, 
        sender: 'ai', 
        timestamp: new Date().toLocaleTimeString(), 
        suggestions: parsed.suggestions 
      };
      setMessages(prev => [...prev, aiMsg]);

      // Final persistence
      if (currentRecordId) {
        syncMessageToAirtable(aiMsg, currentRecordId);
      }
      
      const ttsText = `${parsed.titre}. ${parsed.paragraphes.join('. ')}. ${parsed.etapeSuivante}`;
      playAudioResponse(ttsText);

    } catch (e: any) {
      console.error(e);
      const errorText = "Doulia est momentanément hors ligne. Vérifiez votre configuration AI_PRO_KEY.";
      setErrorNotification(errorText);
      setMessages(prev => [...prev, { 
        id: `err-${Date.now()}`, 
        rawText: errorText, 
        sender: 'system', 
        timestamp: new Date().toLocaleTimeString(),
        isError: true 
      }]);
    } finally { setIsAnalyzing(false); }
  }, [playAudioResponse, selectedFile, messages, sessionRecordId]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'fr-FR'; 

      recognition.onstart = () => {
        setIsRecording(true);
        stopAllAudio();
      };
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
        setErrorNotification("Échec micro / Microphone failure. Please check your settings.");
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) handleSendMessage(transcript);
      };
      recognitionRef.current = recognition;
    }
  }, [handleSendMessage, stopAllAudio]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        setErrorNotification("La reconnaissance vocale n'est pas supportée. / Speech recognition not supported.");
        return;
      }
      recognitionRef.current.start();
    }
  };

  useEffect(() => {
    outputAudioContextRef.current = new window.AudioContext({ sampleRate: 24000 });
    
    const initChat = async () => {
      try {
        const welcomeTitle = "Note de Cadrage : Partenariat Stratégique MED SAWA - CUD";
        const welcomeParas = [
          "Bonjour ! Je suis Doulia, l'agent bilingue de MED SAWA au service de la Communauté Urbaine de Douala.",
          "Hello! I am Doulia, your bilingual agent from MED SAWA serving the Douala City Council.",
          "Mon rôle est de vous accompagner dans l'audit de notre partenariat stratégique. Voici nos priorités :",
          "- Optimisation bureautique par l'IA / AI Office Optimization.",
          "- Fiscalité locale et recouvrement / Local taxation and collection.",
          "- Pilotage urbain et salubrité / Urban steering and sanitation."
        ];
        const nextStep = "Je lirai toujours l'intégralité de mes réponses pour votre confort. Comment puis-je vous aider ?";
        
        const welcomeParsed: ResponseContent = {
          titre: welcomeTitle,
          paragraphes: welcomeParas,
          motsCles: ["MED SAWA", "CUD", "Douala", "Audit"],
          etapeSuivante: nextStep,
          suggestions: ["Détails fiscalité", "Analyse urbaine", "Optimisation IA"]
        };

        setMessages([{ 
          id: 'welcome', 
          structuredContent: welcomeParsed, 
          sender: 'ai', 
          timestamp: new Date().toLocaleTimeString(), 
          suggestions: welcomeParsed.suggestions 
        }]);
        
        const ttsText = `${welcomeTitle}. ${welcomeParas.join('. ')}. ${nextStep}`;
        playAudioResponse(ttsText);
      } catch (e) { 
        console.error("Init error", e); 
        setErrorNotification("Initialisation de l'audio en cours...");
      }
    };
    initChat();
  }, [playAudioResponse]);

  useEffect(() => { if (chatMessagesRef.current) chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight; }, [messages]);

  return (
    <div className="h-screen flex flex-col font-sans bg-slate-50 overflow-hidden relative">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100/10 via-white to-orange-100/10"></div>
      
      {/* ERROR TOAST */}
      <AnimatePresence>
        {errorNotification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-20 right-4 left-4 sm:left-auto sm:right-6 z-[60]"
          >
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-2xl flex items-center gap-4">
               <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                 <AlertCircle size={18} />
               </div>
               <p className="text-xs sm:text-sm font-medium text-red-800 flex-1">{errorNotification}</p>
               <button onClick={() => setErrorNotification(null)} className="text-red-400 hover:text-red-600 transition-colors">
                 <X size={18} />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER COMPACT */}
      <header className="relative z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 sm:px-8 py-3 sm:py-5 flex items-center justify-between shadow-sm flex-none">
        <div className="flex items-center gap-3 sm:gap-5">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex items-center justify-center p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all active:scale-90"
              title={isSidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              <LayoutDashboard size={22} className={isSidebarOpen ? "text-orange-500" : ""} />
            </button>
            <img src="https://douala.cm/assets/images/logo_cud.png" alt="CUD" className="h-10 sm:h-14 w-auto object-contain drop-shadow-sm" />
            <div className="h-8 sm:h-10 w-px bg-slate-200"></div>
            <div className="flex flex-col" id="app-header-title">
              <h1 className="text-[10px] sm:text-[13px] font-black text-blue-900 tracking-tighter uppercase leading-none mb-1">
                ASSISTANT MED SAWA
              </h1>
              <span className="text-[8px] sm:text-[10px] font-bold text-orange-500 uppercase tracking-widest leading-none">DOULIA</span>
            </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
             {isSpeaking && (
               <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-orange-100 rounded-full border border-orange-200">
                  <div className="flex gap-0.5 items-center justify-center h-3">
                    <span className="w-0.5 h-full bg-orange-600 rounded-full animate-voice-bar"></span>
                    <span className="w-0.5 h-full bg-orange-600 rounded-full animate-voice-bar [animation-delay:0.2s]"></span>
                    <span className="w-0.5 h-full bg-orange-600 rounded-full animate-voice-bar [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-[6px] sm:text-[8px] font-black text-orange-600 uppercase hidden xs:inline">Lecture en cours</span>
               </div>
             )}
             <div className="hidden sm:flex flex-col items-end">
                 <span className="text-[10px] font-black text-blue-950 uppercase">Session Stratégique</span>
                 <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest">Douala Secure Link</span>
             </div>
             <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-950 flex items-center justify-center text-white font-black text-[10px] sm:text-xs shadow-inner">MA</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10 p-2 sm:p-3 gap-3 pb-20 lg:pb-3">
        {/* SIDEBAR - AUDIT SCOPE - Visible desktop (if open) or when tab active */}
        <AnimatePresence mode="wait">
          {(isSidebarOpen || activeTab === 'audit') && (
            <motion.aside 
              initial={{ width: 0, opacity: 0, x: -50 }}
              animate={{ width: window.innerWidth >= 1024 ? 280 : "100%", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -50 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`${activeTab === 'audit' ? 'flex' : 'hidden'} lg:flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 h-full flex-none animate-fadeIn lg:animate-none z-40 bg-slate-50 lg:bg-transparent`}
            >
              <div className="bg-gradient-to-br from-blue-950 to-blue-900 text-white p-4 rounded-xl shadow-lg relative overflow-hidden flex-none">
                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full -mr-10 -mt-10"></div>
                <h3 className="font-bold text-[10px] mb-1.5 flex items-center gap-2 relative z-10 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    AUDIT SCOPE
                </h3>
                <p className="text-[8px] opacity-80 leading-snug font-medium uppercase tracking-wider">PHASE 1: STRATÉGIE</p>
              </div>
              
              <div className="flex-1 space-y-2">
                {pillars.map((p, idx) => (
                  <PillarCard 
                    key={idx} 
                    pillar={p} 
                    onClick={(pill) => {
                      handleSendMessage(`Détaille cet axe : ${pill.title}`);
                      if (window.innerWidth < 1024) setActiveTab('chat');
                    }} 
                  />
                ))}
              </div>
    
              <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm flex-none">
                 <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <ShieldCheck size={10} />
                   QUARTIERS PRIORITAIRES
                 </h4>
                 <div className="grid grid-cols-3 gap-1">
                    {['Akwa', 'New Bell', 'Bonanjo', 'Deido', 'Bépanda', 'Bonabéri', 'Bonamoussadi', 'PK 14', 'Kotto'].map(q => (
                      <span key={q} className="text-[7px] font-bold bg-slate-50 border border-slate-100 text-slate-600 py-1 rounded flex items-center justify-center text-center">{q}</span>
                    ))}
                 </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* SECTION CHAT */}
        <section className={`${activeTab === 'chat' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden h-full relative animate-fadeIn lg:animate-none`}>
          
          <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-20 flex-none">
            <h2 className="text-[8px] sm:text-[9px] font-medium text-blue-950 flex items-center gap-2 leading-tight uppercase">
              <div className="w-2 h-2 rounded-full bg-orange-600 flex-none animate-pulse"></div>
              <span>
                <span className="text-orange-500 font-bold">MED SAWA</span> : Doulia (Direct)
              </span>
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={stopAllAudio} 
                className="p-1 sm:px-2 sm:py-1 rounded border border-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all active:scale-95"
                title="Arrêter la lecture"
              >
                {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button 
                onClick={() => setMessages([])} 
                className="p-1 sm:px-2 sm:py-1 rounded border border-slate-100 hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-all active:scale-95"
                title="Réinitialiser"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div ref={chatMessagesRef} className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar scroll-smooth space-y-4 sm:space-y-6 bg-[#F8FAFC]">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, scale: 0.98, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[95%] sm:max-w-[85%] px-4 py-4 sm:px-6 sm:py-6 rounded-xl sm:rounded-2xl transition-all shadow-sm ${
                    msg.sender === 'user' ? 'bg-[#1E3A8A] text-white rounded-br-none shadow-md' : 
                    msg.sender === 'system' ? 'bg-red-50 border border-red-100 text-red-700 italic' :
                    'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                  }`}>
                    {msg.sender === 'user' ? (
                      <p className="text-sm font-semibold leading-relaxed">{msg.rawText}</p>
                    ) : msg.structuredContent ? (
                      <FormatResponse content={msg.structuredContent} />
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.rawText}</p>
                    )}
                    <div className="flex items-center justify-between mt-4 sm:mt-6 pt-2 sm:pt-3 border-t border-slate-100 opacity-40">
                       <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-widest leading-none">
                         {msg.sender === 'user' ? 'CUD - Douala' : 
                          msg.sender === 'system' ? 'Alerte' : 'DOULIA EXPERTISE'}
                       </span>
                       <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-widest leading-none">{msg.timestamp}</span>
                    </div>
                  </div>
                  
                  {msg.sender === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                    <motion.div 
                      className="mt-3 sm:mt-4 flex flex-wrap gap-2 max-w-[95%]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {msg.suggestions.map((s, i) => (
                        <motion.button 
                          key={i} 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSendMessage(s)} 
                          className="bg-white border border-slate-200 text-slate-700 text-[8px] sm:text-[10px] font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg hover:border-orange-500 hover:text-orange-600 transition-all uppercase tracking-wide shadow-sm"
                        >
                          {s}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 text-slate-400 italic text-[10px] sm:text-[11px]"
              >
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-orange-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                Doulia prépare l'audit...
              </motion.div>
            )}
          </div>

          {/* INPUT AREA */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex-none z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
            <AnimatePresence>
              {selectedFile && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute -top-10 left-4 sm:left-6 bg-orange-600 text-white text-[8px] sm:text-[9px] font-bold py-1.5 px-4 rounded-t-lg flex items-center gap-2 shadow-lg border-b border-orange-700"
                >
                  <Paperclip size={12} />
                  <span className="truncate max-w-[150px]">{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="ml-1 hover:text-black">
                    <X size={12} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex gap-2 sm:gap-3 items-center">
              <div className="flex-1 relative flex items-center">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute left-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-900 transition-all"
                  title="Charger un document"
                >
                  <Paperclip size={18} />
                </button>

                <input 
                  type="text" 
                  value={inputMessage} 
                  onChange={(e) => setInputMessage(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputMessage)}
                  placeholder="VOTRE QUESTION..." 
                  className="w-full h-10 sm:h-12 pl-10 sm:pl-12 pr-10 sm:pr-12 border-2 border-slate-100 rounded-xl sm:rounded-2xl focus:border-orange-500 outline-none text-xs sm:text-sm bg-slate-50 transition-all font-medium text-slate-800 placeholder:text-[8px] sm:placeholder:text-[9px] placeholder:font-black placeholder:tracking-widest"
                />

                <button 
                  onClick={toggleRecording}
                  className={`absolute right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'text-slate-400 hover:text-orange-600'}`}
                >
                  <Mic size={18} />
                </button>
              </div>

              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSendMessage(inputMessage)} 
                disabled={isAnalyzing}
                className={`h-10 w-10 sm:h-12 sm:px-6 rounded-xl sm:rounded-2xl text-white font-black text-[10px] shadow-lg flex items-center justify-center transition-all ${
                  isAnalyzing 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-[#1E3A8A] hover:bg-[#F97316]'
                }`}
              >
                <span className="hidden sm:inline">ANALYSER</span>
                <Send size={16} className="sm:hidden" />
              </motion.button>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} 
              accept="image/*,application/pdf" 
            />
          </div>
        </section>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 lg:hidden flex justify-around items-center h-16 px-4 pb-[env(safe-area-inset-bottom)]">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'chat' ? 'text-orange-500' : 'text-slate-400 opacity-60'}`}
        >
          <div className={`p-2 rounded-xl ${activeTab === 'chat' ? 'bg-orange-50' : ''}`}>
            <MessageSquare size={20} />
          </div>
          <span className="text-[8px] font-black uppercase tracking-tighter">Diagnostic</span>
        </button>
        
        <div className="h-8 w-px bg-slate-100"></div>

        <button 
          onClick={() => setActiveTab('audit')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'audit' ? 'text-blue-900' : 'text-slate-400 opacity-60'}`}
        >
          <div className={`p-2 rounded-xl ${activeTab === 'audit' ? 'bg-blue-50' : ''}`}>
            <Search size={20} />
          </div>
          <span className="text-[8px] font-black uppercase tracking-tighter">Piliers Audit</span>
        </button>
      </nav>

      <footer className="hidden sm:flex px-8 py-3 bg-white/50 border-t border-slate-50 items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest flex-none relative z-30"> 
        <div className="flex gap-6">
          <span>Souveraineté : MED SAWA x CUD</span>
          <span className="text-orange-500">Expertise Douala Smart City</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          <span>Système Opérationnel</span>
        </div>
        <span>© 2026 DOULIA</span>
      </footer>
    </div>
  );
};

export default App;
