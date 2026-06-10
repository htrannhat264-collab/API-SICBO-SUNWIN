const express = require("express");
const WebSocket = require("ws");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SELF_URL = process.env.SELF_URL || `http://localhost:${PORT}`;

// ============================================================
// ========== MÁY BAY (AVIATOR) ==========
// ============================================================

const URL_AVIATOR = "wss://xgame.azhkthg1.net/sunphung";

let session_odds = {};         // { sid: [odd, odd, ...] }
let last_logged = new Set();   // SID đã in log
let logged_results = {};       // { sid: {Phien, Ket_qua, Thoigian, id} }
let last_odd_time = {};        // { sid: timestamp }
let keep_alive_count = 1;
let wsAviator = null;

function connectAviator() {
    wsAviator = new WebSocket(URL_AVIATOR, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Origin": "https://web.sunwin.ec"
        }
    });

    wsAviator.on("open", () => {
        console.log("[✈️] WebSocket Aviator đã kết nối");

        wsAviator.send(JSON.stringify([
            1, "MiniGame", "", "", {
                agentId: "1",
                accessToken: "13-0442a9806b0362b897defbae3454232c",
                reconnect: false
            }
        ]));

        setTimeout(() => wsAviator.send(JSON.stringify([6, "MiniGame", "lobbyPlugin", { cmd: 10002 }])), 1000);
        setTimeout(() => wsAviator.send(JSON.stringify([6, "MiniGame", "aviatorPlugin", { cmd: 100000, f: true }])), 2000);
        setTimeout(() => wsAviator.send(JSON.stringify([6, "MiniGame", "aviatorPlugin", { cmd: 100016 }])), 3000);
    });

    wsAviator.on("message", (data) => {
        try {
            const msg = JSON.parse(data);
            if (!Array.isArray(msg) || msg.length < 2 || typeof msg[1] !== "object") return;

            const payload = msg[1];
            const cmd = payload.cmd;
            const sid = payload.sid;
            const odd = payload.odd;

            if (cmd === 100009 && sid && typeof odd === "number") {
                if (!session_odds[sid]) session_odds[sid] = [];
                session_odds[sid].push(odd);
                last_odd_time[sid] = Date.now();
            }
        } catch (e) {
            console.log("❌ Lỗi xử lý message Aviator:", e.message);
        }
    });

    wsAviator.on("close", () => {
        console.log("🔌 WebSocket Aviator ngắt, thử kết nối lại sau 3s...");
        setTimeout(connectAviator, 3000);
    });

    wsAviator.on("error", (err) => {
        console.log("❌ WebSocket Aviator lỗi:", err.message);
    });
}

// Theo dõi phiên đã nổ
setInterval(() => {
    const now = Date.now();
    Object.keys(session_odds).forEach((sid) => {
        if (!last_logged.has(sid) && now - (last_odd_time[sid] || 0) > 2000) {
            const max_odd = Math.max(...session_odds[sid]);
            const time_str = new Date(now).toISOString().replace("T", " ").slice(0, 19);

            console.log(`[✈️💥] Máy bay NỔ ➜ SID: ${sid} | ODD: ${max_odd.toFixed(2)}x | ${time_str}`);
            last_logged.add(sid);

            logged_results[sid] = {
                Phien: parseInt(sid),
                Ket_qua: max_odd.toFixed(2),
                Thoigian: time_str,
                id: "@tranhoang2286"
            };
        }
    });
}, 500);

// KeepAlive
setInterval(() => {
    if (wsAviator && wsAviator.readyState === WebSocket.OPEN) {
        wsAviator.send(JSON.stringify(["7", "MiniGame", "1", keep_alive_count++]));
    }
}, 10000);

setInterval(() => {
    if (SELF_URL.includes("http")) {
        axios.get(`${SELF_URL}/api/aviator/latest`).catch(() => {});
    }
}, 5 * 60 * 1000);

// ============================================================
// ========== TÀI XỈU API ==========
// ============================================================

// Sunwin Sicbo API
const API_SUNWIN = "https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1";

// LC79 API
const API_LC79_TX = "https://wtx.tele68.com/v1/tx/sessions";
const API_LC79_MD5 = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// B52 API
const API_B52 = "https://b52-qiw2.onrender.com/api/history";

// Hitclub API
const API_HITCLUB = "https://sun-win.onrender.com/api/history";

