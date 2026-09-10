"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

// Check native support
function hasBarcodeDetector() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"requesting" | "scanning" | "error">("requesting");
  const [errorMsg, setErrorMsg] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const foundRef = useRef(false);

  useEffect(() => {
    foundRef.current = false;
    startCamera();
    return () => {
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("scanning");

        if (hasBarcodeDetector()) {
          startNativeDetection();
        } else {
          startQuaggaFallback();
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission")) {
        setErrorMsg("Permiso de cámara denegado. Habilitalo en la configuración del navegador.");
      } else {
        setErrorMsg("No se pudo acceder a la cámara.");
      }
      setStatus("error");
    }
  }

  function startNativeDetection() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({
      formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a"],
    });

    async function scan() {
      if (foundRef.current) return;
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0 && !foundRef.current) {
          foundRef.current = true;
          cleanup();
          onScan(barcodes[0].rawValue);
          return;
        }
      } catch {
        // ignore detection errors, keep scanning
      }
      rafRef.current = requestAnimationFrame(scan);
    }
    rafRef.current = requestAnimationFrame(scan);
  }

  function startQuaggaFallback() {
    // Canvas-based frame extraction for quagga2
    // We dynamically import to keep bundle small
    import("@ericblade/quagga2")
      .then(({ default: Quagga }) => {
        if (!videoRef.current) return;
        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: videoRef.current,
              constraints: { facingMode: "environment" },
            },
            decoder: {
              readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader"],
            },
            locate: true,
          },
          (err: unknown) => {
            if (err) {
              setErrorMsg("Error al iniciar el escáner.");
              setStatus("error");
              return;
            }
            Quagga.start();
          }
        );
        Quagga.onDetected((result: { codeResult: { code: string | null } }) => {
          if (!foundRef.current && result.codeResult.code) {
            foundRef.current = true;
            Quagga.stop();
            cleanup();
            onScan(result.codeResult.code);
          }
        });
      })
      .catch(() => {
        setErrorMsg("Escáner no disponible en este navegador. Ingresá el código manualmente.");
        setStatus("error");
      });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        zIndex: 500,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {status === "requesting" && (
        <div style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(255,255,255,0.3)",
              borderTopColor: "#E8680A",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          Iniciando cámara...
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📷</p>
          <p style={{ color: "#fff", fontSize: 15, marginBottom: 8 }}>{errorMsg}</p>
          <p style={{ color: "#A0AEC0", fontSize: 13, marginBottom: 20 }}>
            Los escáneres Bluetooth también funcionan — conectá uno y escaneá directamente en el buscador.
          </p>
          <button
            onClick={onClose}
            style={{
              background: "#E8680A",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Volver
          </button>
        </div>
      )}

      {status === "scanning" && (
        <>
          {/* Video feed */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 400,
              aspectRatio: "4/3",
              overflow: "hidden",
              borderRadius: 12,
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Aiming overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Corner marks */}
              {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => {
                const isTop = corner.includes("top");
                const isLeft = corner.includes("left");
                return (
                  <div
                    key={corner}
                    style={{
                      position: "absolute",
                      width: 32,
                      height: 32,
                      top: isTop ? "20%" : undefined,
                      bottom: !isTop ? "20%" : undefined,
                      left: isLeft ? "20%" : undefined,
                      right: !isLeft ? "20%" : undefined,
                      borderTop: isTop ? "3px solid #E8680A" : undefined,
                      borderBottom: !isTop ? "3px solid #E8680A" : undefined,
                      borderLeft: isLeft ? "3px solid #E8680A" : undefined,
                      borderRight: !isLeft ? "3px solid #E8680A" : undefined,
                    }}
                  />
                );
              })}

              {/* Scan line animation */}
              <div
                style={{
                  position: "absolute",
                  left: "20%",
                  right: "20%",
                  height: 2,
                  background: "rgba(232,104,10,0.8)",
                  animation: "scanLine 1.5s ease-in-out infinite",
                  top: "50%",
                }}
              />
            </div>
          </div>

          <p style={{ color: "#A0AEC0", fontSize: 14, marginTop: 20, textAlign: "center" }}>
            Apuntá la cámara al código de barras
          </p>

          <button
            onClick={onClose}
            style={{
              marginTop: 20,
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </>
      )}

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 22%; }
          50% { top: 78%; }
        }
      `}</style>
    </div>
  );
}
