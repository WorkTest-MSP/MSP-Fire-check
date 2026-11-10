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
  "STANDARD": [
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
// Map extinguisher type to checklist group
const TYPE_TO_CHECKLIST = {
  "DRY CHEMICAL": "STANDARD",
  "SC-AFFF+": "STANDARD",
  "F-500": "STANDARD",
  "CO2": "CO2",
};
function getChecklistForType(type) {
  const normalizedType = String(type || "")
    .trim()
    .toUpperCase();

  const group =
    TYPE_TO_CHECKLIST[normalizedType];

  return CHECKLISTS[group] || [];
}
function getWeekStart() {
  const now = new Date();

  const day = now.getDay();

  const daysSinceMonday =
    day === 0
      ? 6
      : day - 1;

  const monday = new Date(now);

  monday.setDate(
    now.getDate() - daysSinceMonday
  );

  monday.setHours(
    0, 0, 0, 0
  );

  return monday;
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
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState ("กำลังโหลดข้อมูล...");
  const [page, setPage] = useState("home");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [masterMode, setMasterMode] = useState("add");
  const [masterForm, setMasterForm] = useState ({
    code: "",
    type: "Dry Chemical",
    size: "",
    location: "",
    manufactureDate: "",
    expiryDate: "",
    status: "ACTIVE",
    replacementStatus: "NONE",
  });
  const [replacementItem,setReplacementItem] = useState(null);
  const [replacementForm,setReplacementForm] = useState({
    newCode: "",
    type: "Dry Chemical",
    size: "",
    location: "",
    manufactureDate: "",
    expiryDate: "",
  });
  const [answers, setAnswers] = useState([]);
  const [inspector, setInspector] = useState(
    localStorage.getItem("firecheck70_inspector") || ""
  );
  const [note, setNote] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [qrFallback, setQrFallback] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("ALL");
  const scannerRef = useRef(null);
  const scannerRunningRef = useRef(false);
  
  const completed = items.filter(
    (item) => item.lastResult !== "PENDING").length;
  const ng = items.filter(
    (item) => item.lastResult === "NG").length;
  const pending = items.length - completed;
  const expiringSoon = items.filter(
  (item) => {
    const info =
      getExpiryInfo(
        item.expiryDate
      );

    return (
      info.status === "EXPIRING"
    );
  }
).length;

const expired = items.filter(
  (item) => {
    const info =
      getExpiryInfo(
        item.expiryDate
      );

    return (
      info.status === "EXPIRED"
    );
  }
).length;

const requestReplacement =
  items.filter(
    (item) =>
      item.replacementStatus ===
      "Request Replacement"
  ).length;

const procurement =
  items.filter(
    (item) =>
      item.replacementStatus ===
      "Procurement"
  ).length;

const replacement =
  items.filter(
    (item) =>
      item.replacementStatus ===
      "Replacement"
  ).length;

const verification =
  items.filter(
    (item) =>
      item.replacementStatus ===
      "Verification"
  ).length;

const expiryItems =
  items.filter((item) => {
    const info =
      getExpiryInfo(
        item.expiryDate
      );

    return (
      info.status === "EXPIRING" ||
      info.status === "EXPIRED" ||
      (
        item.replacementStatus &&
        item.replacementStatus !==
          "NONE"
      )
    );
  });

const filteredExpiryItems =
  expiryItems.filter((item) => {
    const info =
      getExpiryInfo(
        item.expiryDate
      );

    if (
      expiryFilter === "ALL"
    ) {
      return true;
    }

    if (
      expiryFilter ===
      "EXPIRING"
    ) {
      return (
        info.status ===
        "EXPIRING"
      );
    }

    if (
      expiryFilter ===
      "EXPIRED"
    ) {
      return (
        info.status ===
        "EXPIRED"
      );
    }

    if (
      expiryFilter ===
      "IN PROGRESS"
    ) {
      return [
        "Request Replacement",
        "Procurement",
        "Replacement",
        "Verification",
      ].includes(
        item.replacementStatus
      );
    }

    if (
      expiryFilter ===
      "COMPLETED"
    ) {
      return (
        item.replacementStatus ===
        "Completed"
      );
    }

    return true;
  });
  
const weekStart =
  getWeekStart();

const weeklyLogs =
  logs.filter((log) => {
    if (!log.inspectedAt) {
      return false;
    }

    return (
      new Date(log.inspectedAt) >=
      weekStart
    );
  });
const weeklyCodes =
  new Set(
    weeklyLogs.map(
      (log) =>
        String(
          log.extinguisherCode || ""
        )
          .trim()
          .toUpperCase()
    )
  );

const activeItems =
  items.filter(
    (item) =>
      item.status === "ACTIVE"
  );

const inspectedThisWeek =
  activeItems.filter(
    (item) =>
      weeklyCodes.has(item.code)
  ).length;

const pendingThisWeek =
  activeItems.length -
  inspectedThisWeek;
  const latestWeeklyResult = new Map();

weeklyLogs.forEach((log) => {
  const code = String(
    log.extinguisherCode || ""
  )
    .trim()
    .toUpperCase();

  if (!code) {
    return;
  }

  if (!latestWeeklyResult.has(code)) {
    latestWeeklyResult.set(
      code,
      log.result
    );
  }
});

const passThisWeek =
  activeItems.filter(
    (item) =>
      latestWeeklyResult.get(
        item.code
      ) === "PASS"
  ).length;

const ngThisWeek =
  activeItems.filter(
    (item) =>
      latestWeeklyResult.get(
        item.code
      ) === "NG"
  ).length;

const weeklyCompletion =
  activeItems.length > 0
    ? Math.round(
        (
          inspectedThisWeek /
          activeItems.length
        ) * 100
      )
    : 0;
  
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

  return {
    code,

    type: rawType,

    size: String(
      row.Size ?? ""
    ).trim(),

    location: String(
      row.Location ?? ""
    ).trim(),

    manufactureDate:
      row.ManufactureDate || null,

    expiryDate:
      row.ExpiryDate || null,

    status: String(
      row.Status ?? "ACTIVE"
    )
      .trim()
      .toUpperCase(),

    replacementStatus: String(
      row.ReplacementStatus ?? "NONE"
    ).trim(),

    lastResult: String(
      row.LastResult ?? "PENDING"
    )
      .trim()
      .toUpperCase(),

    lastInspection:
      row.LastInspection || null,
  };
}

function getExpiryInfo(expiryDate) {
  if (!expiryDate) {
    return {
      status: "NO EXPIRY DATE",
      days: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry =
    new Date(expiryDate);

  expiry.setHours(0, 0, 0, 0);

  const diffMs =
    expiry.getTime() -
    today.getTime();

  const days =
    Math.ceil(
      diffMs /
      (1000 * 60 * 60 * 24)
    );

  if (days < 0) {
    return {
      status: "EXPIRED",
      days,
    };
  }

  if (days <= 120) {
    return {
      status: "EXPIRING",
      days,
    };
  }

  return {
    status: "NORMAL",
    days,
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
  
function openAddMaster() {
  setMasterMode("add");

  setMasterForm({
    code: "",
    type: "Dry Chemical",
    size: "",
    location: "",
    manufactureDate: "",
    expiryDate: "",
    status: "ACTIVE",
    replacementStatus: "NONE",
  });

  setPage("masterForm");
}

  function openEditMaster(item) {
  setMasterMode("edit");

  setMasterForm({
    code: item.code || "",
    type:
      item.type ||
      "Dry Chemical",

    size:
      item.size || "",

    location:
      item.location || "",

    manufactureDate:
      item.manufactureDate
        ? String(
            item.manufactureDate
          ).slice(0, 10)
        : "",

    expiryDate:
      item.expiryDate
        ? String(
            item.expiryDate
          ).slice(0, 10)
        : "",

    status:
      item.status ||
      "ACTIVE",

    replacementStatus:
      item.replacementStatus ||
      "NONE",
  });

  setPage("masterForm");
}

  function updateMasterField(
  field,
  value
) {
  setMasterForm(
    (previous) => ({
      ...previous,
      [field]: value,
    })
  );
}

  async function saveMaster() {
  const code =
    masterForm.code
      .trim()
      .toUpperCase();

  const type =
    masterForm.type.trim();

  const location =
    masterForm.location.trim();


  // 1. Validation
  if (!code) {
    alert(
      "กรุณากรอกรหัสถังดับเพลิง"
    );
    return;
  }

  if (!type) {
    alert(
      "กรุณาเลือกประเภทถัง"
    );
    return;
  }

  if (!location) {
    alert(
      "กรุณากรอกตำแหน่งติดตั้ง"
    );
    return;
  }

  if (!masterForm.expiryDate) {
    alert(
      "กรุณาระบุวันหมดอายุ"
    );
    return;
  }


  // 2. เตรียมข้อมูลส่งไป Google Apps Script
  const payload = {
    action:
      masterMode === "add"
        ? "addExtinguisher"
        : "updateExtinguisher",

    code,
    type,

    size:
      masterForm.size.trim(),

    location,

    manufactureDate:
      masterForm.manufactureDate,

    expiryDate:
      masterForm.expiryDate,

    status:
      masterForm.status,

    replacementStatus:
      masterForm.replacementStatus,
  };


  // 3. เปลี่ยนสถานะบนหน้าจอ
  setSyncMessage(
    "กำลังบันทึก Master..."
  );


  // 4. เริ่ม Saving
  setSaving(true);


  try {
    // 5. ส่งข้อมูลไป Apps Script
    const response =
      await fetch(
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


    const data =
      await response.json();


    if (!data.success) {
      throw new Error(
        data.message ||
        "Master save failed"
      );
    }


    // โหลด Master ล่าสุดกลับมา
    await loadOnlineData();


    setSyncMessage(
      masterMode === "add"
        ? "เพิ่ม Master เรียบร้อย"
        : "แก้ไข Master เรียบร้อย"
    );


    alert(
      masterMode === "add"
        ? `เพิ่ม ${code} เรียบร้อย`
        : `แก้ไข ${code} เรียบร้อย`
    );


    setPage("list");


  } catch (error) {
    console.error(
      "Master save error:",
      error
    );


    setSyncMessage(
      "บันทึก Master ไม่สำเร็จ"
    );


    alert(
      error.message ||
      "ไม่สามารถบันทึก Master ได้"
    );


  } finally {
    // 6. สำเร็จหรือ Error ก็ต้องปิด Saving
    setSaving(false);
  }
}

  async function deactivateMaster(
  item
) {
  if (!item) {
    return;
  }

  const confirmed =
    window.confirm(
      `ต้องการเปลี่ยน ${item.code} เป็น INACTIVE หรือไม่?\n\nประวัติการตรวจจะยังคงอยู่`
    );

  if (!confirmed) {
    return;
  }

  setSaving(true);

  setSyncMessage(
    `กำลัง Deactivate ${item.code}...`
  );

  try {
    const response =
      await fetch(
        API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8",
          },

          body:
            JSON.stringify({
              action:
                "deactivateExtinguisher",

              code:
                item.code,
            }),
        }
      );

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.message ||
        "Deactivate failed"
      );
    }

    await loadOnlineData();

    setSyncMessage(
      `${item.code} เปลี่ยนเป็น INACTIVE แล้ว`
    );

    alert(
      `${item.code} Deactivate เรียบร้อย`
    );

    setPage("list");

  } catch (error) {
    console.error(
      "Deactivate error:",
      error
    );

    alert(
      error.message ||
      "ไม่สามารถ Deactivate ได้"
    );

  } finally {
    setSaving(false);
  }
}

async function changeReplacementStatus(
  item,
  newStatus
) {
  if (!item) {
    return;
  }

  setSaving(true);

  setSyncMessage(
    `กำลัง Update ${item.code}...`
  );

  try {
    const response =
      await fetch(
        API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8",
          },

          body:
            JSON.stringify({
              action:
                "updateReplacementStatus",

              code:
                item.code,

              replacementStatus:
                newStatus,
            }),
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP error: ${response.status}`
      );
    }

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.message ||
        "Status update failed"
      );
    }

    await loadOnlineData();

    setSyncMessage(
      `${item.code} → ${newStatus}`
    );

  } catch (error) {
    console.error(
      "Replacement status error:",
      error
    );

    alert(
      error.message ||
      "ไม่สามารถ Update Replacement Status ได้"
    );

  } finally {
    setSaving(false);
  }
}

  function openReplacementCompletion(item) {
  if (!item) {
    return;
  }

  setReplacementItem(item);

  setReplacementForm({
    newCode: "",

    type:
      item.type ||
      "Dry Chemical",

    size:
      item.size || "",

    location:
      item.location || "",

    manufactureDate: "",

    expiryDate: "",
  });

  setPage("replacementComplete");
}

function updateReplacementField(
  field,
  value
) {
  setReplacementForm(
    (previous) => ({
      ...previous,
      [field]: value,
    })
  );
}

 async function completeReplacement() {
  if (!replacementItem) {
    alert("ไม่พบข้อมูลถังเก่า");
    return;
  }

  const newCode =
    replacementForm.newCode
      .trim()
      .toUpperCase();

  if (!newCode) {
    alert("กรุณากรอกรหัสถังใหม่");
    return;
  }

  if (
    newCode ===
    replacementItem.code
  ) {
    alert(
      "รหัสถังใหม่ต้องไม่ซ้ำกับรหัสถังเก่า"
    );
    return;
  }

  if (
    !replacementForm.type.trim()
  ) {
    alert("กรุณาเลือกประเภทถังใหม่");
    return;
  }

  if (
    !replacementForm.location.trim()
  ) {
    alert(
      "กรุณากรอกตำแหน่งติดตั้ง"
    );
    return;
  }

  if (
    !replacementForm.manufactureDate
  ) {
    alert(
      "กรุณาระบุวันที่ผลิตถังใหม่"
    );
    return;
  }

  if (
    !replacementForm.expiryDate
  ) {
    alert(
      "กรุณาระบุวันหมดอายุถังใหม่"
    );
    return;
  }

  const manufactureDate =
    new Date(
      replacementForm.manufactureDate
    );

  const expiryDate =
    new Date(
      replacementForm.expiryDate
    );

  if (
    expiryDate <= manufactureDate
  ) {
    alert(
      "วันหมดอายุต้องอยู่หลังวันที่ผลิต"
    );
    return;
  }

  const confirmed =
    window.confirm(
      `ยืนยันการเปลี่ยนถังดับเพลิง?\n\n` +
      `ถังเก่า: ${replacementItem.code}\n` +
      `ถังใหม่: ${newCode}\n\n` +
      `หลังยืนยัน ถังเก่าจะเปลี่ยนเป็น INACTIVE และระบบจะสร้าง Master ถังใหม่`
    );

  if (!confirmed) {
    return;
  }

  setSaving(true);

  setSyncMessage(
    "กำลังบันทึก Replacement..."
  );

  try {
    const response =
      await fetch(
        API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8",
          },

          body: JSON.stringify({
            action:
              "completeReplacement",

            oldCode:
              replacementItem.code,

            newCode,

            type:
              replacementForm.type,

            size:
              replacementForm.size,

            location:
              replacementForm.location,

            manufactureDate:
              replacementForm
                .manufactureDate,

            expiryDate:
              replacementForm
                .expiryDate,
          }),
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP error: ${response.status}`
      );
    }

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.message ||
        "Replacement failed"
      );
    }

    await loadOnlineData();

    setSyncMessage(
      `Replacement ${replacementItem.code} → ${newCode} เรียบร้อย`
    );

    alert(
      `Replacement เรียบร้อย\n\n` +
      `ถังเก่า: ${replacementItem.code} → INACTIVE\n` +
      `ถังใหม่: ${newCode} → ACTIVE`
    );

    setReplacementItem(null);

    setPage("expiry");
  } catch (error) {
    console.error(
      "Replacement completion error:",
      error
    );

    setSyncMessage(
      "บันทึก Replacement ไม่สำเร็จ"
    );

    alert(
      error.message ||
      "ไม่สามารถ Complete Replacement ได้"
    );
  } finally {
    setSaving(false);
  }
} 

  
  
