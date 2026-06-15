import { useEffect, useRef, useState } from "react";

export function useWebSocket(url) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    const token = localStorage.getItem("token");
    const wsUrl = `${url}?token=${token}`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000); // auto-reconnect
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setMessages((prev) => [data, ...prev].slice(0, 100));
        } catch {}
      };
    }

    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [url]);

  return { messages, connected };
}
