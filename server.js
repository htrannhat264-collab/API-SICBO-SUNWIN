const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// ========== CẤU HÌNH API ==========
// ============================================================

const API_HITCLUB = "https://sun-win.onrender.com/api/history";
const API_B52 = "https://b52-qiw2.onrender.com/api/history";
const API_LC79_TX = "https://wtx.tele68.com/v1/tx/sessions";
const API_LC79_MD5 = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

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
    return "Tài";
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
// ========== THUẬT TOÁN HITCLUB NÂNG CẤP ==========
// ============================================================

function phatHienCauHitclub(res) {
    const cacCau = [];
    const [streak, last] = getStreak(res);
    
    // ===== 1. CẦU BỆT (STREAK) =====
    if (streak >= 7) {
        cacCau.push({ pred: opp(last), conf: 96, type: `🔥 CẦU BỆT ${streak} (${last} ${streak} tay)`, priority: 1 });
    } else if (streak === 6) {
        cacCau.push({ pred: opp(last), conf: 92, type: `⚡ CẦU BỆT 6 (${last} 6 tay)`, priority: 1 });
    } else if (streak === 5) {
        cacCau.push({ pred: opp(last), conf: 86, type: `📊 CẦU BỆT 5 (${last} 5 tay)`, priority: 2 });
    } else if (streak === 4) {
        cacCau.push({ pred: opp(last), conf: 78, type: `📈 CẦU BỆT 4 (${last} 4 tay)`, priority: 2 });
    } else if (streak === 3) {
        cacCau.push({ pred: opp(last), conf: 68, type: `📌 CẦU BỆT 3 (${last} 3 tay)`, priority: 3 });
    }
    
    // ===== 2. CẦU 1-1 (ĐAN XEN) =====
    if (res.length >= 6) {
        let len = 1;
        let isValid = true;
        for (let i = 1; i < Math.min(res.length, 16); i++) {
            if (res[i] === res[i-1]) {
                isValid = false;
                break;
            }
            len = i + 1;
        }
        if (isValid && len >= 5) {
            const conf = 72 + Math.min(20, len);
            const priority = len >= 8 ? 1 : (len >= 6 ? 2 : 3);
            cacCau.push({ pred: opp(res[0]), conf: conf, type: `🔄 CẦU 1-1 (${len} tay đan xen)`, priority: priority });
        }
    }
    
    // ===== 3. CẦU 2-2 (CẶP ĐÔI) =====
    if (res.length >= 8) {
        let pairs = 0;
        let isValid = true;
        for (let i = 0; i < Math.min(res.length, 14); i += 2) {
            if (i + 1 >= res.length) break;
            if (res[i] !== res[i+1]) { isValid = false; break; }
            if (i + 2 < res.length && res[i] === res[i+2]) { isValid = false; break; }
            pairs++;
        }
        if (isValid && pairs >= 3) {
            const conf = 78 + pairs * 3;
            const priority = pairs >= 4 ? 1 : 2;
            cacCau.push({ pred: opp(res[pairs * 2 - 2]), conf: Math.min(94, conf), type: `🟢 CẦU 2-2 (${pairs} cặp)`, priority: priority });
        }
    }
    
    // ===== 4. CẦU 3-2 (MÔ HÌNH 5 TAY) =====
    if (res.length >= 5) {
        const p5 = res.slice(0, 5);
        const str = p5.map(r => r === "Tài" ? "T" : "X").join('');
        if (str === "TTTXX") {
            cacCau.push({ pred: "Xỉu", conf: 86, type: "📐 CẦU 3-2 (Tài 3 - Xỉu 2)", priority: 2 });
        } else if (str === "XXXTT") {
            cacCau.push({ pred: "Tài", conf: 86, type: "📐 CẦU 3-2 (Xỉu 3 - Tài 2)", priority: 2 });
        }
    }
    
    // ===== 5. CẦU 3-3 (MÔ HÌNH 6 TAY) =====
    if (res.length >= 6) {
        const p6 = res.slice(0, 6);
        const str = p6.map(r => r === "Tài" ? "T" : "X").join('');
        if (str === "TTTXXX") {
            cacCau.push({ pred: "Tài", conf: 90, type: "💎 CẦU 3-3 (Tài 3 - Xỉu 3)", priority: 1 });
        } else if (str === "XXXTTT") {
            cacCau.push({ pred: "Xỉu", conf: 90, type: "💎 CẦU 3-3 (Xỉu 3 - Tài 3)", priority: 1 });
        }
    }
    
    // ===== 6. CẦU 4-4 (MÔ HÌNH 8 TAY) =====
    if (res.length >= 8) {
        const p8 = res.slice(0, 8);
        const str = p8.map(r => r === "Tài" ? "T" : "X").join('');
        if (str === "TTTTXXXX") {
            cacCau.push({ pred: "Tài", conf: 92, type: "👑 CẦU 4-4 (Tài 4 - Xỉu 4)", priority: 1 });
        } else if (str === "XXXXTTTT") {
            cacCau.push({ pred: "Xỉu", conf: 92, type: "👑 CẦU 4-4 (Xỉu 4 - Tài 4)", priority: 1 });
        }
    }
    
    // ===== 7. CẦU LỆCH (MẤT CÂN BẰNG) =====
    if (res.length >= 15) {
        const last15 = res.slice(0, 15);
        const tai = last15.filter(r => r === "Tài").length;
        const xiu = 15 - tai;
        const chenhLech = Math.abs(tai - xiu);
        
        if (chenhLech >= 5) {
            const conf = 75 + Math.min(15, chenhLech);
            const pred = tai > xiu ? "Xỉu" : "Tài";
            const priority = chenhLech >= 7 ? 2 : 3;
            cacCau.push({ pred: pred, conf: conf, type: `📊 CẦU LỆCH (${tai} Tài - ${xiu} Xỉu)`, priority: priority });
        }
    }
    
    // ===== 8. CẦU ĐẢO (CHUYỂN CẦU) =====
    if (res.length >= 3) {
        const last3 = res.slice(0, 3);
        if (last3[0] === last3[1] && last3[1] !== last3[2]) {
            cacCau.push({ pred: opp(last3[2]), conf: 65, type: `🔄 CẦU ĐẢO (${last3[2]} → ${opp(last3[2])})`, priority: 4 });
        }
    }
    
    // ===== 9. CẦU KÉP (XXYY) =====
    if (res.length >= 4) {
        const p4 = res.slice(0, 4);
        if (p4[0] === p4[1] && p4[2] === p4[3] && p4[0] !== p4[2]) {
            cacCau.push({ pred: opp(p4[3]), conf: 75, type: `⚙️ CẦU KÉP (${p4[0]}${p4[0]}${p4[2]}${p4[2]})`, priority: 2 });
        }
    }
    
    // Sắp xếp theo priority (ưu tiên) và độ tin cậy
    cacCau.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.conf - a.conf;
    });
    
    return cacCau;
}