async function deleteMaster(
  item
) {
  if (!item) {
    return;
  }

  const confirmed =
    window.confirm(
      `ต้องการลบ ${item.code} ถาวรหรือไม่?\n\nจะลบได้เฉพาะถังที่ไม่มี Inspection History`
    );

  if (!confirmed) {
    return;
  }

  setSaving(true);

  setSyncMessage(
    `กำลังตรวจสอบและลบ ${item.code}...`
  );

  try {
    const response =
      await fetch(
        API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8",
          },

          body:
            JSON.stringify({
              action:
                "deleteExtinguisher",

              code:
                item.code,
            }),
        }
      );

    const data =
      await response.json();

    if (!data.success) {
      if (data.hasHistory) {
        alert(
          `${item.code} มีประวัติการตรวจอยู่\n\nระบบไม่อนุญาตให้ลบถาวร กรุณาใช้ Deactivate แทน`
        );

        return;
      }

      throw new Error(
        data.message ||
        "Delete failed"
      );
    }

    await loadOnlineData();

    setSyncMessage(
      `ลบ ${item.code} เรียบร้อย`
    );

    alert(
      `${item.code} ถูกลบเรียบร้อย`
    );

    setPage("list");

  } catch (error) {
    console.error(
      "Delete master error:",
      error
    );

    alert(
      error.message ||
      "ไม่สามารถลบ Master ได้"
    );

  } finally {
    setSaving(false);
  }
}
  function openInspection(item) {
  stopCamera();

  if (!item) {
    alert("ไม่พบข้อมูลถังดับเพลิง");
    return;
  }

  const checklist =
    getChecklistForType(item.type);

  if (checklist.length === 0) {
    alert(
      `ยังไม่ได้กำหนด Checklist สำหรับ Type: ${item.type}`
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
      {saving && (
        <div className="saving-overlay">
        <div className="saving-box">
        <div className="saving-spinner" />

        <strong>
           กำลังบันทึกข้อมูล
        </strong>

        <span>
           กรุณารอสักครู่...
        </span>
      </div>
  </div>
)}
      <header className="top-header">
  <div className="header-inner">

    <div className="brand">
      <div className="brand-icon">
        <Flame size={26} />
      </div>

      <div>
        <div className="brand-title">
          FIRE EXTINGUISHER INSPECTION
        </div>

        <div className="brand-subtitle">
          MSP DEPARTMENT
        </div>
      </div>
    </div>

    <div className="header-right">
      <div className="header-datetime">
        {new Date().toLocaleString(
          "th-TH",
          {
            dateStyle: "medium",
            timeStyle: "short",
          }
        )}
      </div>

      <div className="demo-label">
        <span className="online-dot" />

        {loading
          ? "LOADING"
          : "ONLINE"}
      </div>
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
            <section className="home-dashboard">

  <div className="dashboard-left">

    <div className="hero-label">
      FIRE EXTINGUISHER INSPECTION
    </div>

    <h1>
      ตรวจถังดับเพลิง
      <br />
      {activeItems.length} จุด
    </h1>

    <div className="weekly-ratio">
      Weekly checking ratio
    </div>

    <div className="progress">
      <div
        className="progress-value"
        style={{
          width:
            `${weeklyCompletion}%`,
        }}
      />
    </div>

    <div className="hero-summary">
      <strong>
        ตรวจแล้ว {inspectedThisWeek} จุด
      </strong>

      <strong>
        {weeklyCompletion}%
      </strong>
    </div>

  </div>


  <div className="dashboard-stats">

    <div className="hero-stat-card">
      <div className="hero-stat-icon extinguisher-icon">
        <Flame size={42} />
      </div>

      <div>
        <span>
          ACTIVE
        </span>

        <strong>
          {activeItems.length}
        </strong>
      </div>
    </div>


    <div className="hero-stat-card">
      <div className="hero-stat-icon qr-stat">
        <QrCode size={42} />
      </div>

      <div>
        <span>
          ตรวจแล้วสัปดาห์นี้
        </span>

        <strong>
          {inspectedThisWeek}
        </strong>
      </div>
    </div>


    <div className="hero-stat-card">
      <div className="hero-stat-icon pass-stat">
        OK
      </div>

      <strong className="hero-pass-number">
        {passThisWeek}
      </strong>
    </div>


    <div className="hero-stat-card">
      <div className="hero-stat-icon ng-stat">
        NG
      </div>

      <strong className="hero-ng-number">
        {ngThisWeek}
      </strong>
    </div>
  </div>
</section>

            
<section className="expiry-dashboard-panel">

  <div className="expiry-dashboard-title">
    <strong>
      Expiry & Replacement Monitoring
    </strong>

    <span>
      ติดตามสถานะถังดับเพลิง
      อายุการใช้งาน ≤ 120 วัน
    </span>
  </div>


  <div className="expiry-dashboard-content">

    <div className="expiry-big-card">
      <span>
        อายุการใช้งาน ≤ 120 วัน
      </span>

      <strong>
        {expiringSoon}
      </strong>

      <small>
        ถัง
      </small>
    </div>


    <div className="replacement-summary">

      <div className="replacement-title">
        Replacement status
      </div>

      <div>
        <span>
          Request Replacement
        </span>

        <strong>
          {requestReplacement}
        </strong>
      </div>

      <div>
        <span>
          Procurement
        </span>

        <strong>
          {procurement}
        </strong>
      </div>

      <div>
        <span>
          Replacement
        </span>

        <strong>
          {replacement}
        </strong>
      </div>

      <div>
        <span>
          Verification
        </span>

        <strong>
          {verification}
        </strong>
      </div>

    </div>

  </div>


  <button
    className="expiry-open-button"
    onClick={() =>
      setPage("expiry")
    }
  >
    เปิดรายการ Expiry Monitoring
  </button>

</section>

  <div className="summary-row">
    <span>Expiring within 120 days</span>
    <strong className="yellow-text">
      {expiringSoon}
    </strong>
  </div>

  <div className="summary-row">
    <span>Expired</span>
    <strong className="red-text">
      {expired}
    </strong>
  </div>

  <div className="summary-row">
    <span>Request Replacement</span>
    <strong>
      {requestReplacement}
    </strong>
  </div>

  <div className="summary-row">
    <span>Procurement</span>
    <strong>
      {procurement}
    </strong>
  </div>

  <div className="summary-row">
    <span>Replacement</span>
    <strong>
      {replacement}
    </strong>
  </div>

  <div className="summary-row">
    <span>Verification</span>
    <strong>
      {verification}
    </strong>
  </div>
</div>

            
            <button
                className="primary-button scan-main home-scan-button"
                onClick={() =>
                setPage("scan")
                }
             >
                <QrCode size={30} />

                <strong>
                   สแกน QR
                </strong>

                <span>
                   เพื่อเริ่มตรวจ
                </span>
             </button>
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
            
            <button
                  className="primary-button"
                  onClick={openAddMaster}
                  style={{
                    marginBottom: "14px",
                  }}
            >
              + เพิ่มถังดับเพลิง
            </button>
            
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
                <div
                     className="extinguisher-card"
                     key={item.code}
                >
                    <button
                      className="extinguisher-main"
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
                     {item.location}
                </span>
              </div>

              <StatusBadge
                status={item.lastResult}
              />
              </button>

             <button
                  className="edit-master-button"
                  onClick={() =>
                  openEditMaster(item)
                  }
             >
                แก้ไข
             </button>
              </div>
              ))}
            </div>
          </>
        )}

        {page === "expiry" && (
  <section className="inspection-page">

    <button
      className="back-button"
      onClick={() =>
        setPage("home")
      }
    >
      ← กลับ Dashboard
    </button>

    <div className="page-heading">
      <div>
        <h1>
          Expiry Monitoring
        </h1>

        <p>
          ถังใกล้หมดอายุ
          และ Replacement Workflow
        </p>
      </div>
    </div>


    <div className="expiry-filter">
      {[
        "ALL",
        "EXPIRING",
        "EXPIRED",
        "IN PROGRESS",
        "COMPLETED",
      ].map((filter) => (
        <button
          key={filter}
          className={
            expiryFilter === filter
              ? "expiry-filter-active"
              : ""
          }
          onClick={() =>
            setExpiryFilter(filter)
          }
        >
          {filter}
        </button>
      ))}
    </div>


    <div className="expiry-list">
      {filteredExpiryItems.length ===
      0 ? (
        <div className="empty-state">
          <CheckCircle2 size={42} />

          <strong>
            ไม่มีรายการ
          </strong>

          <span>
            ไม่พบถังตามตัวกรองนี้
          </span>
        </div>
      ) : (
        filteredExpiryItems.map(
          (item) => {
            const info =
              getExpiryInfo(
                item.expiryDate
              );

            return (
              <div
                className="expiry-card"
                key={item.code}
              >
                <div className="expiry-card-header">
                  <div>
                    <strong>
                      {item.code}
                    </strong>

                    <span>
                      {item.type}
                    </span>
                  </div>

                  <StatusBadge
                    status={
                      item.lastResult
                    }
                  />
                </div>


                <div className="expiry-detail">
                  <span>
                    Location
                  </span>

                  <strong>
                    {item.location ||
                      "-"}
                  </strong>
                </div>


                <div className="expiry-detail">
                  <span>
                    Expiry Date
                  </span>

                  <strong>
                    {item.expiryDate
                      ? new Date(
                          item.expiryDate
                        ).toLocaleDateString(
                          "en-GB"
                        )
                      : "-"}
                  </strong>
                </div>


                <div className="expiry-detail">
                  <span>
                    Remaining
                  </span>

                  <strong
                    className={
                      info.status ===
                      "EXPIRED"
                        ? "red-text"
                        : "yellow-text"
                    }
                  >
                    {info.status ===
                    "EXPIRED"
                      ? `Expired ${Math.abs(
                          info.days
                        )} days`
                      : `${info.days} days`}
                  </strong>
                </div>


                <div className="expiry-detail">
                  <span>
                    Replacement
                  </span>

                  <strong>
                    {item.replacementStatus ||
                      "NONE"}
                  </strong>
                </div>


                <label className="expiry-action-label">
                  Update Status
                </label>

                <select
                  className="expiry-status-select"
                  value={
                    item.replacementStatus ||
                    "NONE"
                  }
                  disabled={saving}
                  onChange={(event) =>
                    changeReplacementStatus(
                      item,
                      event.target.value
                    )
                  }
                >
                  <option value="NONE">
                    NONE
                  </option>

                  <option value="Request Replacement">
                    Request Replacement
                  </option>

                  <option value="Procurement">
                    Procurement
                  </option>

                  <option value="Replacement">
                    Replacement
                  </option>

                  <option value="Verification">
                    Verification
                  </option>

                  <option value="Completed">
                    Completed
                  </option>
                </select>
    
                {item.replacementStatus === "Verification" && (
                   <button
                      className="replacement-complete-button"
                      onClick={() =>
                      openReplacementCompletion(item)
                  }
                      disabled={saving}
                   >
                      Complete Replacement
                 </button>
                 )}

                <button
                  className="edit-master-button"
                  onClick={() =>
                    openEditMaster(item)
                  }
                  disabled={saving}
                >
                  เปิด Master
                </button>
              </div>
            );
          }
        )
      )}
    </div>

  </section>
)}

