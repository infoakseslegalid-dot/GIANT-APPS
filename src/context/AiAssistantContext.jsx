import { createContext, useContext, useState, useCallback, useMemo } from "react";
import AiAssistantPanel from "@/components/ai/AiAssistantPanel";

/**
 * State global untuk panel "Tanya AI".
 *
 * - openForBoard(boardId, boardName) → panel dengan konteks seluruh board.
 * - openForCard(workItemId, cardTitle) → panel dengan konteks satu kartu + lampiran.
 * - close() → tutup.
 *
 * Provider ini sekaligus me-render <AiAssistantPanel/> sekali, jadi cukup
 * dibungkus di App.js dan komponen mana pun tinggal panggil useAiAssistant().
 */
const AiAssistantContext = createContext(null);

export function AiAssistantProvider({ children }) {
  const [scope, setScope] = useState(null); // { type, boardId?, workItemId?, title }

  const openForBoard = useCallback((boardId, boardName) => {
    if (!boardId) return;
    setScope({ type: "board", boardId, title: boardName || "Board" });
  }, []);

  const openForCard = useCallback((workItemId, cardTitle) => {
    if (!workItemId) return;
    setScope({ type: "card", workItemId, title: cardTitle || "Kartu" });
  }, []);

  const close = useCallback(() => setScope(null), []);

  const value = useMemo(
    () => ({ scope, open: !!scope, openForBoard, openForCard, close }),
    [scope, openForBoard, openForCard, close],
  );

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
      <AiAssistantPanel />
    </AiAssistantContext.Provider>
  );
}

export function useAiAssistant() {
  return useContext(AiAssistantContext) || {
    scope: null,
    open: false,
    openForBoard: (_boardId, _boardName) => {},
    openForCard: (_workItemId, _cardTitle) => {},
    close: () => {},
  };
}