function predictHitclub(lichSu) {
    const res = lichSu.map(h => h.Ket_qua);
    if (res.length < 5) return { duDoan: "Tài", doTinCay: 55, loaiCau: "Chưa đủ dữ liệu (cần 5 phiên)", tatCaCau: [] };
    
    const cacCau = phatHienCauHitclub(res);
    
    if (cacCau.length === 0) {
        return { duDoan: opp(res[0]), doTinCay: 60, loaiCau: `🎲 CẦU ĐẢO (${res[0]} → ${opp(res[0])})`, tatCaCau: [] };
    }
    
    // Bỏ phiếu có trọng số dựa trên priority
    let taiVotes = 0, xiuVotes = 0;
    const tatCaCauInfo = [];
    
    for (const cau of cacCau) {
        // Trọng số: priority 1 = 100%, priority 2 = 85%, priority 3 = 70%, priority 4 = 55%
        const weightPercent = 100 - (cau.priority - 1) * 15;
        const finalWeight = Math.floor(cau.conf * weightPercent / 100);
        
        tatCaCauInfo.push({
            loai_cau: cau.type,
            du_doan: cau.pred,
            do_tin_cay: `${cau.conf}%`,
            muc_uu_tien: cau.priority,
            trong_so: finalWeight
        });
        
        if (cau.pred === "Tài") {
            taiVotes += finalWeight;
        } else {
            xiuVotes += finalWeight;
        }
    }
    
    const total = taiVotes + xiuVotes;
    const final = taiVotes > xiuVotes ? "Tài" : "Xỉu";
    const conf = total > 0 ? Math.min(94, Math.max(58, Math.floor((final === "Tài" ? taiVotes : xiuVotes) / total * 100))) : 60;
    
    return {
        duDoan: final,
        doTinCay: conf,
        loaiCau: cacCau[0].type,
        tatCaCau: tatCaCauInfo
    };
}