// 68GB WebSocket
const WS_URL_68GB = "wss://mtsahwkvbim09mnwv.cq.qnwxdhwica.com/";
const TOKEN_HEX_68GB = "010000687b22636f6465223a3230302c22737973223a7b22686561727462656174223a31352c2273657269616c697a657222";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://tele68.com/",
    "Origin": "https://tele68.com"
};

const http = axios.create({ timeout: 10000, headers: HEADERS });

// ============================================================
// ========== HÀM TIỆN ÍCH CHUNG ==========
// ============================================================

function opp(c) {
    if (c === "Tài") return "Xỉu";
    if (c === "Xỉu") return "Tài";
    if (c === "TAI") return "XIU";
    if (c === "XIU") return "TAI";
    return "Xỉu";
}

function getStreak(arr) {
    if (!arr.length) return [0, null];
    let s = 1;
    const last = arr[arr.length - 1];
    for (let i = arr.length - 2; i >= 0; i--) {
        if (arr[i] === last) s++;
        else break;
    }
    return [s, last];
}

// ============================================================
// ========== THUẬT TOÁN HỌC CẦU ==========
// ============================================================

class HocCau {
    constructor() {
        this.pattern3 = new Map();
        this.pattern4 = new Map();
        this.pattern5 = new Map();
        this.pattern6 = new Map();
        this.pattern7 = new Map();
        this.cauDacBiet = new Map();
        this.tongPhien = 0;
    }

    static kyTu(kq) {
        if (kq === "Tài" || kq === "TAI") return "T";
        return "X";
    }

    hoc(lichSu) {
        if (!lichSu || lichSu.length < 15) return;
        const chuoi = lichSu.map(h => HocCau.kyTu(h.Ket_qua || h.resultTruyenThong));
        
        for (let len of [3, 4, 5, 6, 7]) {
            const map = this[`pattern${len}`];
            for (let i = 0; i <= chuoi.length - len - 1; i++) {
                const p = chuoi.slice(i, i + len).join('');
                const next = chuoi[i + len];
                if (!map.has(p)) map.set(p, { T: 0, X: 0, tong: 0 });
                const d = map.get(p);
                if (next === 'T') d.T++; else d.X++;
                d.tong++;
            }
        }
        
        for (let i = 0; i < chuoi.length - 3; i++) {
            let bet = 1;
            for (let j = i + 1; j < chuoi.length; j++) {
                if (chuoi[j] === chuoi[i]) bet++;
                else break;
            }
            if (bet >= 3 && i + bet < chuoi.length) {
                const key = `BET_${bet}`;
                if (!this.cauDacBiet.has(key)) this.cauDacBiet.set(key, { T: 0, X: 0, tong: 0 });
                const d = this.cauDacBiet.get(key);
                const next = chuoi[i + bet];
                if (next === 'T') d.T++; else d.X++;
                d.tong++;
            }
            
            if (i + 5 < chuoi.length) {
                let is11 = true;
                for (let j = 1; j < 5; j++) {
                    if (chuoi[i + j] === chuoi[i + j - 1]) { is11 = false; break; }
                }
                if (is11) {
                    const key = "CAU11";
                    if (!this.cauDacBiet.has(key)) this.cauDacBiet.set(key, { T: 0, X: 0, tong: 0 });
                    const d = this.cauDacBiet.get(key);
                    const next = chuoi[i + 5];
                    if (next === 'T') d.T++; else d.X++;
                    d.tong++;
                }
            }
            
            if (i + 7 < chuoi.length) {
                const c22 = (chuoi[i] === chuoi[i+1] && chuoi[i+2] === chuoi[i+3] && 
                             chuoi[i+4] === chuoi[i+5] && chuoi[i+6] === chuoi[i+7] &&
                             chuoi[i] !== chuoi[i+2] && chuoi[i+2] !== chuoi[i+4]);
                if (c22) {
                    const key = "CAU22";
                    if (!this.cauDacBiet.has(key)) this.cauDacBiet.set(key, { T: 0, X: 0, tong: 0 });
                    const d = this.cauDacBiet.get(key);
                    const next = chuoi[i + 8];
                    if (next === 'T') d.T++; else d.X++;
                    d.tong++;
                }
            }
        }
        this.tongPhien = lichSu.length;
    }
    
