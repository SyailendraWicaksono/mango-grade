import React, { useRef, useState, useEffect } from "react";

const PREDICT_API = "http://127.0.0.1:8000/predict"; // ubah jika backend berbeda

export default function MangoSizeDashboard() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const graphRef = useRef(null);

  const [hasCam, setHasCam] = useState(false);
  const [streamRunning, setStreamRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]); // [{label,confidence,ts}]
  const [error, setError] = useState("");

  // Start webcam
  useEffect(() => {
    let stream;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setHasCam(true);
          setStreamRunning(true);
        }
      } catch (err) {
        console.warn("Camera error:", err);
        setError("Tidak dapat mengakses kamera. Periksa izin browser.");
        setHasCam(false);
      }
    }
    start();
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      setStreamRunning(false);
    };
  }, []);

  // Draw simple history graph on canvas (confidence of last N results)
  useEffect(() => {
    const c = graphRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const w = c.width = c.clientWidth * devicePixelRatio;
    const h = c.height = c.clientHeight * devicePixelRatio;
    ctx.clearRect(0,0,w,h);
    // background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);

    if (history.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = `${12 * devicePixelRatio}px sans-serif`;
      ctx.fillText("Belum ada hasil", 10 * devicePixelRatio, 20 * devicePixelRatio);
      return;
    }

    // map confidences to points
    const pad = 10 * devicePixelRatio;
    const maxPoints = 40;
    const arr = history.slice(-maxPoints);
    const step = (w - pad*2) / Math.max(1, arr.length - 1);
    ctx.beginPath();
    ctx.strokeStyle = "#2b7cff";
    ctx.lineWidth = 2 * devicePixelRatio;
    for (let i=0;i<arr.length;i++){
      const x = pad + i*step;
      const y = pad + (1 - arr[i].confidence) * (h - pad*2);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // dots
    ctx.fillStyle = "#2b7cff";
    for (let i=0;i<arr.length;i++){
      const x = pad + i*step;
      const y = pad + (1 - arr[i].confidence) * (h - pad*2);
      ctx.beginPath();
      ctx.arc(x,y,3 * devicePixelRatio,0,Math.PI*2);
      ctx.fill();
    }
  }, [history]);

  function captureImageBlob() {
    // draw current video frame to hidden canvas and return blob
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return null;
    const ctx = c.getContext("2d");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return new Promise((resolve) => {
      c.toBlob(blob => resolve(blob), "image/jpeg", 0.9);
    });
  }

  async function handlePredict() {
    setError("");
    if (!streamRunning) {
      setError("Kamera tidak aktif.");
      return;
    }
    setLoading(true);
    try {
      const blob = await captureImageBlob();
      if (!blob) throw new Error("Gagal ambil gambar");
      const form = new FormData();
      form.append("file", blob, "capture.jpg");

      const res = await fetch(PREDICT_API, {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error ${res.status}: ${txt}`);
      }
      const json = await res.json();
      // normalize confidence between 0..1
      if (typeof json.confidence === "string") json.confidence = parseFloat(json.confidence);
      setResult(json);

      const rec = {
        label: json.label,
        confidence: Math.min(Math.max(Number(json.confidence) || 0, 0), 1),
        ts: Date.now(),
        probs: json.probs || {}
      };
      setHistory(h => [...h, rec].slice(-200));
    } catch (err) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setHistory([]);
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial, sans-serif", padding: 18 }}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>Mango Size Dashboard — Demo</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        {/* Left: Live cam and controls */}
        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ borderRadius: 6, overflow: "hidden", background: "#000", height: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} playsInline muted />
                {!hasCam && <div style={{ color: "#fff" }}>Camera not available</div>}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                <button onClick={handlePredict} disabled={loading} style={{ padding: "8px 12px" }}>
                  {loading ? "Predicting…" : "Predict (capture)"}
                </button>
                <button onClick={() => {
                  // toggle pause/play
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) { v.play(); setStreamRunning(true); } else { v.pause(); setStreamRunning(false); }
                }} style={{ padding: "8px 12px" }}>
                  {streamRunning ? "Pause" : "Play"}
                </button>
                <div style={{ marginLeft: "auto", color: "#666" }}>
                  {result ? `Last: ${result.label} ${(result.confidence*100).toFixed(1)}%` : "No predictions yet"}
                </div>
              </div>
            </div>

            {/* Right: sensor + compact info */}
            <aside style={{ width: 360 }}>
              <div style={{ padding: 10, borderRadius: 8, border: "1px solid #eee", marginBottom: 12 }}>
                <h4 style={{ margin: "0 0 8px 0" }}>Sensor Output</h4>
                <div style={{ fontSize: 14, color: "#444" }}>
                  <div>Gas: <strong>—</strong></div>
                  <div>Temperature: <strong>—</strong></div>
                  <div>Humidity: <strong>—</strong></div>
                  <small style={{ color: "#888" }}>Sensor live belum terhubung — ini placeholder.</small>
                </div>
              </div>

              <div style={{ padding: 10, borderRadius: 8, border: "1px solid #eee", marginBottom: 12 }}>
                <h4 style={{ margin: "0 0 8px 0" }}>Grafik Kematangan</h4>
                <canvas ref={graphRef} style={{ width: "100%", height: 120, background: "#fff", borderRadius: 6 }} />
                <div style={{ fontSize: 12, color: "#777", marginTop: 8 }}>
                  Confidence timeline (most recent at right)
                </div>
              </div>

              <div style={{ padding: 10, borderRadius: 8, border: "1px solid #eee" }}>
                <h4 style={{ margin: "0 0 6px 0" }}>Hasil Tes</h4>
                <div style={{ fontSize: 13, color: "#333" }}>
                  {history.length === 0 ? <div style={{ color: "#999" }}>Belum ada hasil</div> :
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {history.slice().reverse().map((h, idx) => (
                        <div key={idx} style={{ padding: "6px 0", borderBottom: "1px dashed #eee" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <div><strong>{h.label}</strong></div>
                            <div style={{ color: "#666" }}>{(h.confidence*100).toFixed(1)}%</div>
                          </div>
                          <div style={{ fontSize: 11, color: "#777" }}>{new Date(h.ts).toLocaleTimeString()}</div>
                        </div>
                      ))}
                    </div>
                  }
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(history, null, 2)); }} style={{ padding: "6px 8px" }}>Copy JSON</button>
                  <button onClick={clearHistory} style={{ padding: "6px 8px" }}>Clear</button>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Right column wide: bigger info card */}
        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Detail / Log</h3>
          <div style={{ fontSize: 13, color: "#444" }}>
            <div><strong>Last Result:</strong></div>
            {result ? (
              <div style={{ marginTop: 8 }}>
                <div><strong>Label:</strong> {result.label}</div>
                <div><strong>Confidence:</strong> {(result.confidence*100).toFixed(2)}%</div>
                <div style={{ marginTop: 6 }}>
                  <strong>Probs:</strong>
                  <pre style={{ background: "#fafafa", padding: 8 }}>{JSON.stringify(result.probs, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div style={{ color: "#888", marginTop: 6 }}>Belum ada prediksi. Klik Predict untuk mencoba.</div>
            )}
            {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}
          </div>
        </div>
      </div>

      {/* hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