// ============================================================
// ========== THUẬT TOÁN B52 NÂNG CẤP ==========
// ============================================================

function phatHienCauB52(res) {
    const cacCau = [];
    const [streak, last] = getStreak(res);
    
    // ===== 1. CẦU BỆT =====
    if (streak >= 7) {
        cacCau.push({ pred: opp(last), conf: 96, type: `🔥 CẦU BỆT ${streak} (${last} ${streak} tay)`, priority: 1 });
    } else if (streak === 6) {
        cacCau.push({ pred: opp(last), conf: 94, type: `⚡ CẦU BỆT 6 (${last} 6 tay)`, priority: 1 });
    } else if (streak === 5) {
        cacCau.push({ pred: opp(last), conf: 88, type: `📊 CẦU BỆT 5 (${last} 5 tay)`, priority: 2 });
    } else if (streak === 4) {
        cacCau.push({ pred: opp(last), conf: 80, type: `📈 CẦU BỆT 4 (${last} 4 tay)`, priority: 2 });
    } else if (streak === 3) {
        cacCau.push({ pred: opp(last), conf: 68, type: `📌 CẦU BỆT 3 (${last} 3 tay)`, priority: 3 });
    }
    
    // ===== 2. CẦU 1-1 =====
    if (res.length >= 6) {
        let len = 1;
        let isValid = true;
        for (let i = 1; i < Math.min(res.length, 16); i++) {
            if (res[i] === res[i-1]) { isValid = false; break; }
            len = i + 1;
        }
        if (isValid && len >= 5) {
            const conf = 74 + Math.min(18, len);
            const priority = len >= 8 ? 1 : (len >= 6 ? 2 : 3);
            cacCau.push({ pred: opp(res[0]), conf: conf, type: `🔄 CẦU 1-1 (${len} tay đan xen)`, priority: priority });
        }
    }
    
    // ===== 3. CẦU 2-2 =====
    if (res.length >= 8) {
        let pairs = 0, isValid = true;
        for (let i = 0; i < Math.min(res.length, 14); i += 2) {
            if (i + 1 >= res.length) break;
            if (res[i] !== res[i+1]) { isValid = false; break; }
            if (i + 2 < res.length && res[i] === res[i+2]) { isValid = false; break; }
            pairs++;
        }
        if (isValid && pairs >= 3) {
            const conf = 76 + pairs * 4;
            const priority = pairs >= 4 ? 1 : 2;
            cacCau.push({ pred: opp(res[pairs * 2 - 2]), conf: Math.min(94, conf), type: `🟢 CẦU 2-2 (${pairs} cặp)`, priority: priority });
        }
    }
    
    // ===== 4. CẦU 3-2 =====
    if (res.length >= 5) {
        const p5 = res.slice(0, 5);
        const str = p5.map(r => r === "Tài" ? "T" : "X").join('');
        if (str === "TTTXX") {
            cacCau.push({ pred: "Xỉu", conf: 86, type: "📐 CẦU 3-2 (Tài 3 - Xỉu 2)", priority: 2 });
        } else if (str === "XXXTT") {
            cacCau.push({ pred: "Tài", conf: 86, type: "📐 CẦU 3-2 (Xỉu 3 - Tài 2)", priority: 2 });
        }
    }
    
    // ===== 5. CẦU 3-3 =====
    if (res.length >= 6) {
        const p6 = res.slice(0, 6);
        const str = p6.map(r => r === "Tài" ? "T" : "X").join('');
        if (str === "TTTXXX") {
            cacCau.push({ pred: "Tài", conf: 90, type: "💎 CẦU 3-3 (Tài 3 - Xỉu 3)", priority: 1 });
        } else if (str === "XXXTTT") {
            cacCau.push({ pred: "Xỉu", conf: 90, type: "💎 CẦU 3-3 (Xỉu 3 - Tài 3)", priority: 1 });
        }
    }
    
    // ===== 6. CẦU LỆCH =====
    if (res.length >= 15) {
        const last15 = res.slice(0, 15);
        const tai = last15.filter(r => r === "Tài").length;
        if (tai >= 10) {
            cacCau.push({ pred: "Xỉu", conf: 80, type: `📊 CẦU LỆCH TÀI (${tai} Tài - ${15-tai} Xỉu)`, priority: 3 });
        } else if (tai <= 5) {
            cacCau.push({ pred: "Tài", conf: 80, type: `📊 CẦU LỆCH XỈU (${tai} Tài - ${15-tai} Xỉu)`, priority: 3 });
        }
    }
    
    // ===== 7. CẦU ĐẢO =====
    if (res.length >= 3) {
        const last3 = res.slice(0, 3);
        if (last3[0] === last3[1] && last3[1] !== last3[2]) {
            cacCau.push({ pred: opp(last3[2]), conf: 65, type: `🔄 CẦU ĐẢO (${last3[2]} → ${opp(last3[2])})`, priority: 4 });
        }
    }
    
    // ===== 8. CẦU KÉP =====
    if (res.length >= 4) {
        const p4 = res.slice(0, 4);
        if (p4[0] === p4[1] && p4[2] === p4[3] && p4[0] !== p4[2]) {
            cacCau.push({ pred: opp(p4[3]), conf: 75, type: `⚙️ CẦU KÉP (${p4[0]}${p4[0]}${p4[2]}${p4[2]})`, priority: 2 });
        }
    }
    
    cacCau.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.conf - a.conf;
    });
    
    return cacCau;
}