{page === "replacementComplete" &&
  replacementItem && (
  <section className="inspection-page">
    <button
      className="back-button"
      onClick={() =>
        setPage("expiry")
      }
      disabled={saving}
    >
      ← กลับ Expiry Monitoring
    </button>

    <div className="page-heading">
      <div>
        <h1>
          Replacement Verification
        </h1>

        <p>
          ถังเก่า:{" "}
          {replacementItem.code}
        </p>
      </div>
    </div>

    <div className="help-box">
      เมื่อบันทึกสำเร็จ
      ระบบจะเปลี่ยนถังเก่าเป็น INACTIVE
      และสร้าง Master ถังใหม่เป็น ACTIVE
    </div>

    <section className="form-card">
      <label>
        รหัสถังเก่า
      </label>

      <input
        value={replacementItem.code}
        disabled
      />
    </section>

    <section className="form-card">
      <label>
        รหัสถังใหม่ *
      </label>

      <input
        value={
          replacementForm.newCode
        }
        onChange={(event) =>
          updateReplacementField(
            "newCode",
            event.target.value
              .trimStart()
              .toUpperCase()
          )
        }
        placeholder="เช่น FEG-101"
      />
    </section>

    <section className="form-card">
      <label>
        Type *
      </label>

      <select
        value={
          replacementForm.type
        }
        onChange={(event) =>
          updateReplacementField(
            "type",
            event.target.value
          )
        }
      >
        <option value="Dry Chemical">
          Dry Chemical
        </option>

        <option value="CO2">
          CO2
        </option>

        <option value="SC-AFFF+">
          SC-AFFF+
        </option>

        <option value="F-500">
          F-500
        </option>
      </select>
    </section>

    <section className="form-card">
      <label>
        Size
      </label>

      <input
        value={
          replacementForm.size
        }
        onChange={(event) =>
          updateReplacementField(
            "size",
            event.target.value
          )
        }
        placeholder="เช่น 10 lb"
      />
    </section>

    <section className="form-card">
      <label>
        Location *
      </label>

      <input
        value={
          replacementForm.location
        }
        onChange={(event) =>
          updateReplacementField(
            "location",
            event.target.value
          )
        }
        placeholder="ตำแหน่งติดตั้งถังใหม่"
      />
    </section>

    <section className="form-card">
      <label>
        Manufacture Date *
      </label>

      <input
        type="date"
        value={
          replacementForm
            .manufactureDate
        }
        onChange={(event) =>
          updateReplacementField(
            "manufactureDate",
            event.target.value
          )
        }
      />
    </section>

    <section className="form-card">
      <label>
        Expiry Date *
      </label>

      <input
        type="date"
        value={
          replacementForm.expiryDate
        }
        onChange={(event) =>
          updateReplacementField(
            "expiryDate",
            event.target.value
          )
        }
      />

      {replacementForm.expiryDate && (
        <p className="field-help">
          {(() => {
            const info =
              getExpiryInfo(
                replacementForm
                  .expiryDate
              );

            if (
              info.status ===
              "EXPIRED"
            ) {
              return "วันหมดอายุไม่ถูกต้อง";
            }

            return `เหลือ ${info.days} วัน ก่อนหมดอายุ`;
          })()}
        </p>
      )}
    </section>

    <div className="master-form-actions">
      <button
        className="secondary-button"
        onClick={() =>
          setPage("expiry")
        }
        disabled={saving}
      >
        ยกเลิก
      </button>

      <button
        className="primary-button"
        onClick={
          completeReplacement
        }
        disabled={saving}
      >
        {saving
          ? "กำลังบันทึก..."
          : "ยืนยัน Replacement"}
      </button>
    </div>
  </section>
)}
        
