import { expeditionDB } from "./data.js";

const weightConfigs = [
  { id: "w_fuel", label: "⛽ 燃料", val: 1.0 },
  { id: "w_ammo", label: "💣 彈藥", val: 1.0 },
  { id: "w_steel", label: "🏗️ 鋼材", val: 1.0 },
  { id: "w_bauxite", label: "✈️ 鋁土", val: 3.0 },
  { id: "w_bucket", label: "💧 水桶", val: 0.0 },
  { id: "w_devMat", label: "🛠️ 開發", val: 0.0 },
  { id: "w_screw", label: "🔨 螺絲", val: 0.0 },
  { id: "w_torch", label: "🔫 火槍", val: 0.0 },
  { id: "w_boxS", label: "📦 家具箱 (小)", val: 0.0 },
  { id: "w_boxM", label: "📦 家具箱 (中)", val: 0.0 },
  { id: "w_boxL", label: "📦 家具箱 (大)", val: 0.0 },
  { id: "w_daihatsu", label: "💰 大發%", val: 0 },
];

let state = {
  isGS: false,
  hideMonthly: false,
  hideIncompatible: false,
  sortKey: "score",
  isAsc: false,
};

const fmt = (v, type = "sub") => {
  if (!v || v === 0) return "0";
  if (type === "res") return v.toFixed(0);
  return (Math.ceil(v * 10) / 10).toFixed(1);
};

function getTagClass(tag) {
  const map = {
    水桶: "tag-bucket",
    燃料: "tag-fuel",
    彈藥: "tag-ammo",
    鋁土: "tag-bauxite",
    鋼材: "tag-steel",
    月常: "tag-monthly",
    交戰: "tag-combat",
  };
  return map[tag] || "tag-default";
}

function init() {
  const panel = document.getElementById("weightPanel");

  panel.innerHTML = `<div class="section-title">⚖️ 收益權重設定</div> 
                        <div class="control-panel">
    ${weightConfigs
      .map(
        (c) => `
        <div class="weight-item">            
            <label>${c.label}</label>
            <input type="number" id="${c.id}" value="${c.val}" oninput="updateUI()">
        </div>
    `
      )
      .join("")}`;
  updateUI();
}

function updateTime() {
  const val = parseInt(document.getElementById("intervalSlider").value);
  document.getElementById("textTime").innerText = `${Math.floor(
    val / 60
  )} 小時 ${val % 60} 分鐘`;
  updateUI();
}

function toggleOption(key) {
  state[key] = !state[key];
  const btnMap = {
    isGS: "btnGS",
    hideMonthly: "btnMon",
    hideIncompatible: "btnLimit",
  };
  const labelMap = {
    isGS: "✨ 大成功",
    hideMonthly: "🚫 隱藏月常",
    hideIncompatible: "⏳ 隱藏不合適",
  };
  const btn = document.getElementById(btnMap[key]);
  btn.classList.toggle("active", state[key]);
  btn.innerText = `${labelMap[key]}: ${state[key] ? "ON" : "OFF"}`;
  updateUI();
}