    nhanDang(lichSu) {
        if (!lichSu || lichSu.length < 10) return null;
        const chuoi = lichSu.slice(0, 12).map(h => HocCau.kyTu(h.Ket_qua || h.resultTruyenThong));
        const ketQua = [];
        
        let bet = 1;
        for (let i = 1; i < chuoi.length; i++) {
            if (chuoi[i] === chuoi[0]) bet++;
            else break;
        }
        if (bet >= 4) {
            const key = `BET_${bet}`;
            if (this.cauDacBiet.has(key)) {
                const d = this.cauDacBiet.get(key);
                if (d.tong >= 2) {
                    const tyLe = Math.max(d.T, d.X) / d.tong * 100;
                    ketQua.push({
                        duDoan: d.T > d.X ? (chuoi[0] === 'T' ? "Xỉu" : "Tài") : (chuoi[0] === 'T' ? "Tài" : "Xỉu"),
                        doTinCay: Math.min(94, Math.round(tyLe)),
                        loai: `🔴 Bệt ${bet}`,
                        giaiThich: `${bet} phiên ${chuoi[0] === 'T' ? "Tài" : "Xỉu"} liên tiếp`
                    });
                }
            } else {
                let doTin = bet >= 6 ? 88 : (bet === 5 ? 82 : 74);
                ketQua.push({
                    duDoan: chuoi[0] === 'T' ? "Xỉu" : "Tài",
                    doTinCay: doTin,
                    loai: `🔴 Bệt ${bet}`,
                    giaiThich: `${bet} phiên ${chuoi[0] === 'T' ? "Tài" : "Xỉu"} liên tiếp`
                });
            }
        }
        
        if (chuoi.length >= 6) {
            const p6 = chuoi.slice(0, 6).join('');
            if (this.pattern6.has(p6)) {
                const d = this.pattern6.get(p6);
                if (d.tong >= 2) {
                    const tyLe = Math.max(d.T, d.X) / d.tong * 100;
                    ketQua.push({
                        duDoan: d.T > d.X ? "Tài" : "Xỉu",
                        doTinCay: Math.min(88, Math.round(tyLe)),
                        loai: `📚 Pattern 6`,
                        giaiThich: `Pattern ${p6} xuất hiện ${d.tong} lần`
                    });
                }
            }
        }
        
        if (chuoi.length >= 8) {
            const cau22 = (chuoi[0] === chuoi[1] && chuoi[2] === chuoi[3] && chuoi[4] === chuoi[5] && chuoi[6] === chuoi[7] &&
                           chuoi[0] !== chuoi[2] && chuoi[2] !== chuoi[4]);
            if (cau22) {
                ketQua.push({
                    duDoan: chuoi[6] === 'T' ? "Xỉu" : "Tài",
                    doTinCay: 86,
                    loai: "🟢 Cầu 2-2",
                    giaiThich: "Cầu 2-2 đang chạy"
                });
            }
        }
        
        if (chuoi.length >= 6) {
            let is11 = true;
            for (let i = 1; i < 6; i++) {
                if (chuoi[i] === chuoi[i-1]) { is11 = false; break; }
            }
            if (is11) {
                ketQua.push({
                    duDoan: chuoi[0] === 'T' ? "Xỉu" : "Tài",
                    doTinCay: 80,
                    loai: "🔵 Cầu 1-1",
                    giaiThich: "Cầu 1-1 đan xen"
                });
            }
        }
        
        if (lichSu.length >= 15) {
            const last15 = lichSu.slice(0, 15);
            const tai15 = last15.filter(h => {
                const kq = h.Ket_qua || h.resultTruyenThong;
                return kq === "Tài" || kq === "TAI";
            }).length;
            if (tai15 >= 10) {
                ketQua.push({ duDoan: "Xỉu", doTinCay: 82, loai: "📊 Lệch pha", giaiThich: `${tai15}T-${15-tai15}X, bắt Xỉu` });
            } else if (tai15 <= 5) {
                ketQua.push({ duDoan: "Tài", doTinCay: 82, loai: "📊 Lệch pha", giaiThich: `${tai15}T-${15-tai15}X, bắt Tài` });
            }
        }
        
        return ketQua.length > 0 ? ketQua : null;
    }
}

// ============================================================
// ========== THUẬT TOÁN RIÊNG CHO TỪNG GAME ==========
// ============================================================