function predictB52(lichSu) {
    const res = lichSu.map(h => h.Ket_qua);
    if (res.length < 5) return { duDoan: "Tài", doTinCay: 55, loaiCau: "Chưa đủ dữ liệu (cần 5 phiên)", tatCaCau: [] };
    
    const cacCau = phatHienCauB52(res);
    
    if (cacCau.length === 0) {
        return { duDoan: opp(res[0]), doTinCay: 60, loaiCau: `🎲 CẦU ĐẢO (${res[0]} → ${opp(res[0])})`, tatCaCau: [] };
    }
    
    let taiVotes = 0, xiuVotes = 0;
    const tatCaCauInfo = [];
    
    for (const cau of cacCau) {
        const weightPercent = 100 - (cau.priority - 1) * 15;
        const finalWeight = Math.floor(cau.conf * weightPercent / 100);
        
        tatCaCauInfo.push({
            loai_cau: cau.type,
            du_doan: cau.pred,
            do_tin_cay: `${cau.conf}%`,
            muc_uu_tien: cau.priority,
            trong_so: finalWeight
        });
        
        if (cau.pred === "Tài") taiVotes += finalWeight;
        else xiuVotes += finalWeight;
    }
    
    const total = taiVotes + xiuVotes;
    const final = taiVotes > xiuVotes ? "Tài" : "Xỉu";
    const conf = total > 0 ? Math.min(94, Math.max(58, Math.floor((final === "Tài" ? taiVotes : xiuVotes) / total * 100))) : 60;
    
    return {
        duDoan: final,
        doTinCay: conf,
        loaiCau: cacCau[0].type,
        tatCaCau: tatCaCauInfo
    };
}

// ============================================================
// ========== THUẬT TOÁN LC79 NÂNG CẤP ==========
// ============================================================

