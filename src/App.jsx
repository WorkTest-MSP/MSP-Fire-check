import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  History,
  Home,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";

import { Html5Qrcode } from "html5-qrcode";
const API_URL =
  "https://script.google.com/macros/s/AKfycbwPX70IpwywzumgNqCw75Ha2tF7Pw-gvX7uDebL4_AaIt00InrBt7ehgKRFyOwogAE/exec";

const CHECKLISTS = {
  "Dry Chemical": [
    "ถังอยู่ในตำแหน่งที่กำหนดและมีป้ายชี้บ่ง",
    "ตัวถังไม่มีรอยบุบ สนิม หรือการชำรุด",
    "เข็มเกจวัดแรงดันอยู่ในโซนสีเขียว",
    "สลักนิรภัยและซีลอยู่ในสภาพสมบูรณ์",
    "สายฉีดและหัวฉีดไม่แตก อุดตัน หรือผุกร่อน",
    "ไม่มีสิ่งกีดขวางและเข้าถึงได้ง่าย",
    "ฉลากและวิธีใช้มองเห็นและอ่านได้ชัดเจน",
    "ขายึดหรือตู้เก็บอยู่ในสภาพพร้อมใช้งาน",
    "ไม่พบความผิดปกติอื่นที่กระทบต่อการใช้งาน",
  ],

  CO2: [
    "ถังอยู่ในตำแหน่งที่กำหนดและมีป้ายชี้บ่ง",
    "ตัวถังไม่มีรอยบุบ สนิม หรือการชำรุด",
    "น้ำหนักปกติไม่เกิน 30Kg.",
    "สลักนิรภัยและซีลอยู่ในสภาพสมบูรณ์",
    "สายฉีดและกรวยฉีดไม่แตกหรืออุดตัน",
    "ไม่มีสิ่งกีดขวางและเข้าถึงได้ง่าย",
    "ฉลากและวิธีใช้มองเห็นและอ่านได้ชัดเจน",
    "ขายึดหรือตู้เก็บอยู่ในสภาพพร้อมใช้งาน",
    "ไม่พบความผิดปกติอื่นที่กระทบต่อการใช้งาน",
  ],
};

function StatusBadge({ status }) {
  const css =
    status === "PASS"
      ? "badge badge-pass"
      : status === "NG"
      ? "badge badge-ng"
      : "badge badge-pending";

  return <span className={css}>{status}</span>;
}