class GameAlgorithm {
    constructor(name) {
        this.name = name;
        this.hocCau = new HocCau();
        this.stats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };
        this.history = [];
    }
    
    predict(lichSu, customVotes = null) {
        if (lichSu.length < 5) return { duDoan: "Tài", doTinCay: 55, loaiCau: "chưa_đủ", giaiThich: "Chưa đủ dữ liệu" };
        
        this.hocCau.hoc(lichSu);
        const cacCau = this.hocCau.nhanDang(lichSu);
        const results = lichSu.map(h => h.Ket_qua || h.resultTruyenThong);
        
        let votes = [];
        
        if (customVotes) votes.push(...customVotes);
        
        if (cacCau) {
            for (const c of cacCau) votes.push({ pred: c.duDoan, conf: c.doTinCay, type: c.loai });
        }
        
        if (votes.length === 0) {
            const last = results[0];
            return { duDoan: opp(last), doTinCay: 60, loaiCau: "🔄 Đảo cầu", giaiThich: `${last} → ${opp(last)}` };
        }
        
        let tai = 0, xiu = 0;
        for (const v of votes) {
            if (v.pred === "Tài") tai += v.conf;
            else xiu += v.conf;
        }
        const final = tai > xiu ? "Tài" : "Xỉu";
        let conf = Math.floor((final === "Tài" ? tai : xiu) / (tai + xiu) * 100);
        conf = Math.min(94, Math.max(58, conf));
        
        if (this.stats.consecutiveLosses >= 3) {
            const opposite = final === "Tài" ? "Xỉu" : "Tài";
            return { duDoan: opposite, doTinCay: Math.max(55, conf - 10), loaiCau: "⚠️ CHỐNG ĐẢO", giaiThich: `Thua ${this.stats.consecutiveLosses} liên tiếp` };
        }
        
        const best = votes.reduce((a, b) => a.conf > b.conf ? a : b, votes[0]);
        return { duDoan: final, doTinCay: conf, loaiCau: best.type, giaiThich: best.type };
    }
    
    updateStats(pred, actual) {
        const dung = pred === actual;
        if (dung) { this.stats.correct++; this.stats.consecutiveLosses = 0; }
        else { this.stats.wrong++; this.stats.consecutiveLosses++; }
        this.stats.total++;
        return dung;
    }
}

// Khởi tạo algorithms
const sunwinAlgo = new GameAlgorithm("SUNWIN");
const lc79Algo = new GameAlgorithm("LC79");
const b52Algo = new GameAlgorithm("B52");
const hitclubAlgo = new GameAlgorithm("HITCLUB");
const gb68Algo = new GameAlgorithm("GB68");

// Lưu trữ lịch sử
let sunwinHistory = [];
let lc79History = [];
let b52History = [];
let hitclubHistory = [];
let gb68History = [];

// ============================================================
// ========== 68GB WEBSOCKET ==========
// ============================================================

let gb68Data = { txhu: { last_result: null, history: [] }, txmd5: { last_result: null, history: [] } };
let ws68 = null;

function connect68GB() {
    try {
        ws68 = new WebSocket(WS_URL_68GB);
        
        ws68.on('open', () => {
            console.log('[✅] 68GB WebSocket connected');
            const authMsg = Buffer.from(TOKEN_HEX_68GB, 'hex');
            ws68.send(authMsg);
        });
        
        ws68.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                if (parsed.code === 200 && parsed.data) {
                    const item = parsed.data;
                    const result = {
                        "Phiên trước": item.id || item.sessionId,
                        "kết quả": item.result === "TAI" || item.result === "BIG" ? "TÀI" : "XỈU",
                        "xúc xắc 1": item.dices?.[0] || item.xuc_xac_1,
                        "xúc xắc 2": item.dices?.[1] || item.xuc_xac_2,
                        "xúc xắc 3": item.dices?.[2] || item.xuc_xac_3,
                        "tổng điểm": item.point || item.total
                    };
                    
                    if (item.type === 'txhu' || !item.type) {
                        gb68Data.txhu.last_result = result;
                        if (!gb68Data.txhu.history.find(h => h["Phiên trước"] === result["Phiên trước"])) {
                            gb68Data.txhu.history.unshift(result);
                            if (gb68Data.txhu.history.length > 100) gb68Data.txhu.history.pop();
                        }
                    } else {
                        gb68Data.txmd5.last_result = result;
                        if (!gb68Data.txmd5.history.find(h => h["Phiên trước"] === result["Phiên trước"])) {
                            gb68Data.txmd5.history.unshift(result);
                            if (gb68Data.txmd5.history.length > 100) gb68Data.txmd5.history.pop();
                        }
                    }
                }
            } catch (e) {}
        });
        
        ws68.on('error', (err) => { console.error('[❌] 68GB WS error:', err.message); });
        ws68.on('close', () => { setTimeout(connect68GB, 5000); });
    } catch (e) { console.error('[❌] 68GB connect error:', e.message); setTimeout(connect68GB, 5000); }
}