{page === "masterForm" && (
  <section className="inspection-page">
    <button
      className="back-button"
      onClick={() =>
        setPage("list")
      }
    >
      ← กลับทะเบียน
    </button>

    <div className="page-heading">
      <div>
        <h1>
          {masterMode === "add"
            ? "เพิ่มถังดับเพลิง"
            : "แก้ไขข้อมูลถังดับเพลิง"}
        </h1>

        <p>
          {masterMode === "add"
            ? "สร้างรายการ Master ใหม่"
            : `แก้ไข Master ${masterForm.code}`}
        </p>
      </div>
    </div>

    <section className="form-card">
      <label>
        รหัสถังดับเพลิง *
      </label>

      <input
        value={masterForm.code}
        onChange={(event) =>
          updateMasterField(
            "code",
            event.target.value
              .trimStart()
              .toUpperCase()
          )
        }
        placeholder="เช่น FEG-1"
        disabled={
          masterMode === "edit"
        }
      />

      {masterMode === "edit" && (
        <p className="field-help">
          ไม่สามารถเปลี่ยน Code
          หลังสร้าง Master แล้ว
        </p>
      )}
    </section>

    <section className="form-card">
      <label>
        ประเภทถัง *
      </label>

      <select
        value={masterForm.type}
        onChange={(event) =>
          updateMasterField(
            "type",
            event.target.value
          )
        }
      >
        <option value="Dry Chemical">
          Dry Chemical
        </option>

        <option value="CO2">
          CO2
        </option>

        <option value="SC-AFFF+">
          SC-AFFF+
        </option>

        <option value="F-500">
          F-500
        </option>
      </select>
    </section>

    <section className="form-card">
      <label>
        ขนาด
      </label>

      <input
        value={masterForm.size}
        onChange={(event) =>
          updateMasterField(
            "size",
            event.target.value
          )
        }
        placeholder="เช่น 10 lb, 10 kg"
      />
    </section>

    <section className="form-card">
      <label>
        ตำแหน่งติดตั้ง *
      </label>

      <input
        value={masterForm.location}
        onChange={(event) =>
          updateMasterField(
            "location",
            event.target.value
          )
        }
        placeholder="เช่น Packing Line A"
      />
    </section>

    <section className="form-card">
      <label>
        วันที่ผลิต
      </label>

      <input
        type="date"
        value={
          masterForm.manufactureDate
        }
        onChange={(event) =>
          updateMasterField(
            "manufactureDate",
            event.target.value
          )
        }
      />
    </section>

    <section className="form-card">
      <label>
        วันหมดอายุ *
      </label>

      <input
        type="date"
        value={masterForm.expiryDate}
        onChange={(event) =>
          updateMasterField(
            "expiryDate",
            event.target.value
          )
        }
      />

      {masterForm.expiryDate && (
        <p className="field-help">
          {(() => {
            const info =
              getExpiryInfo(
                masterForm.expiryDate
              );

            if (
              info.status ===
              "EXPIRED"
            ) {
              return `หมดอายุแล้ว ${Math.abs(
                info.days
              )} วัน`;
            }

            if (
              info.status ===
              "EXPIRING"
            ) {
              return `เหลือ ${info.days} วัน ก่อนหมดอายุ`;
            }

            return `เหลือ ${info.days} วัน ก่อนหมดอายุ`;
          })()}
        </p>
      )}
    </section>

    <section className="form-card">
      <label>
        สถานะการใช้งาน
      </label>

      <select
        value={masterForm.status}
        onChange={(event) =>
          updateMasterField(
            "status",
            event.target.value
          )
        }
      >
        <option value="ACTIVE">
          ACTIVE
        </option>

        <option value="INACTIVE">
          INACTIVE
        </option>
      </select>
    </section>

    <section className="form-card">
      <label>
        Replacement Status
      </label>

      <select
        value={
          masterForm.replacementStatus
        }
        onChange={(event) =>
          updateMasterField(
            "replacementStatus",
            event.target.value
          )
        }
      >
        <option value="NONE">
          NONE
        </option>

        <option value="Request Replacement">
          Request Replacement
        </option>

        <option value="Procurement">
          Procurement
        </option>

        <option value="Replacement">
          Replacement
        </option>

        <option value="Verification">
          Verification
        </option>

        <option value="Completed">
          Completed
        </option>
      </select>
    </section>

    <div className="master-form-actions">
      <button
        className="secondary-button"
        onClick={() =>
          setPage("list")
        }
      >
        ยกเลิก
      </button>

      <button
         className="primary-button"
         onClick={saveMaster}
         disabled={saving}
      >
         {saving
           ? "กำลังบันทึก..."
           : masterMode === "add"
           ? "เพิ่มถังดับเพลิง"
           : "บันทึกการแก้ไข"}
       </button>
    </div>
{masterMode === "edit" && (
  <div className="danger-zone">
    <div className="danger-zone-title">
      Master Management
    </div>

    <p>
      หากถังไม่ได้ใช้งานแล้ว ให้ Deactivate
      เพื่อรักษาประวัติการตรวจ
    </p>

    {masterForm.status ===
      "ACTIVE" && (
      <button
        className="deactivate-button"
        onClick={() =>
          deactivateMaster(
            masterForm
          )
        }
        disabled={saving}
      >
        Deactivate
      </button>
    )}

    <button
      className="delete-master-button"
      onClick={() =>
        deleteMaster(
          masterForm
        )
      }
      disabled={saving}
    >
      Delete Permanently
    </button>
  </div>
)}
  </section>
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
              {selected.location}
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
              {getChecklistForType(selected.type).map(
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