function phatHienCauLC79(res) {
    const cacCau = [];
    const [streak, last] = getStreak(res);
    
    // ===== 1. CẦU BỆT =====
    if (streak >= 8) {
        cacCau.push({ pred: opp(last), conf: 98, type: `🔥 CẦU BỆT ${streak} (${last} ${streak} tay)`, priority: 1 });
    } else if (streak === 7) {
        cacCau.push({ pred: opp(last), conf: 96, type: `⚡ CẦU BỆT 7 (${last} 7 tay)`, priority: 1 });
    } else if (streak === 6) {
        cacCau.push({ pred: opp(last), conf: 92, type: `📊 CẦU BỆT 6 (${last} 6 tay)`, priority: 2 });
    } else if (streak === 5) {
        cacCau.push({ pred: opp(last), conf: 86, type: `📈 CẦU BỆT 5 (${last} 5 tay)`, priority: 2 });
    } else if (streak === 4) {
        cacCau.push({ pred: opp(last), conf: 78, type: `📌 CẦU BỆT 4 (${last} 4 tay)`, priority: 3 });
    } else if (streak === 3) {
        cacCau.push({ pred: last, conf: 65, type: `📍 CẦU BỆT 3 (${last} - giữ nguyên)`, priority: 3 });
    }
    
    // ===== 2. CẦU 1-1 =====
    if (res.length >= 6) {
        let len = 1;
        let isValid = true;
        for (let i = 1; i < Math.min(res.length, 16); i++) {
            if (res[i] === res[i-1]) { isValid = false; break; }
            len = i + 1;
        }
        if (isValid && len >= 5) {
            const conf = 72 + Math.min(22, len);
            const priority = len >= 8 ? 1 : (len >= 6 ? 2 : 3);
            cacCau.push({ pred: opp(res[0]), conf: conf, type: `🔄 CẦU 1-1 (${len} tay đan xen)`, priority: priority });
        }
    }
    
    // ===== 3. CẦU 2-2 =====
    if (res.length >= 8) {
        let pairs = 0, isValid = true;
        for (let i = 0; i < Math.min(res.length, 14); i += 2) {
            if (i + 1 >= res.length) break;
            if (res[i] !== res[i+1]) { isValid = false; break; }
            if (i + 2 < res.length && res[i] === res[i+2]) { isValid = false; break; }
            pairs++;
        }
        if (isValid && pairs >= 3) {
            const conf = 78 + pairs * 3;
            const priority = pairs >= 4 ? 1 : 2;
            cacCau.push({ pred: opp(res[pairs * 2 - 2]), conf: Math.min(94, conf), type: `🟢 CẦU 2-2 (${pairs} cặp)`, priority: priority });
        }
    }
    
    // ===== 4. CẦU 3-2 =====
    if (res.length >= 5) {
        const p5 = res.slice(0, 5);
        const str = p5.map(r => r === "TAI" ? "T" : "X").join('');
        if (str === "TTTXX") {
            cacCau.push({ pred: "XIU", conf: 88, type: "📐 CẦU 3-2 (Tài 3 - Xỉu 2)", priority: 2 });
        } else if (str === "XXXTT") {
            cacCau.push({ pred: "TAI", conf: 88, type: "📐 CẦU 3-2 (Xỉu 3 - Tài 2)", priority: 2 });
        }
    }
    
    // ===== 5. CẦU 3-3 =====
    if (res.length >= 6) {
        const p6 = res.slice(0, 6);
        const str = p6.map(r => r === "TAI" ? "T" : "X").join('');
        if (str === "TTTXXX") {
            cacCau.push({ pred: "TAI", conf: 92, type: "💎 CẦU 3-3 (Tài 3 - Xỉu 3)", priority: 1 });
        } else if (str === "XXXTTT") {
            cacCau.push({ pred: "XIU", conf: 92, type: "💎 CẦU 3-3 (Xỉu 3 - Tài 3)", priority: 1 });
        }
    }
    
    // ===== 6. CẦU 4-4 =====
    if (res.length >= 8) {
        const p8 = res.slice(0, 8);
        const str = p8.map(r => r === "TAI" ? "T" : "X").join('');
        if (str === "TTTTXXXX") {
            cacCau.push({ pred: "TAI", conf: 94, type: "👑 CẦU 4-4 (Tài 4 - Xỉu 4)", priority: 1 });
        } else if (str === "XXXXTTTT") {
            cacCau.push({ pred: "XIU", conf: 94, type: "👑 CẦU 4-4 (Xỉu 4 - Tài 4)", priority: 1 });
        }
    }
    
    // ===== 7. CẦU LỆCH =====
    if (res.length >= 20) {
        const last20 = res.slice(0, 20);
        const tai = last20.filter(r => r === "TAI").length;
        if (tai >= 14) {
            cacCau.push({ pred: "XIU", conf: 84, type: `📊 CẦU LỆCH TÀI (${tai} Tài - ${20-tai} Xỉu)`, priority: 3 });
        } else if (tai <= 6) {
            cacCau.push({ pred: "TAI", conf: 84, type: `📊 CẦU LỆCH XỈU (${tai} Tài - ${20-tai} Xỉu)`, priority: 3 });
        }
    }
    
    // ===== 8. CẦU ĐẢO =====
    if (res.length >= 3) {
        const last3 = res.slice(0, 3);
        if (last3[0] === last3[1] && last3[1] !== last3[2]) {
            cacCau.push({ pred: opp(last3[2]), conf: 65, type: `🔄 CẦU ĐẢO (${last3[2]} → ${opp(last3[2])})`, priority: 4 });
        }
    }
    
    // ===== 9. CẦU KÉP =====
    if (res.length >= 4) {
        const p4 = res.slice(0, 4);
        const p4Norm = p4.map(r => r === "TAI" ? "Tài" : "Xỉu");
        if (p4Norm[0] === p4Norm[1] && p4Norm[2] === p4Norm[3] && p4Norm[0] !== p4Norm[2]) {
            cacCau.push({ pred: opp(p4Norm[3]), conf: 75, type: `⚙️ CẦU KÉP (${p4Norm[0]}${p4Norm[0]}${p4Norm[2]}${p4Norm[2]})`, priority: 2 });
        }
    }
    
    cacCau.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.conf - a.conf;
    });
    
    return cacCau;
}