// ============================================================
// ========== FETCH DATA ==========
// ============================================================

async function fetchSunwin() {
    try {
        const res = await http.get(API_SUNWIN);
        if (res.data?.data?.resultList) {
            return res.data.data.resultList.filter(item => item.resultType !== 11).map(item => ({
                Phien: parseInt(item.gameNum.replace('#', '')),
                Ket_qua: item.resultType === 3 ? "Tài" : "Xỉu",
                Tong: item.score,
                Xuc_xac_1: item.facesList?.[0],
                Xuc_xac_2: item.facesList?.[1],
                Xuc_xac_3: item.facesList?.[2],
                resultTruyenThong: item.resultType === 3 ? "TAI" : "XIU"
            }));
        }
        return null;
    } catch (e) { console.error("Fetch Sunwin lỗi:", e.message); return null; }
}

async function fetchLC79(url) {
    try {
        const res = await http.get(url);
        if (res.data?.list) {
            return res.data.list.map(item => ({
                Phien: item.id,
                Ket_qua: item.resultTruyenThong === "TAI" ? "Tài" : "Xỉu",
                Tong: item.point,
                Xuc_xac_1: item.dices[0],
                Xuc_xac_2: item.dices[1],
                Xuc_xac_3: item.dices[2],
                resultTruyenThong: item.resultTruyenThong
            }));
        }
        return null;
    } catch (e) { console.error("Fetch LC79 lỗi:", e.message); return null; }
}

async function fetchB52() {
    try {
        const res = await http.get(API_B52);
        if (res.data?.data) {
            return res.data.data.map(item => ({
                Phien: item.Phien,
                Ket_qua: item.Ket_qua === "Tài" ? "Tài" : "Xỉu",
                Tong: item.Tong,
                Xuc_xac_1: item.Xuc_xac_1,
                Xuc_xac_2: item.Xuc_xac_2,
                Xuc_xac_3: item.Xuc_xac_3,
                resultTruyenThong: item.Ket_qua === "Tài" ? "TAI" : "XIU"
            }));
        }
        return null;
    } catch (e) { console.error("Fetch B52 lỗi:", e.message); return null; }
}

async function fetchHitclub() {
    try {
        const res = await http.get(API_HITCLUB);
        if (res.data?.taixiu) {
            return res.data.taixiu.map(item => ({
                Phien: item.Phien,
                Ket_qua: item.Ket_qua === "Tài" ? "Tài" : "Xỉu",
                Tong: item.Tong,
                Xuc_xac_1: item.Xuc_xac_1,
                Xuc_xac_2: item.Xuc_xac_2,
                Xuc_xac_3: item.Xuc_xac_3,
                resultTruyenThong: item.Ket_qua === "Tài" ? "TAI" : "XIU"
            }));
        }
        return null;
    } catch (e) { console.error("Fetch Hitclub lỗi:", e.message); return null; }
}

// ============================================================
// ========== API HANDLER ==========
// ============================================================

// AVIATOR APIs
app.get("/api/aviator/latest", (req, res) => {
    const sids = Object.keys(logged_results);
    if (sids.length === 0) return res.json({ message: "Chưa có phiên nào nổ" });
    const latest_sid = Math.max(...sids.map(Number));
    res.json(logged_results[latest_sid]);
});

app.get("/api/aviator/history", (req, res) => {
    const sids = Object.keys(logged_results).map(Number).sort((a, b) => b - a).slice(0, 200);
    const result = sids.map((sid) => logged_results[sid]);
    res.json(result);
});

app.get("/api/aviator/status", (req, res) => {
    res.json({
        status: "Aviator đang chạy",
        tong_phien: Object.keys(session_odds).length,
        da_no: last_logged.size
    });
});

