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

function createExtinguishers() {
  return Array.from({ length: 70 }, (_, index) => {
    const number = index + 1;

    return {
      code: `FE-${String(number).padStart(3, "0")}`,
      type: number % 10 === 0 ? "CO2" : "Dry Chemical",
      size: number % 10 === 0 ? "10 kg" : "10 lb",
      area: [
        "Packing",
        "Warehouse",
        "Office",
        "Production",
        "Loading Bay",
      ][index % 5],
      location: `จุดติดตั้ง ${String(number).padStart(2, "0")}`,
      status: "ACTIVE",
      lastResult: "PENDING",
      lastInspection: null,
    };
  });
}

function loadItems() {
  try {
    const stored = localStorage.getItem("firecheck70_items");

    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Cannot read extinguisher data:", error);
  }

  return createExtinguishers();
}

function loadLogs() {
  try {
    return JSON.parse(
      localStorage.getItem("firecheck70_logs") || "[]"
    );
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(
    "firecheck70_items",
    JSON.stringify(items)
  );
}

function saveLogs(logs) {
  localStorage.setItem(
    "firecheck70_logs",
    JSON.stringify(logs)
  );
}

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
  const [items, setItems] = useState(loadItems);
  const [logs, setLogs] = useState(loadLogs);

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

    setSelected(item);

    setAnswers(
      CHECKLISTS[item.type].map(() => null)
    );

    setNote("");

    setPage("inspection");
  }

  function findExtinguisher(value) {
    if (!value) {
      return;
    }

    let code = String(value)
      .trim()
      .toUpperCase();

    if (code.includes("/")) {
      code = code
        .split("/")
        .filter(Boolean)
        .pop();
    }

    const item = items.find(
      (row) => row.code === code
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

  function submitInspection() {
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

    const inspectedAt = new Date().toISOString();

    const inspection = {
      inspectionId: `INS-${Date.now()}`,
      extinguisherCode: selected.code,
      inspector: inspector.trim(),
      inspectedAt,
      result,
      checklist: answers,
      note: note.trim(),
    };

    const updatedItems = items.map((item) =>
      item.code === selected.code
        ? {
            ...item,
            lastResult: result,
            lastInspection: inspectedAt,
          }
        : item
    );

    const updatedLogs = [
      inspection,
      ...logs,
    ];

    setItems(updatedItems);
    setLogs(updatedLogs);

    saveItems(updatedItems);
    saveLogs(updatedLogs);

    localStorage.setItem(
      "firecheck70_inspector",
      inspector.trim()
    );

    setPage("success");
  }

  function resetDemoData() {
    const freshItems = createExtinguishers();

    setItems(freshItems);
    setLogs([]);

    saveItems(freshItems);
    saveLogs([]);

    alert("รีเซ็ตข้อมูลทดลองเรียบร้อย");
  }

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
            DEMO
          </div>
        </div>
      </header>

      <main className="main">
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-label">
                FIRE EXTINGUISHER INSPECTION
              </div>

              <h1>
                ตรวจถังดับเพลิง
                <br />
                70 จุด
              </h1>

              <p>
                QR Inspection System
              </p>

              <div className="progress">
                <div
                  className="progress-value"
                  style={{
                    width: `${
                      (completed / items.length) * 100
                    }%`,
                  }}
                />
              </div>

              <div className="hero-summary">
                <span>
                  ตรวจแล้ว {completed} จุด
                </span>

                <span>
                  {Math.round(
                    (completed / items.length) * 100
                  )}
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

            <button
              className="text-button"
              onClick={resetDemoData}
            >
              Reset Demo Data
            </button>
          </>
        )}

        {page === "scan" && (
          <section className="scan-page">
            <h1>สแกน QR Code</h1>

            <p className="page-description">
              QR Code ใช้รหัส FE-001 ถึง FE-070
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
                placeholder="เช่น FE-001"
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
                สามารถกรอกรหัส FE-001 ถึง FE-070
                เพื่อทดสอบระบบก่อนได้
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
                  ข้อมูล Demo จาก Browser นี้
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
            <span>70 จุด</span>
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