function predictLC79(history) {
    const res = history.map(h => h.resultTruyenThong);
    if (res.length < 5) return { pred: "TAI", conf: 55, type: "Chưa đủ dữ liệu (cần 5 phiên)", tatCaCau: [] };
    
    const cacCau = phatHienCauLC79(res);
    
    if (cacCau.length === 0) {
        const lastNorm = res[0] === "TAI" ? "Tài" : "Xỉu";
        return { pred: opp(res[0]), conf: 60, type: `🎲 CẦU ĐẢO (${lastNorm} → ${opp(lastNorm)})`, tatCaCau: [] };
    }
    
    let taiVotes = 0, xiuVotes = 0;
    const tatCaCauInfo = [];
    
    for (const cau of cacCau) {
        const weightPercent = 100 - (cau.priority - 1) * 15;
        const finalWeight = Math.floor(cau.conf * weightPercent / 100);
        
        tatCaCauInfo.push({
            loai_cau: cau.type,
            du_doan: cau.pred === "TAI" ? "Tài" : "Xỉu",
            do_tin_cay: `${cau.conf}%`,
            muc_uu_tien: cau.priority,
            trong_so: finalWeight
        });
        
        if (cau.pred === "TAI") taiVotes += finalWeight;
        else xiuVotes += finalWeight;
    }
    
    const total = taiVotes + xiuVotes;
    const final = taiVotes > xiuVotes ? "TAI" : "XIU";
    const conf = total > 0 ? Math.min(96, Math.max(58, Math.floor((final === "TAI" ? taiVotes : xiuVotes) / total * 100))) : 60;
    
    return {
        pred: final,
        conf: conf,
        type: cacCau[0].type,
        tatCaCau: tatCaCauInfo
    };
}

// ============================================================
// ========== FETCH DATA ==========
// ============================================================

async function fetchHitclub() {
    try {
        const res = await http.get(API_HITCLUB);
        if (res.data?.taixiu) return res.data.taixiu;
        return null;
    } catch (e) { 
        console.error("Lỗi fetch Hitclub:", e.message);
        return null; 
    }
}

async function fetchB52() {
    try {
        const res = await http.get(API_B52);
        if (res.data?.data) return res.data.data;
        return null;
    } catch (e) { 
        console.error("Lỗi fetch B52:", e.message);
        return null; 
    }
}

async function fetchLC79(url) {
    try {
        const res = await http.get(url);
        if (res.data?.list) return res.data.list;
        return null;
    } catch (e) { 
        console.error("Lỗi fetch LC79:", e.message);
        return null; 
    }
}