// SUNWIN
app.get("/api/sunwin", async (req, res) => {
    try {
        const data = await fetchSunwin();
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu Sunwin" });
        
        for (const item of data) {
            if (!sunwinHistory.find(h => h.Phien === item.Phien)) {
                sunwinHistory.unshift(item);
                if (sunwinHistory.length > 200) sunwinHistory.pop();
            }
        }
        
        const current = sunwinHistory[0];
        const pred = sunwinAlgo.predict(sunwinHistory);
        
        if (sunwinHistory.length >= 2) {
            const lastPred = sunwinHistory[1]?.du_doan;
            if (lastPred) sunwinAlgo.updateStats(lastPred, current.Ket_qua);
        }
        
        res.json({
            game: "SUNWIN_SICBO",
            phien: current.Phien,
            ket_qua: current.Ket_qua,
            xuc_xac: `${current.Xuc_xac_1} - ${current.Xuc_xac_2} - ${current.Xuc_xac_3}`,
            tong: current.Tong,
            du_doan: {
                phien: current.Phien + 1,
                du_doan: pred.duDoan,
                ti_le: `${pred.doTinCay}%`,
                loai_cau: pred.loaiCau,
                giai_thich: pred.giaiThich
            },
            thong_ke: {
                tong: sunwinAlgo.stats.total,
                dung: sunwinAlgo.stats.correct,
                sai: sunwinAlgo.stats.wrong,
                ti_le: sunwinAlgo.stats.total > 0 ? ((sunwinAlgo.stats.correct / sunwinAlgo.stats.total) * 100).toFixed(1) + '%' : '0%'
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// LC79 TX
app.get("/api/lc79/tx", async (req, res) => {
    try {
        const data = await fetchLC79(API_LC79_TX);
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu LC79 TX" });
        
        for (const item of data) {
            if (!lc79History.find(h => h.Phien === item.Phien)) {
                lc79History.unshift(item);
                if (lc79History.length > 200) lc79History.pop();
            }
        }
        
        const current = lc79History[0];
        const pred = lc79Algo.predict(lc79History);
        
        if (lc79History.length >= 2) {
            const lastPred = lc79History[1]?.du_doan;
            if (lastPred) lc79Algo.updateStats(lastPred, current.Ket_qua);
        }
        
        res.json({
            game: "LC79_TX",
            phien: current.Phien,
            ket_qua: current.Ket_qua,
            xuc_xac: `${current.Xuc_xac_1} - ${current.Xuc_xac_2} - ${current.Xuc_xac_3}`,
            tong: current.Tong,
            du_doan: {
                phien: current.Phien + 1,
                du_doan: pred.duDoan,
                ti_le: `${pred.doTinCay}%`,
                loai_cau: pred.loaiCau,
                giai_thich: pred.giaiThich
            },
            thong_ke: {
                tong: lc79Algo.stats.total,
                dung: lc79Algo.stats.correct,
                sai: lc79Algo.stats.wrong,
                ti_le: lc79Algo.stats.total > 0 ? ((lc79Algo.stats.correct / lc79Algo.stats.total) * 100).toFixed(1) + '%' : '0%'
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// LC79 MD5
app.get("/api/lc79/md5", async (req, res) => {
    try {
        const data = await fetchLC79(API_LC79_MD5);
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu LC79 MD5" });
        
        for (const item of data) {
            if (!lc79History.find(h => h.Phien === item.Phien)) {
                lc79History.unshift(item);
                if (lc79History.length > 200) lc79History.pop();
            }
        }
        
        const current = lc79History[0];
        const pred = lc79Algo.predict(lc79History);
        
        if (lc79History.length >= 2) {
            const lastPred = lc79History[1]?.du_doan;
            if (lastPred) lc79Algo.updateStats(lastPred, current.Ket_qua);
        }
        
        res.json({
            game: "LC79_MD5",
            phien: current.Phien,
            ket_qua: current.Ket_qua,
            xuc_xac: `${current.Xuc_xac_1} - ${current.Xuc_xac_2} - ${current.Xuc_xac_3}`,
            tong: current.Tong,
            du_doan: {
                phien: current.Phien + 1,
                du_doan: pred.duDoan,
                ti_le: `${pred.doTinCay}%`,
                loai_cau: pred.loaiCau,
                giai_thich: pred.giaiThich
            },
            thong_ke: {
                tong: lc79Algo.stats.total,
                dung: lc79Algo.stats.correct,
                sai: lc79Algo.stats.wrong,
                ti_le: lc79Algo.stats.total > 0 ? ((lc79Algo.stats.correct / lc79Algo.stats.total) * 100).toFixed(1) + '%' : '0%'
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// B52
app.get("/api/b52", async (req, res) => {
    try {
        const data = await fetchB52();
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu B52" });
        
        for (const item of data) {
            if (!b52History.find(h => h.Phien === item.Phien)) {
                b52History.unshift(item);
                if (b52History.length > 200) b52History.pop();
            }
        }
        
        const current = b52History[0];
        const pred = b52Algo.predict(b52History);
        
        if (b52History.length >= 2) {
            const lastPred = b52History[1]?.du_doan;
            if (lastPred) b52Algo.updateStats(lastPred, current.Ket_qua);
        }
        
        res.json({
            game: "B52",
            phien: current.Phien,
            ket_qua: current.Ket_qua,
            xuc_xac: `${current.Xuc_xac_1} - ${current.Xuc_xac_2} - ${current.Xuc_xac_3}`,
            tong: current.Tong,
            du_doan: {
                phien: current.Phien + 1,
                du_doan: pred.duDoan,
                ti_le: `${pred.doTinCay}%`,
                loai_cau: pred.loaiCau,
                giai_thich: pred.giaiThich
            },
            thong_ke: {
                tong: b52Algo.stats.total,
                dung: b52Algo.stats.correct,
                sai: b52Algo.stats.wrong,
                ti_le: b52Algo.stats.total > 0 ? ((b52Algo.stats.correct / b52Algo.stats.total) * 100).toFixed(1) + '%' : '0%'
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// HITCLUB
app.get("/api/hitclub", async (req, res) => {
    try {
        const data = await fetchHitclub();
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu Hitclub" });
        
        for (const item of data) {
            if (!hitclubHistory.find(h => h.Phien === item.Phien)) {
                hitclubHistory.unshift(item);
                if (hitclubHistory.length > 200) hitclubHistory.pop();
            }
        }
        
        const current = hitclubHistory[0];
        const pred = hitclubAlgo.predict(hitclubHistory);
        
        if (hitclubHistory.length >= 2) {
            const lastPred = hitclubHistory[1]?.du_doan;
            if (lastPred) hitclubAlgo.updateStats(lastPred, current.Ket_qua);
        }
        
        res.json({
            game: "HITCLUB",
            phien: current.Phien,
            ket_qua: current.Ket_qua,
            xuc_xac: `${current.Xuc_xac_1} - ${current.Xuc_xac_2} - ${current.Xuc_xac_3}`,
            tong: current.Tong,
            du_doan: {
                phien: current.Phien + 1,
                du_doan: pred.duDoan,
                ti_le: `${pred.doTinCay}%`,
                loai_cau: pred.loaiCau,
                giai_thich: pred.giaiThich
            },
            thong_ke: {
                tong: hitclubAlgo.stats.total,
                dung: hitclubAlgo.stats.correct,
                sai: hitclubAlgo.stats.wrong,
                ti_le: hitclubAlgo.stats.total > 0 ? ((hitclubAlgo.stats.correct / hitclubAlgo.stats.total) * 100).toFixed(1) + '%' : '0%'
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 68GB APIs
app.get("/api/68gb/txhu", async (req, res) => {
    res.json(gb68Data.txhu.last_result || { error: "No data", note: "Đang kết nối WebSocket..." });
});

app.get("/api/68gb/txmd5", async (req, res) => {
    res.json(gb68Data.txmd5.last_result || { error: "No data", note: "Đang kết nối WebSocket..." });
});

app.get("/api/68gb/history/txhu", (req, res) => {
    res.json(gb68Data.txhu.history.slice().reverse());
});

app.get("/api/68gb/history/txmd5", (req, res) => {
    res.json(gb68Data.txmd5.history.slice().reverse());
});

app.get("/api/68gb/predict/txhu", async (req, res) => {
    if (!gb68Data.txhu.history.length) return res.json({ error: "Chưa có dữ liệu" });
    const history = gb68Data.txhu.history.map(h => ({
        Ket_qua: h["kết quả"] === "TÀI" ? "Tài" : "Xỉu",
        resultTruyenThong: h["kết quả"] === "TÀI" ? "TAI" : "XIU"
    }));
    const pred = gb68Algo.predict(history);
    res.json({
        game: "68GB_TXHU",
        du_doan: {
            du_doan: pred.duDoan,
            ti_le: `${pred.doTinCay}%`,
            loai_cau: pred.loaiCau,
            giai_thich: pred.giaiThich
        }
    });
});

app.get("/api/68gb/predict/txmd5", async (req, res) => {
    if (!gb68Data.txmd5.history.length) return res.json({ error: "Chưa có dữ liệu" });
    const history = gb68Data.txmd5.history.map(h => ({
        Ket_qua: h["kết quả"] === "TÀI" ? "Tài" : "Xỉu",
        resultTruyenThong: h["kết quả"] === "TÀI" ? "TAI" : "XIU"
    }));
    const pred = gb68Algo.predict(history);
    res.json({
        game: "68GB_TXMD5",
        du_doan: {
            du_doan: pred.duDoan,
            ti_le: `${pred.doTinCay}%`,
            loai_cau: pred.loaiCau,
            giai_thich: pred.giaiThich
        }
    });
});

// ALL STATS
app.get("/api/all/stats", (req, res) => {
    res.json({
        aviator: { status: "running", tong_phien: Object.keys(session_odds).length, da_no: last_logged.size },
        sunwin: { tong: sunwinAlgo.stats.total, dung: sunwinAlgo.stats.correct, sai: sunwinAlgo.stats.wrong, ti_le: sunwinAlgo.stats.total > 0 ? ((sunwinAlgo.stats.correct / sunwinAlgo.stats.total) * 100).toFixed(1) + '%' : '0%' },
        lc79: { tong: lc79Algo.stats.total, dung: lc79Algo.stats.correct, sai: lc79Algo.stats.wrong, ti_le: lc79Algo.stats.total > 0 ? ((lc79Algo.stats.correct / lc79Algo.stats.total) * 100).toFixed(1) + '%' : '0%' },
        b52: { tong: b52Algo.stats.total, dung: b52Algo.stats.correct, sai: b52Algo.stats.wrong, ti_le: b52Algo.stats.total > 0 ? ((b52Algo.stats.correct / b52Algo.stats.total) * 100).toFixed(1) + '%' : '0%' },
        hitclub: { tong: hitclubAlgo.stats.total, dung: hitclubAlgo.stats.correct, sai: hitclubAlgo.stats.wrong, ti_le: hitclubAlgo.stats.total > 0 ? ((hitclubAlgo.stats.correct / hitclubAlgo.stats.total) * 100).toFixed(1) + '%' : '0%' },
        gb68: { note: "Đang cập nhật từ WebSocket" }
    });
});

// ROOT
app.get("/", (req, res) => {
    res.json({
        name: "🎲 API TÀI XỈU + MÁY BAY 🎲",
        author: "@tranhoang2286",
        version: "14.0",
        endpoints: {
            aviator: { latest: "/api/aviator/latest", history: "/api/aviator/history", status: "/api/aviator/status" },
            sunwin: "/api/sunwin",
            lc79_tx: "/api/lc79/tx",
            lc79_md5: "/api/lc79/md5",
            b52: "/api/b52",
            hitclub: "/api/hitclub",
            gb68_txhu: "/api/68gb/txhu",
            gb68_txmd5: "/api/68gb/txmd5",
            gb68_predict_txhu: "/api/68gb/predict/txhu",
            gb68_predict_txmd5: "/api/68gb/predict/txmd5",
            all_stats: "/api/all/stats"
        }
    });
});

// ============================================================
// ========== KHỞI ĐỘNG ==========
// ============================================================

// Khởi động Aviator WebSocket
connectAviator();

// Khởi động 68GB WebSocket
connect68GB();

// Auto refresh data
setInterval(() => {
    fetchSunwin().catch(() => {});
    fetchLC79(API_LC79_TX).catch(() => {});
    fetchLC79(API_LC79_MD5).catch(() => {});
    fetchB52().catch(() => {});
    fetchHitclub().catch(() => {});
}, 10000);

app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🎲 API TÀI XỈU + MÁY BAY - PORT ${PORT}`);
    console.log(`============================================================`);
    console.log(`✅ Aviator: http://localhost:${PORT}/api/aviator/latest`);
    console.log(`✅ Sunwin: http://localhost:${PORT}/api/sunwin`);
    console.log(`✅ LC79 TX: http://localhost:${PORT}/api/lc79/tx`);
    console.log(`✅ LC79 MD5: http://localhost:${PORT}/api/lc79/md5`);
    console.log(`✅ B52: http://localhost:${PORT}/api/b52`);
    console.log(`✅ Hitclub: http://localhost:${PORT}/api/hitclub`);
    console.log(`✅ 68GB: http://localhost:${PORT}/api/68gb/txhu`);
    console.log(`============================================================\n`);
});