function applyPreset(type) {
  const fields = [
    "w_fuel",
    "w_ammo",
    "w_steel",
    "w_bauxite",
    "w_bucket",
    "w_screw",
    "w_torch",
    "w_devMat",
    "w_boxS",
    "w_boxM",
    "w_boxL",
    "w_daihatsu",
  ];
  if (type === "reset") {
    const vals = [1.0, 1.0, 1.0, 3.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    fields.forEach((id, i) => (document.getElementById(id).value = vals[i]));
  } else {
    document.getElementById("w_fuel").value = type === "fuel" ? 3 : 1.0;
    document.getElementById("w_ammo").value = type === "ammo" ? 3 : 1.0;
    document.getElementById("w_steel").value = type === "steel" ? 3 : 1.0;
    document.getElementById("w_bauxite").value = type === "bauxite" ? 3 : 1.0;
    document.getElementById("w_bucket").value = type === "bucket" ? 500 : 1.0;
  }

  updateUI();
}

// UI 渲染邏輯
function updateUI() {
  const interval = parseInt(document.getElementById("intervalSlider").value);
  const search = document.getElementById("searchBar").value.toLowerCase();

  // 獲取權重
  const w = {};
  weightConfigs.forEach(
    (c) =>
      (w[c.id.replace("w_", "")] =
        parseFloat(document.getElementById(c.id).value) || 0)
  );

  // 大發動艇加成
  const daihatsu = 1 + w.daihatsu / 100;

  // 大成功加成
  const gsMult = state.isGS ? 1.5 : 1.0;

  // 副產物大成功加成(假設獲得機率為 50%)
  const prob = state.isGS ? 1.0 : 0.5;

  let rows = expeditionDB
    .map((exp) => {
      // 時間稀釋邏輯： 如果你 2 小時才回來一次，即便遠征只要 15 分鐘，產能也會被「稀釋」成 2 小時。
      const effectiveTime = Math.max(exp.duration, interval);
      const hFactor = 60 / effectiveTime;

      const data = {
        ...exp,
        // 資源獲取量 * 大成功加成 * 大發動挺 * 時間間格
        yFuel: exp.fuel * gsMult * daihatsu * hFactor,
        yAmmo: exp.ammo * gsMult * daihatsu * hFactor,
        ySteel: exp.steel * gsMult * daihatsu * hFactor,
        yBaux: exp.bauxite * gsMult * daihatsu * hFactor,

        //副產物獲取量 * 副產物大成功加成 * 時間間格
        yBucket: (exp.bucket || 0) * prob * hFactor,
        yDev: (exp.devMat || 0) * prob * hFactor,
        yScrew: (exp.screw || 0) * (state.isGS ? 1 : 0) * hFactor,
        yTorch: (exp.torch || 0) * prob * hFactor,
        yBoxS: (exp.boxS || 0) * prob * hFactor,
        yBoxM: (exp.boxM || 0) * prob * hFactor,
        yBoxL: (exp.boxL || 0) * prob * hFactor,
      };

      data.score = [
        "fuel",
        "ammo",
        "steel",
        "bauxite",
        "bucket",
        "devMat",
        "screw",
        "torch",
        "boxS",
        "boxM",
        "boxL",
      ].reduce(
        (sum, k) =>
          sum +
          (data["y" + k.charAt(0).toUpperCase() + k.slice(1)] || 0) * w[k],
        0
      );

      data.isNotFit =
        interval > 0 &&
        (exp.duration > interval * 1.75 || exp.duration < interval * 0.75);
      return data;
    })
    .filter((exp) => {
      if (state.hideMonthly && exp.tags.includes("月常")) return false;
      if (state.hideIncompatible && exp.isNotFit) return false;
      return (exp.id + exp.name + exp.tags.join(","))
        .toLowerCase()
        .includes(search);
    });

  const recs = rows
    .filter((r) => !r.isNotFit)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  renderDashboard(recs);
  renderTable(rows);
}

function renderDashboard(recs) {
  const container = document.getElementById("recFleetCards");
  const statsEl = document.getElementById("recTotalStats");
  if (recs.length === 0) return;

  container.innerHTML = recs
    .map(
      (r, i) => `
    <div class="rec-card">
      <div style="font-size:10px; color:#f39c12;">第 ${i + 2} 艦隊</div>
      <div style="font-weight:bold;">${r.id} ${r.name}</div>
    </div>`
    )
    .join("");

  const sum = (key) => recs.reduce((s, r) => s + r[key], 0);

  statsEl.innerHTML = `
    <b>預估總時收：</b><br>
    ⛽ ${fmt(sum("yFuel"), "res")} | 💣 ${fmt(sum("yAmmo"), "res")} | 
    🏗️ ${fmt(sum("ySteel"), "res")} | ✈️ ${fmt(sum("yBaux"), "res")} <br>
    💧 ${fmt(sum("yBucket"))} | 🔨 ${fmt(sum("yScrew"))} | 
    🔫 ${fmt(sum("yTorch"))} | 🛠️ ${fmt(sum("yDev"))} | 
    📦 ${fmt(sum("yBoxS") + sum("yBoxM") + sum("yBoxL"))}`;
}

function renderTable(rows) {
  rows.sort((a, b) => {
    let valA = a[state.sortKey];
    let valB = b[state.sortKey];

    // 針對 ID 進行自然排序 (1 -> 2 -> 10)
    if (state.sortKey === "id") {
      return (
        (state.isAsc ? 1 : -1) *
        valA.localeCompare(valB, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    }
    // 針對數值進行排序
    if (valA === valB) {
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    }
    return (state.isAsc ? 1 : -1) * (valA > valB ? 1 : -1);
  });

  document.getElementById("tbody").innerHTML = rows
    .map(
      (exp) => `
    <tr class="${exp.isNotFit ? "disabled" : ""}">
      <td><b>${exp.id}</b><br><small>第 ${exp.area} 海域</small></td>
      <td style="text-align:left">
        <b>${exp.name}</b><br>
        ${exp.tags
          .map((t) => `<span class="badge ${getTagClass(t)}">${t}</span>`)
          .join("")}
      </td>
      <td>${exp.duration}m</td>
      <td style="color:var(--fuel)">${fmt(exp.yFuel, "res")}</td>
      <td style="color:var(--ammo)">${fmt(exp.yAmmo, "res")}</td>
      <td style="color:var(--steel)">${fmt(exp.ySteel, "res")}</td>
      <td style="color:var(--bauxite)">${fmt(exp.yBaux, "res")}</td>
      <td style="font-size:12px; text-align:left">${renderExtraRewards(
        exp
      )}</td>
      <td class="score-col">${exp.score.toFixed(0)}</td>
    </tr>`
    )
    .join("");
}

/**
 * 專門處理副產物顯示
 * @param {Object} exp
 * @returns {string}
 */
function renderExtraRewards(exp) {
  const rewards = [
    { val: exp.yBucket, icon: "💧" },
    { val: exp.yDev, icon: "🛠️" },
    { val: exp.yScrew, icon: "🔨" },
    { val: exp.yTorch, icon: "🔫" },
    { val: exp.yBoxS, icon: "📦(小)" },
    { val: exp.yBoxM, icon: "📦(中)" },
    { val: exp.yBoxL, icon: "📦(大)" },
  ];

  return rewards
    .filter((r) => r.val > 0) // 只留下有收益的
    .map((r) => {
      // 優化顯示邏輯：
      // 最小顯示單位： 0.1 以下都顯示 0.1
      const ceiledVal = Math.ceil(r.val * 10) / 10;

      return `${r.icon}${ceiledVal.toFixed(1)}`;
    }) // 格式化：圖示 + 數值(小數點1位)
    .join(" ");
}

function resort(k) {
  if (state.sortKey === k) state.isAsc = !state.isAsc;
  else {
    state.sortKey = k;
    state.isAsc = false;
  }
  updateUI();
}

window.updateUI = updateUI;
window.updateTime = updateTime;
window.toggleOption = toggleOption;
window.applyPreset = applyPreset;
window.resort = resort;

init();
