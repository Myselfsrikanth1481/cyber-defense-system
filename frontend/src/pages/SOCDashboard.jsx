
import { useState } from "react";
import { sendRequest } from "../services/api";

function SOCDashboard() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    try {
      const res = await sendRequest({ data: input });
      setResult(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: "20px", color: "white" }}>
      <h1>🛡️ SOC Dashboard</h1>

      {/* Input */}
      <div style={{ marginTop: "20px" }}>
        <input
          placeholder="Enter request / payload"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button onClick={handleAnalyze}>Analyze</button>
      </div>

      {/* Result */}
      {result && (
        <div style={{ marginTop: "20px" }}>
          <h3>Detection Result:</h3>
          <p style={{ color: result.status === "attack" ? "red" : "green" }}>
            {result.status}
          </p>
        </div>
      )}
    </div>
  );
}

export default SOCDashboard;