function StatCard({ title, value, type, icon: Icon }) {
  return (
    <div className={`stat-card stat-${type}`}>
      <div className="stat-icon">
        <Icon size={22} />
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-title">{title}</div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
const [logs, setLogs] = useState([]);

const [loading, setLoading] = useState(true);
const [syncMessage, setSyncMessage] = useState(
  "กำลังโหลดข้อมูล..."
);

  const [page, setPage] = useState("home");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);

  const [inspector, setInspector] = useState(
    localStorage.getItem("firecheck70_inspector") || ""
  );

  const [note, setNote] = useState("");

  const [cameraActive, setCameraActive] = useState(false);
  const [qrFallback, setQrFallback] = useState("");

  const scannerRef = useRef(null);
  const scannerRunningRef = useRef(false);

  const completed = items.filter(
    (item) => item.lastResult !== "PENDING"
  ).length;

  const ng = items.filter(
    (item) => item.lastResult === "NG"
  ).length;

  const pending = items.length - completed;

  const filteredItems = useMemo(() => {
    const text = search.toLowerCase().trim();

    if (!text) {
      return items;
    }

    return items.filter((item) =>
      [
        item.code,
        item.area,
        item.location,
        item.type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(text)
    );
  }, [items, search]);
  
function mapExtinguisher(row) {
  const code = String(
    row.Code ??
    row.code ??
    ""
  )
    .trim()
    .toUpperCase();

  const rawType = String(
    row.Type ??
    row.type ??
    ""
  ).trim();

  let type = rawType;

  if (
    rawType.toUpperCase() ===
    "DRY CHEMICAL"
  ) {
    type = "Dry Chemical";
  }

  if (
    rawType.toUpperCase() === "CO2"
  ) {
    type = "CO2";
  }

  return {
    code,

    type,

    size: String(
      row.Size ??
      row.size ??
      ""
    ).trim(),

    area: String(
      row.Area ??
      row.area ??
      ""
    ).trim(),

    location: String(
      row.Location ??
      row.location ??
      ""
    ).trim(),

    status: String(
      row.Status ??
      row.status ??
      "ACTIVE"
    ).trim(),

    lastResult: String(
      row.LastResult ??
      row.lastResult ??
      "PENDING"
    )
      .trim()
      .toUpperCase(),

    lastInspection:
      row.LastInspection ??
      row.lastInspection ??
      null,
  };
}

  function mapInspection(row) {
  let checklist = [];

  try {
    checklist = row.ChecklistJSON
      ? JSON.parse(row.ChecklistJSON)
      : [];
  } catch {
    checklist = [];
  }

  return {
    inspectionId:
      row.InspectionID || "",

    extinguisherCode:
      row.ExtinguisherCode || "",

    inspectedAt:
      row.InspectedAt || "",

    inspector:
      row.Inspector || "",

    result:
      row.Result || "",

    checklist,

    note:
      row.Note || "",
  };
}

async function loadOnlineData() {
  setLoading(true);
  setSyncMessage("กำลังโหลดข้อมูลออนไลน์...");

  try {
    const masterUrl =
      `${API_URL}?action=extinguishers`;

    const historyUrl =
      `${API_URL}?action=inspections`;

    const responses = await Promise.all([
      fetch(masterUrl, {
        cache: "no-store",
      }),

      fetch(historyUrl, {
        cache: "no-store",
      }),
    ]);

    const masterResponse =
      await responses[0].json();

    const historyResponse =
      await responses[1].json();

    if (!masterResponse.success) {
      throw new Error(
        masterResponse.message ||
        "Cannot load extinguishers"
      );
    }

    if (!historyResponse.success) {
      throw new Error(
        historyResponse.message ||
        "Cannot load inspections"
      );
    }

    const onlineItems =
      masterResponse.data
        .map(mapExtinguisher)
        .filter((item) => item.code);

    const onlineLogs =
      historyResponse.data
        .map(mapInspection);

    setItems(onlineItems);
    setLogs(onlineLogs);

    setSyncMessage(
      `เชื่อมต่อฐานข้อมูลแล้ว ${onlineItems.length} จุด`
    );
  } catch (error) {
    console.error(
      "Load online data error:",
      error
    );

    setSyncMessage(
      "โหลดข้อมูลออนไลน์ไม่สำเร็จ"
    );

    alert(
      "ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้ กรุณาตรวจสอบอินเทอร์เน็ตและ Apps Script API"
    );
  } finally {
    setLoading(false);
  }
}

  
  async function stopCamera() {
    const scanner = scannerRef.current;

    if (!scanner) {
      scannerRunningRef.current = false;
      setCameraActive(false);
      return;
    }

    try {
      if (scannerRunningRef.current) {
        await scanner.stop();
      }
    } catch (error) {
      console.log("Scanner stop:", error);
    }

    try {
      await scanner.clear();
    } catch (error) {
      console.log("Scanner clear:", error);
    }

    scannerRef.current = null;
    scannerRunningRef.current = false;
    setCameraActive(false);
  }

  function goToPage(nextPage) {
    stopCamera();
    setPage(nextPage);
  }

  function openInspection(item) {
  stopCamera();

  if (!item) {
    alert("ไม่พบข้อมูลถังดับเพลิง");
    return;
  }

  const checklist =
    CHECKLISTS[item.type];

  if (!checklist) {
    alert(
      `พบรหัส ${item.code} แต่ไม่พบ Checklist สำหรับ Type: [${item.type || "ไม่มีข้อมูล"}]`
    );
    return;
  }

  setSelected(item);

  setAnswers(
    checklist.map(() => null)
  );

  setNote("");

  setPage("inspection");
}

  function findExtinguisher(value) {
  if (!value) {
    alert("ไม่พบข้อมูลจาก QR Code");
    return;
  }

  const code = String(value)
    .trim()
    .toUpperCase();

  const item = items.find(
    (row) =>
      String(row.code || "")
        .trim()
        .toUpperCase() === code
  );

  if (!item) {
    alert(
      `ไม่พบรหัส ${code} ในทะเบียนถังดับเพลิง`
    );
    return;
  }

  openInspection(item);
}

  async function startCamera() {
    if (scannerRunningRef.current) {
      return;
    }

    try {
      const scanner = new Html5Qrcode("qr-reader");

      scannerRef.current = scanner;
      scannerRunningRef.current = true;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250,
          },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          if (!scannerRunningRef.current) {
            return;
          }

          scannerRunningRef.current = false;

          try {
            await scanner.stop();
          } catch (error) {
            console.log("Scanner stop after scan:", error);
          }

          try {
            await scanner.clear();
          } catch (error) {
            console.log("Scanner clear after scan:", error);
          }

          scannerRef.current = null;
          setCameraActive(false);

          findExtinguisher(decodedText);
        },
        () => {
          // ยังไม่พบ QR ในภาพปัจจุบัน
          // ให้ Scanner ทำงานต่อ
        }
      );

      setCameraActive(true);
    } catch (error) {
      console.error("QR scanner error:", error);

      if (scannerRef.current) {
        try {
          await scannerRef.current.clear();
        } catch {
          // Ignore cleanup error
        }
      }

      scannerRef.current = null;
      scannerRunningRef.current = false;
      setCameraActive(false);

      alert(
        "ไม่สามารถเปิด QR Scanner ได้ กรุณาตรวจสอบสิทธิ์กล้อง หรือใช้ช่องกรอกรหัส"
      );
    }
  }

  function updateAnswer(index, value) {
    setAnswers((previous) =>
      previous.map((answer, i) =>
        i === index ? value : answer
      )
    );
  }

  async function submitInspection() {
  if (!selected) {
    return;
  }

  if (!inspector.trim()) {
    alert("กรุณากรอกชื่อผู้ตรวจ");
    return;
  }

  const unanswered = answers.some(
    (answer) => answer === null
  );

  if (unanswered) {
    alert(
      "กรุณาตรวจสอบ Checklist ให้ครบทุกข้อ"
    );
    return;
  }

  const result =
    answers.includes("NG")
      ? "NG"
      : "PASS";

  const inspectionId =
    `INS-${Date.now()}`;

  const payload = {
    action: "saveInspection",

    inspectionId,

    extinguisherCode:
      selected.code,

    inspector:
      inspector.trim(),

    result,

    checklist:
      answers,

    note:
      note.trim(),
  };

  setSyncMessage(
    "กำลังบันทึกผลการตรวจ..."
  );

  try {
    const response = await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8",
        },

        body:
          JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error: ${response.status}`
      );
    }

    const resultData =
      await response.json();

    if (!resultData.success) {
      throw new Error(
        resultData.message ||
        "Save inspection failed"
      );
    }

    localStorage.setItem(
      "firecheck70_inspector",
      inspector.trim()
    );

    setSyncMessage(
      "บันทึกข้อมูลออนไลน์เรียบร้อย"
    );

    await loadOnlineData();

    setPage("success");
  } catch (error) {
    console.error(
      "Save inspection error:",
      error
    );

    setSyncMessage(
      "บันทึกข้อมูลไม่สำเร็จ"
    );

    alert(
      "ไม่สามารถบันทึกผลลง Google Sheets ได้ กรุณาตรวจสอบอินเทอร์เน็ตและ Apps Script API"
    );
  }
}
  
useEffect(() => {
  loadOnlineData();
}, []);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;

      if (
        scanner &&
        scannerRunningRef.current
      ) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="app">
      <header className="top-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">
              <Flame size={24} />
            </div>

            <div>
              <div className="brand-title">
                Fire Check 70
              </div>

              <div className="brand-subtitle">
                Fire Extinguisher QR Inspection
              </div>
            </div>
          </div>

          <div className="demo-label">
             {loading ? "LOADING" : "ONLINE"}
          </div>
        </div>
      </header>

      <main className="main">
        {page === "home" && (
          <>
            <div
      style={{
        marginBottom: "12px",
        fontSize: "12px",
        color: "#64748b",
        textAlign: "center",
      }}
    >
      {syncMessage}
    </div>
            <section className="hero">
              <div className="hero-label">
                FIRE EXTINGUISHER INSPECTION
              </div>

              <h1>
  ตรวจถังดับเพลิง
  <br />
  {items.length} จุด
</h1>

              <p>
                QR Inspection System
              </p>

              <div className="progress">
  <div
    className="progress-value"
    style={{
      width: `${
        items.length > 0
          ? (completed / items.length) * 100
          : 0
      }%`,
    }}
  />
</div>

<div className="hero-summary">
  <span>
    ตรวจแล้ว {completed} จุด
  </span>

  <span>
    {items.length > 0
      ? Math.round(
          (completed / items.length) * 100
        )
      : 0}
    %
  </span>
</div>
            </section>

            <section className="stats-grid">
              <StatCard
                title="ทั้งหมด"
                value={items.length}
                type="blue"
                icon={ShieldCheck}
              />

              <StatCard
                title="ตรวจแล้ว"
                value={completed}
                type="green"
                icon={CheckCircle2}
              />

              <StatCard
                title="ยังไม่ตรวจ"
                value={pending}
                type="yellow"
                icon={ClipboardCheck}
              />

              <StatCard
                title="พบ NG"
                value={ng}
                type="red"
                icon={TriangleAlert}
              />
            </section>

            <button
              className="primary-button scan-main"
              onClick={() =>
                setPage("scan")
              }
            >
              <QrCode size={22} />
              สแกน QR เพื่อเริ่มตรวจ
            </button>

            <section className="panel">
              <div className="panel-title">
                สถานะการตรวจ
              </div>

              <div className="summary-row">
                <span>PASS</span>

                <strong className="green-text">
                  {
                    items.filter(
                      (item) =>
                        item.lastResult === "PASS"
                    ).length
                  }
                </strong>
              </div>

              <div className="summary-row">
                <span>NG</span>

                <strong className="red-text">
                  {ng}
                </strong>
              </div>

              <div className="summary-row">
                <span>PENDING</span>

                <strong className="yellow-text">
                  {pending}
                </strong>
              </div>
            </section>
            
          </>
        )}

        {page === "scan" && (
          <section className="scan-page">
            <h1>สแกน QR Code</h1>

            <p className="page-description">
  สแกน QR Code ตามรหัสในทะเบียนถังดับเพลิง
</p>


            <div className="camera-box">
              <div
                id="qr-reader"
                className="qr-reader"
              />

              {!cameraActive && (
                <div className="camera-placeholder">
                  <Camera size={52} />

                  <span>
                    กล้องยังไม่เปิด
                  </span>
                </div>
              )}
            </div>

            {!cameraActive ? (
              <button
                className="primary-button"
                onClick={startCamera}
              >
                <Camera size={20} />
                เปิดกล้อง
              </button>
            ) : (
              <button
                className="secondary-button"
                onClick={stopCamera}
              >
                <X size={20} />
                ปิดกล้อง
              </button>
            )}

            <div className="separator">
              <span />
              หรือกรอกรหัส
              <span />
            </div>

            <form
              className="code-search"
              onSubmit={(event) => {
                event.preventDefault();

                findExtinguisher(qrFallback);
              }}
            >
              <input
                value={qrFallback}
                onChange={(event) =>
                  setQrFallback(event.target.value)
                }
                placeholder="เช่น FEG-1"
              />

              <button type="submit">
                ค้นหา
              </button>
            </form>

            <div className="help-box">
              <strong>
                กรณีกล้อง Scan QR ไม่ได้
              </strong>

              <p>
  สามารถกรอกรหัสถัง เช่น FEG-1
  เพื่อค้นหาจากทะเบียนออนไลน์ได้
</p>
            </div>
          </section>
        )}

        {page === "list" && (
          <>
            <div className="page-heading">
              <div>
                <h1>
                  ทะเบียนถังดับเพลิง
                </h1>

                <p>
                  ทั้งหมด {items.length} จุด
                </p>
              </div>
            </div>

            <div className="search-box">
              <Search size={19} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="ค้นหา FE-001, Area, Location"
              />
            </div>

            <div className="item-list">
              {filteredItems.map((item) => (
                <button
                  className="extinguisher-card"
                  key={item.code}
                  onClick={() =>
                    openInspection(item)
                  }
                >
                  <div className="fire-icon">
                    <Flame size={22} />
                  </div>

                  <div className="item-info">
                    <strong>
                      {item.code}
                    </strong>

                    <span>
                      {item.type} • {item.size}
                    </span>

                    <span>
                      <MapPin size={13} />
                      {item.area} • {item.location}
                    </span>
                  </div>

                  <StatusBadge
                    status={item.lastResult}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        {page === "inspection" && selected && (
          <section className="inspection-page">
            <button
              className="back-button"
              onClick={() =>
                setPage("list")
              }
            >
              ← กลับ
            </button>

            <div className="equipment-header">
              <div>
                <div className="equipment-code">
                  {selected.code}
                </div>

                <div>
                  {selected.type} • {selected.size}
                </div>
              </div>

              <Flame size={40} />
            </div>

            <div className="location-line">
              <MapPin size={17} />
              {selected.area} / {selected.location}
            </div>

            <section className="form-card">
              <label>
                ชื่อผู้ตรวจ
              </label>

              <input
                value={inspector}
                onChange={(event) =>
                  setInspector(event.target.value)
                }
                placeholder="กรอกชื่อผู้ตรวจ"
              />
            </section>

            <h2 className="checklist-title">
              Inspection Checklist
            </h2>

            <div className="checklist">
              {CHECKLISTS[selected.type].map(
                (question, index) => (
                  <div
                    className="check-card"
                    key={question}
                  >
                    <div className="question">
                      <span>
                        {index + 1}.
                      </span>

                      {question}
                    </div>

                    <div className="answer-buttons">
                      <button
                        className={
                          answers[index] === "PASS"
                            ? "answer pass selected"
                            : "answer pass"
                        }
                        onClick={() =>
                          updateAnswer(
                            index,
                            "PASS"
                          )
                        }
                      >
                        <CheckCircle2 size={18} />
                        PASS
                      </button>

                      <button
                        className={
                          answers[index] === "NG"
                            ? "answer ng selected"
                            : "answer ng"
                        }
                        onClick={() =>
                          updateAnswer(
                            index,
                            "NG"
                          )
                        }
                      >
                        <XCircle size={18} />
                        NG
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            <section className="form-card">
              <label>
                หมายเหตุ
              </label>

              <textarea
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder="รายละเอียดความผิดปกติ หรือหมายเหตุ"
              />
            </section>

            <button
              className="primary-button save-button"
              onClick={submitInspection}
            >
              บันทึกผลการตรวจ
            </button>
          </section>
        )}

        {page === "success" && (
          <section className="success-page">
            <div className="success-icon">
              <CheckCircle2 size={58} />
            </div>

            <h1>
              บันทึกผลเรียบร้อย
            </h1>

            <p>
              {selected?.code}
            </p>

            <button
              className="primary-button"
              onClick={() =>
                setPage("scan")
              }
            >
              <QrCode size={20} />
              สแกนจุดถัดไป
            </button>

            <button
              className="secondary-button"
              onClick={() =>
                setPage("home")
              }
            >
              กลับหน้าหลัก
            </button>
          </section>
        )}

        {page === "history" && (
          <>
            <div className="page-heading">
              <div>
                <h1>
                  ประวัติการตรวจ
                </h1>

                <p>
                  ประวัติการตรวจจากฐานข้อมูล
                </p>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="empty-state">
                <History size={42} />

                <strong>
                  ยังไม่มีประวัติ
                </strong>

                <span>
                  ทดลองตรวจถังเพื่อสร้างข้อมูล
                </span>
              </div>
            ) : (
              <div className="history-list">
                {logs.map((log) => (
                  <div
                    className="history-card"
                    key={log.inspectionId}
                  >
                    <div
                      className={
                        log.result === "PASS"
                          ? "history-status pass"
                          : "history-status ng"
                      }
                    >
                      {log.result === "PASS" ? (
                        <CheckCircle2 />
                      ) : (
                        <TriangleAlert />
                      )}
                    </div>

                    <div className="history-info">
                      <div className="history-header">
                        <strong>
                          {log.extinguisherCode}
                        </strong>

                        <StatusBadge
                          status={log.result}
                        />
                      </div>

                      <div>
                        ผู้ตรวจ: {log.inspector}
                      </div>

                      <div>
                        {new Date(
                          log.inspectedAt
                        ).toLocaleString("th-TH")}
                      </div>

                      {log.note && (
                        <div className="history-note">
                          {log.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {!["inspection", "success"].includes(page) && (
        <nav className="bottom-nav">
          <button
            className={
              page === "home"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("home")
            }
          >
            <Home size={21} />
            <span>หน้าหลัก</span>
          </button>

          <button
            className={
              page === "scan"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("scan")
            }
          >
            <QrCode size={21} />
            <span>สแกน</span>
          </button>

          <button
            className={
              page === "list"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("list")
            }
          >
            <Search size={21} />
            <span>ทะเบียน</span>
          </button>

          <button
            className={
              page === "history"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("history")
            }
          >
            <History size={21} />
            <span>ประวัติ</span>
          </button>
        </nav>
      )}
    </div>
  );
}