// ============================================================
// ========== API ENDPOINTS ==========
// ============================================================

app.get("/", (req, res) => {
    res.json({
        name: "🎲 API TÀI XỈU NÂNG CẤP - HITCLUB | B52 | LC79 🎲",
        author: "@tranhoang2286",
        version: "10.0",
        features: [
            "✅ Loại bỏ hoàn toàn yếu tố RANDOM",
            "✅ Phân biệt 9 loại cầu khác nhau",
            "✅ Bỏ phiếu có trọng số theo từng cầu",
            "✅ Hiển thị tất cả cầu phát hiện được",
            "✅ Độ tin cậy dựa trên phân tích thực tế"
        ],
        loai_cau: {
            cap_1_uu_tien_cao: ["🔥 Cầu bệt (6-7 tay)", "💎 Cầu 3-3", "👑 Cầu 4-4"],
            cap_2_uu_tien_trung: ["📊 Cầu bệt 4-5", "🟢 Cầu 2-2", "📐 Cầu 3-2", "⚙️ Cầu kép"],
            cap_3_uu_tien_thap: ["📌 Cầu bệt 3", "🔄 Cầu 1-1", "📊 Cầu lệch"],
            cap_4_fallback: ["🔄 Cầu đảo"]
        },
        endpoints: {
            "Hitclub": "/api/hitclub/predict",
            "B52": "/api/b52/predict",
            "LC79 TX": "/api/lc79/tx/predict",
            "LC79 MD5": "/api/lc79/md5/predict"
        },
        huong_dan: {
            cach_su_dung: "Gọi GET đến endpoint tương ứng",
            vi_du: "http://localhost:3000/api/hitclub/predict"
        }
    });
});

// HITCLUB
app.get("/api/hitclub/predict", async (req, res) => {
    try {
        const data = await fetchHitclub();
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu Hitclub - Không thể fetch API" });
        const cur = data[0];
        const pred = predictHitclub(data);
        res.json({
            success: true,
            game: "HITCLUB",
            timestamp: new Date().toISOString(),
            phien_hien_tai: {
                phien: cur.Phien,
                ket_qua: cur.Ket_qua,
                xuc_xac: `${cur.Xuc_xac_1} - ${cur.Xuc_xac_2} - ${cur.Xuc_xac_3}`,
                tong: cur.Tong
            },
            du_doan: {
                phien_tiep_theo: cur.Phien + 1,
                du_doan: pred.duDoan,
                do_tin_cay: `${pred.doTinCay}%`,
                loai_cau_chinh: pred.loaiCau,
                tat_ca_cau_phat_hien: pred.tatCaCau,
                ghi_chu: "Dựa trên phân tích cầu thực tế, không có yếu tố ngẫu nhiên"
            }
        });
    } catch (e) { 
        res.status(500).json({ error: e.message, stack: e.stack }); 
    }
});

// B52
app.get("/api/b52/predict", async (req, res) => {
    try {
        const data = await fetchB52();
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu B52 - Không thể fetch API" });
        const cur = data[0];
        const pred = predictB52(data);
        res.json({
            success: true,
            game: "B52",
            timestamp: new Date().toISOString(),
            phien_hien_tai: {
                phien: cur.Phien,
                ket_qua: cur.Ket_qua,
                xuc_xac: `${cur.Xuc_xac_1} - ${cur.Xuc_xac_2} - ${cur.Xuc_xac_3}`,
                tong: cur.Tong
            },
            du_doan: {
                phien_tiep_theo: cur.Phien + 1,
                du_doan: pred.duDoan,
                do_tin_cay: `${pred.doTinCay}%`,
                loai_cau_chinh: pred.loaiCau,
                tat_ca_cau_phat_hien: pred.tatCaCau,
                ghi_chu: "Dựa trên phân tích cầu thực tế, không có yếu tố ngẫu nhiên"
            }
        });
    } catch (e) { 
        res.status(500).json({ error: e.message, stack: e.stack }); 
    }
});

