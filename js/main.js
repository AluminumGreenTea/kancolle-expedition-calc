import { expeditionDB } from "./data.js";

const weightConfigs = [
  { id: "w_fuel", label: "⛽ 燃料", val: 1.0 },
  { id: "w_ammo", label: "💣 彈藥", val: 1.0 },
  { id: "w_steel", label: "🏗️ 鋼材", val: 1.0 },
  { id: "w_bauxite", label: "✈️ 鋁土", val: 1.0 },
  { id: "w_bucket", label: "💧 水桶", val: 1.0 },
  { id: "w_devMat", label: "🛠️ 開發", val: 1.0 },
  { id: "w_screw", label: "🔨 螺絲", val: 1.0 },
  { id: "w_torch", label: "🔫 火槍", val: 1.0 },
  { id: "w_daihatsu", label: "💰 大發%", val: 0 },
];

let state = {
  isGS: false,
  hideMonthly: false,
  hideIncompatible: false,
  sortKey: "score",
  isAsc: false,
};

// 初始化 UI
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
    const vals = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
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

function updateUI() {
  const interval = parseInt(document.getElementById("intervalSlider").value);
  const search = document.getElementById("searchBar").value.toLowerCase();

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

      // 資源獲取量 * 大成功加成 * 大發動挺 * 時間間格
      const yFuel = exp.fuel * gsMult * daihatsu * hFactor;
      const yAmmo = exp.ammo * gsMult * daihatsu * hFactor;
      const ySteel = exp.steel * gsMult * daihatsu * hFactor;
      const yBaux = exp.bauxite * gsMult * daihatsu * hFactor;

      //副產物獲取量 * 副產物大成功加成 * 時間間格
      const yBucket = (exp.bucket || 0) * prob * hFactor;
      const yDev = (exp.devMat || 0) * prob * hFactor;
      const yScrew = (exp.screw || 0) * (state.isGS ? 1 : 0) * hFactor;
      const yTorch = (exp.torch || 0) * prob * hFactor;

      const score =
        yFuel * w.fuel +
        yAmmo * w.ammo +
        ySteel * w.steel +
        yBaux * w.bauxite +
        yBucket * w.bucket +
        yDev * w.devMat +
        yScrew * w.screw +
        yTorch * w.torch;

      // 效率判定：太長或太短(稀釋超過25%)
      const isTooLong = interval > 0 && exp.duration > interval * 1.75;
      const isTooShort = interval > 0 && exp.duration < interval * 0.75;
      const isNotFit = isTooLong || isTooShort;

      return {
        ...exp,
        yFuel,
        yAmmo,
        ySteel,
        yBaux,
        yBucket,
        yDev,
        yScrew,
        yTorch,
        score,
        isNotFit,
        isTooLong,
      };
    })
    .filter((exp) => {
      if (state.hideMonthly && exp.tags.includes("月常")) return false;
      if (state.hideIncompatible && exp.isNotFit) return false;
      return (exp.id + exp.name + exp.tags.join(","))
        .toLowerCase()
        .includes(search);
    });

  // 推薦 Logic
  const recs = [...rows]
    .filter((r) => !r.isNotFit)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const recContainer = document.getElementById("recFleetCards");
  if (recs.length > 0) {
    recContainer.innerHTML = recs
      .map(
        (r, i) => `
            <div class="rec-card">
                <div style="font-size:10px; color:#f39c12;">第 ${
                  i + 2
                } 艦隊</div>
                <div style="font-weight:bold;">${r.id} ${r.name}</div>
            </div>
        `
      )
      .join("");
    const sumF = recs.reduce((s, r) => s + r.yFuel, 0);
    const sumA = recs.reduce((s, r) => s + r.yAmmo, 0);
    const sumS = recs.reduce((s, r) => s + r.ySteel, 0);
    const sumB = recs.reduce((s, r) => s + r.yBaux, 0);
    const sumBk = recs.reduce((s, r) => s + r.yBucket, 0);
    const sumD = recs.reduce((s, r) => s + r.yDev, 0);
    const sumSc = recs.reduce((s, r) => s + r.yScrew, 0);
    const sumT = recs.reduce((s, r) => s + r.yTorch, 0);

    document.getElementById("recTotalStats").innerHTML = `<b>預估時收：</b><br>
        ⛽ 燃料 ${sumF.toFixed(0)} | 💣 彈藥 ${sumA.toFixed(0)}
        | 🏗️ 鋼材 ${sumS.toFixed(0)} | ✈️ 鋁土 ${sumB.toFixed(0)}
        | 💧 水桶 ${sumBk.toFixed(0)} | 🔨 螺絲 ${sumSc.toFixed(0)}
        | 🔫 火槍 ${sumT.toFixed(0)} | 🛠️ 開發 ${sumD.toFixed(0)}
        | 📦 小箱 ${sumA.toFixed(0)}
        | 📦 中箱 ${sumA.toFixed(0)} | 📦 大箱 ${sumA.toFixed(0)}
        <br>🛠️開發 ${recs.reduce((s, r) => s + r.yDev, 0).toFixed(1)} / hr`;
  }

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
            <td><b>${exp.id}</b><span class="area-tag">第 ${
        exp.area
      } 海域</span></td>
            <td style="text-align:left">
                <div style="font-weight:bold;">${exp.name}</div>
                ${exp.tags
                  .map(
                    (t) => `<span class="badge ${getTagClass(t)}">${t}</span>`
                  )
                  .join("")}
            </td>
            <td>${exp.duration}m</td>
            <td class="res-val" style="color:var(--fuel)">${exp.yFuel.toFixed(
              0
            )}</td>
            <td class="res-val" style="color:var(--ammo)">${exp.yAmmo.toFixed(
              0
            )}</td>
            <td class="res-val" style="color:var(--steel)">${exp.ySteel.toFixed(
              0
            )}</td>
            <td class="res-val" style="color:var(--bauxite)">${exp.yBaux.toFixed(
              0
            )}</td>
            <td style="font-size:12px; text-align:left">
                ${exp.yBucket > 0 ? `💧${exp.yBucket.toFixed(1)} ` : ""}${
        exp.yDev > 0 ? `🛠️${exp.yDev.toFixed(1)} ` : ""
      }${exp.yScrew > 0 ? `🔨${exp.yScrew.toFixed(1)} ` : ""}
            </td>
            <td class="score-col">${exp.score.toFixed(0)}</td>
        </tr>
    `
    )
    .join("");
}

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

function resort(k) {
  if (state.sortKey === k) state.isAsc = !state.isAsc;
  else {
    state.sortKey = k;
    state.isAsc = false;
  }
  updateUI();
}

init();