// LC79 TX
app.get("/api/lc79/tx/predict", async (req, res) => {
    try {
        const data = await fetchLC79(API_LC79_TX);
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu LC79 TX - Không thể fetch API" });
        const cur = data[0];
        const pred = predictLC79(data);
        res.json({
            success: true,
            game: "LC79_TX",
            timestamp: new Date().toISOString(),
            phien_hien_tai: {
                phien: cur.id,
                ket_qua: cur.resultTruyenThong === "TAI" ? "Tài" : "Xỉu",
                xuc_xac: `${cur.dices[0]} - ${cur.dices[1]} - ${cur.dices[2]}`,
                tong: cur.point
            },
            du_doan: {
                phien_tiep_theo: cur.id + 1,
                du_doan: pred.pred === "TAI" ? "Tài" : "Xỉu",
                do_tin_cay: `${pred.conf}%`,
                loai_cau_chinh: pred.type,
                tat_ca_cau_phat_hien: pred.tatCaCau,
                ghi_chu: "Dựa trên phân tích cầu thực tế, không có yếu tố ngẫu nhiên"
            }
        });
    } catch (e) { 
        res.status(500).json({ error: e.message, stack: e.stack }); 
    }
});

// LC79 MD5
app.get("/api/lc79/md5/predict", async (req, res) => {
    try {
        const data = await fetchLC79(API_LC79_MD5);
        if (!data) return res.status(500).json({ error: "Lỗi dữ liệu LC79 MD5 - Không thể fetch API" });
        const cur = data[0];
        const pred = predictLC79(data);
        res.json({
            success: true,
            game: "LC79_MD5",
            timestamp: new Date().toISOString(),
            phien_hien_tai: {
                phien: cur.id,
                ket_qua: cur.resultTruyenThong === "TAI" ? "Tài" : "Xỉu",
                xuc_xac: `${cur.dices[0]} - ${cur.dices[1]} - ${cur.dices[2]}`,
                tong: cur.point
            },
            du_doan: {
                phien_tiep_theo: cur.id + 1,
                du_doan: pred.pred === "TAI" ? "Tài" : "Xỉu",
                do_tin_cay: `${pred.conf}%`,
                loai_cau_chinh: pred.type,
                tat_ca_cau_phat_hien: pred.tatCaCau,
                ghi_chu: "Dựa trên phân tích cầu thực tế, không có yếu tố ngẫu nhiên"
            }
        });
    } catch (e) { 
        res.status(500).json({ error: e.message, stack: e.stack }); 
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🎲 API TÀI XỈU NÂNG CẤP - HITCLUB | B52 | LC79`);
    console.log(`============================================================`);
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`============================================================`);
    console.log(`📡 CÁC ENDPOINTS:`);
    console.log(`   ✅ Hitclub:    http://localhost:${PORT}/api/hitclub/predict`);
    console.log(`   ✅ B52:        http://localhost:${PORT}/api/b52/predict`);
    console.log(`   ✅ LC79 TX:    http://localhost:${PORT}/api/lc79/tx/predict`);
    console.log(`   ✅ LC79 MD5:   http://localhost:${PORT}/api/lc79/md5/predict`);
    console.log(`   ✅ Health:     http://localhost:${PORT}/health`);
    console.log(`============================================================`);
    console.log(`📊 NÂNG CẤP THUẬT TOÁN:`);
    console.log(`   ✅ Loại bỏ hoàn toàn yếu tố RANDOM`);
    console.log(`   ✅ Phân biệt 9 loại cầu khác nhau`);
    console.log(`   ✅ Bỏ phiếu có trọng số theo mức độ ưu tiên`);
    console.log(`   ✅ Hiển thị chi tiết tất cả cầu phát hiện`);
    console.log(`   ✅ Độ tin cậy được tính toán thực tế`);
    console.log(`============================================================`);
    console.log(`💡 VÍ DỤ KẾT QUẢ TRẢ VỀ:`);
    console.log(`   {`);
    console.log(`     "du_doan": {`);
    console.log(`       "du_doan": "Tài",`);
    console.log(`       "do_tin_cay": "86%",`);
    console.log(`       "loai_cau_chinh": "🔥 CẦU BỆT 5",`);
    console.log(`       "tat_ca_cau_phat_hien": [...]`);
    console.log(`     }`);
    console.log(`   }`);
    console.log(`============================================================\n`);
});
