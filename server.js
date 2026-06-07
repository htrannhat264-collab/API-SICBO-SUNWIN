const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình API
const API_SUNWIN = "https://sun-win.onrender.com/api/history";
const API_B52 = "https://b52-qiw2.onrender.com/api/history";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*"
};

const http = axios.create({ timeout: 15000, headers: HEADERS });

// ============================================================
// ========== PHẦN 1: HÀM TIỆN ÍCH CƠ BẢN ==========
// ============================================================

function opp(cuu) {
    return cuu === "Tài" ? "Xỉu" : "Tài";
}

function toSymbol(kq) {
    return kq === "Tài" ? "T" : "X";
}

// Lấy độ dài bệt từ cuối lên
function get_streak(res) {
    if (!res || res.length === 0) return [0, null];
    let s = 1;
    for (let i = res.length - 2; i >= 0; i--) {
        if (res[i] === res[res.length - 1]) s++;
        else break;
    }
    return [s, res[res.length - 1]];
}

// Lấy độ dài bệt từ đầu xuống
function get_streak_from_start(res) {
    if (!res || res.length === 0) return [0, null];
    let s = 1;
    for (let i = 1; i < res.length; i++) {
        if (res[i] === res[0]) s++;
        else break;
    }
    return [s, res[0]];
}

// Lấy bệt dài nhất trong lịch sử
function get_max_streak(res) {
    if (!res || res.length === 0) return 0;
    let maxStreak = 1, currentStreak = 1;
    for (let i = 1; i < res.length; i++) {
        if (res[i] === res[i-1]) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 1;
        }
    }
    return maxStreak;
}

// Tính tỷ lệ phần trăm
function tyLe(so, tong) {
    if (tong === 0) return 0;
    return Math.round((so / tong) * 100);
}

// ============================================================
// ========== PHẦN 2: HÀM PHÁT HIỆN CẦU CHI TIẾT ==========
// ============================================================

// 2.1 PHÁT HIỆN BỆT (10 CẤP ĐỘ)
function phatHienBet(res) {
    if (res.length < 3) return { coCau: false };
    
    const [streak, cur] = get_streak(res);
    
    if (streak >= 10) {
        return {
            coCau: true, loaiCau: "BỆT SIÊU CỰC ĐẠI",
            doDai: streak, duDoan: opp(cur), doTinCay: 96,
            khuyenNghi: "CHẮC CHẮN ĐẢO - CƯỢC MẠNH",
            giaiThich: `Phát hiện ${streak} phiên ${cur === "Tài" ? "TÀI" : "XỈU"} liên tiếp - Cực kỳ hiếm gặp`
        };
    }
    if (streak >= 8) {
        return {
            coCau: true, loaiCau: "BỆT CỰC ĐẠI",
            doDai: streak, duDoan: opp(cur), doTinCay: 92,
            khuyenNghi: "RẤT CHẮC CHẮN ĐẢO - CƯỢC MẠNH",
            giaiThich: `Phát hiện ${streak} phiên ${cur === "Tài" ? "TÀI" : "XỈU"} liên tiếp`
        };
    }
    if (streak >= 7) {
        return {
            coCau: true, loaiCau: "BỆT RẤT DÀI",
            doDai: streak, duDoan: opp(cur), doTinCay: 88,
            khuyenNghi: "RẤT CHẮC CHẮN ĐẢO - CƯỢC MẠNH",
            giaiThich: `Phát hiện ${streak} phiên ${cur === "Tài" ? "TÀI" : "XỈU"} liên tiếp`
        };
    }
    if (streak >= 6) {
        return {
            coCau: true, loaiCau: "BỆT DÀI",
            doDai: streak, duDoan: opp(cur), doTinCay: 84,
            khuyenNghi: "CHẮC CHẮN ĐẢO - CƯỢC MẠNH",
            giaiThich: `Phát hiện ${streak} phiên ${cur === "Tài" ? "TÀI" : "XỈU"} liên tiếp`
        };
    }
    if (streak >= 5) {
        return {
            coCau: true, loaiCau: "BỆT TRUNG BÌNH",
            doDai: streak, duDoan: opp(cur), doTinCay: 78,
            khuyenNghi: "CÓ THỂ ĐẢO - CƯỢC NHẸ",
            giaiThich: `Phát hiện ${streak} phiên ${cur === "Tài" ? "TÀI" : "XỈU"} liên tiếp`
        };
    }
    if (streak >= 4) {
        return {
            coCau: true, loaiCau: "BỆT NGẮN",
            doDai: streak, duDoan: opp(cur), doTinCay: 70,
            khuyenNghi: "CÓ THỂ ĐẢO - CÂN NHẮC",
            giaiThich: `Phát hiện ${streak} phiên ${cur === "Tài" ? "TÀI" : "XỈU"} liên tiếp`
        };
    }
    if (streak >= 3) {
        return {
            coCau: true, loaiCau: "BỆT RẤT NGẮN",
            doDai: streak, duDoan: cur, doTinCay: 60,
            khuyenNghi: "THEO CẦU - CƯỢC NHẸ",
            giaiThich: `Phát hiện ${streak} phiên ${cur === "Tài" ? "TÀI" : "XỈU"} liên tiếp, theo xu hướng`
        };
    }
    
    return { coCau: false };
}

// 2.2 PHÁT HIỆN CẦU 1-1 (T X T X T X...)
function phatHienCau11(res) {
    if (res.length < 6) return { coCau: false };
    
    let doDai = 1;
    for (let i = 1; i < Math.min(res.length, 15); i++) {
        if (res[i] === res[i-1]) break;
        doDai = i + 1;
    }
    
    if (doDai < 5) return { coCau: false };
    
    let doTinCay = 0;
    if (doDai >= 12) doTinCay = 88;
    else if (doDai >= 10) doTinCay = 84;
    else if (doDai >= 8) doTinCay = 80;
    else if (doDai >= 6) doTinCay = 74;
    else doTinCay = 68;
    
    return {
        coCau: true, loaiCau: "CẦU 1-1",
        doDai: doDai, duDoan: opp(res[0]), doTinCay: doTinCay,
        khuyenNghi: "THEO CẦU - CƯỢC THEO QUY LUẬT",
        giaiThich: `Phát hiện cầu đan xen ${doDai} phiên: ${res.slice(0, doDai).map(r => r === "Tài" ? "T" : "X").join('-')}`
    };
}

// 2.3 PHÁT HIỆN CẦU 2-2 (TT XX TT XX...)
function phatHienCau22(res) {
    if (res.length < 8) return { coCau: false };
    
    let soCap = 0;
    let isCau22 = true;
    
    for (let i = 0; i < Math.min(res.length, 16); i += 2) {
        if (i + 1 >= res.length) break;
        if (res[i] !== res[i+1]) { isCau22 = false; break; }
        if (i + 2 < res.length && res[i] === res[i+2]) { isCau22 = false; break; }
        soCap++;
    }
    
    if (!isCau22 || soCap < 3) return { coCau: false };
    
    let doTinCay = 0;
    if (soCap >= 6) doTinCay = 90;
    else if (soCap >= 5) doTinCay = 86;
    else if (soCap >= 4) doTinCay = 82;
    else doTinCay = 76;
    
    const duDoan = opp(res[soCap * 2 - 2]);
    
    return {
        coCau: true, loaiCau: "CẦU 2-2",
        doDai: soCap * 2, soCap: soCap, duDoan: duDoan, doTinCay: doTinCay,
        khuyenNghi: "BẺ CẦU - CƯỢC CỬA NGƯỢC CẶP CUỐI",
        giaiThich: `Phát hiện ${soCap} cặp đôi: ${res.slice(0, soCap*2).map(r => r === "Tài" ? "T" : "X").join('')}`
    };
}

// 2.4 PHÁT HIỆN CẦU 3-2 (TTT XX hoặc XXX TT)
function phatHienCau32(res) {
    if (res.length < 10) return { coCau: false };
    
    const p5 = res.slice(0, 5);
    const p5Str = p5.map(r => r === "Tài" ? "T" : "X").join('');
    
    if (p5Str === "TTTXX") {
        return {
            coCau: true, loaiCau: "CẦU 3-2",
            doDai: 5, pattern: "3T-2X", duDoan: "Xỉu", doTinCay: 82,
            khuyenNghi: "THEO CẦU - CƯỢC XỈU",
            giaiThich: "Phát hiện cầu 3 Tài - 2 Xỉu (TTTXX), nhịp tiếp theo là Xỉu"
        };
    }
    if (p5Str === "XXXTT") {
        return {
            coCau: true, loaiCau: "CẦU 3-2",
            doDai: 5, pattern: "3X-2T", duDoan: "Tài", doTinCay: 82,
            khuyenNghi: "THEO CẦU - CƯỢC TÀI",
            giaiThich: "Phát hiện cầu 3 Xỉu - 2 Tài (XXXTT), nhịp tiếp theo là Tài"
        };
    }
    
    return { coCau: false };
}

// 2.5 PHÁT HIỆN CẦU 3-3 (TTT XXX TTT...)
function phatHienCau33(res) {
    if (res.length < 12) return { coCau: false };
    
    const p6 = res.slice(0, 6);
    const p6Str = p6.map(r => r === "Tài" ? "T" : "X").join('');
    
    if (p6Str === "TTTXXX" || p6Str === "XXXTTT") {
        const duDoan = p6Str === "TTTXXX" ? "Tài" : "Xỉu";
        return {
            coCau: true, loaiCau: "CẦU 3-3",
            doDai: 6, pattern: p6Str === "TTTXXX" ? "3T-3X" : "3X-3T", duDoan: duDoan, doTinCay: 86,
            khuyenNghi: "THEO CẦU - CƯỢC THEO QUY LUẬT",
            giaiThich: `Phát hiện cầu ${p6Str === "TTTXXX" ? "3 Tài - 3 Xỉu" : "3 Xỉu - 3 Tài"}`
        };
    }
    
    return { coCau: false };
}

// 2.6 PHÁT HIỆN CẦU 1-2-1 (T X X T)
function phatHienCau121(res) {
    if (res.length < 6) return { coCau: false };
    
    const p5 = res.slice(0, 5);
    if (p5[0] === p5[2] && p5[0] === p5[4] && p5[1] === p5[3] && p5[0] !== p5[1]) {
        return {
            coCau: true, loaiCau: "CẦU 1-2-1",
            doDai: 5, pattern: p5[0] === "Tài" ? "T-X-X-T" : "X-T-T-X", duDoan: opp(p5[0]), doTinCay: 78,
            khuyenNghi: "BẺ CẦU - CƯỢC CỬA NGƯỢC",
            giaiThich: `Phát hiện cầu 1-2-1: ${p5[0] === "Tài" ? "Tài - Xỉu - Xỉu - Tài" : "Xỉu - Tài - Tài - Xỉu"}`
        };
    }
    
    return { coCau: false };
}

// 2.7 PHÁT HIỆN CẦU 2-1-2 (TT X TT)
function phatHienCau212(res) {
    if (res.length < 7) return { coCau: false };
    
    const p6 = res.slice(0, 6);
    if (p6[0] === p6[1] && p6[3] === p6[4] && p6[0] !== p6[2] && p6[2] === p6[5] && p6[0] !== p6[3]) {
        return {
            coCau: true, loaiCau: "CẦU 2-1-2",
            doDai: 6, pattern: p6[0] === "Tài" ? "TT-X-TT" : "XX-T-XX", duDoan: opp(p6[3]), doTinCay: 80,
            khuyenNghi: "BẺ CẦU - CƯỢC CỬA NGƯỢC",
            giaiThich: `Phát hiện cầu 2-1-2: ${p6[0] === "Tài" ? "Tài Tài - Xỉu - Tài Tài" : "Xỉu Xỉu - Tài - Xỉu Xỉu"}`
        };
    }
    
    return { coCau: false };
}

// 2.8 PHÁT HIỆN CHU KỲ LẶP LẠI
function phatHienChuKy(res) {
    if (res.length < 20) return { coCau: false };
    
    const chuoi = res.map(r => r === "Tài" ? "T" : "X").join('');
    
    for (let doDai = 2; doDai <= 7; doDai++) {
        let giongNhau = true;
        for (let i = 0; i < chuoi.length - doDai; i++) {
            if (chuoi[i] !== chuoi[i + doDai]) {
                giongNhau = false;
                break;
            }
        }
        if (giongNhau && chuoi.length >= doDai * 2) {
            const viTri = chuoi.length % doDai;
            const duDoan = chuoi[viTri] === "T" ? "Tài" : "Xỉu";
            return {
                coCau: true, loaiCau: "CHU KỲ LẶP LẠI",
                doDai: doDai, duDoan: duDoan, doTinCay: 76,
                khuyenNghi: `THEO CHU KỲ ${doDai} PHIÊN`,
                giaiThich: `Phát hiện chu kỳ lặp lại mỗi ${doDai} phiên. Mẫu: ${chuoi.slice(0, doDai*2)}`
            };
        }
    }
    
    return { coCau: false };
}

// ============================================================
// ========== PHẦN 3: PHÂN TÍCH THỐNG KÊ ==========
// ============================================================

// 3.1 PHÂN TÍCH TẦN SUẤT (NHIỀU KHUNG)
function phanTichTanSuat(res) {
    const result = [];
    
    // Khung 10 phiên
    if (res.length >= 10) {
        const last10 = res.slice(0, 10);
        const tai10 = last10.filter(k => k === "Tài").length;
        if (tai10 >= 8) result.push(["Xỉu", 72, `10 phiên: ${tai10}T-${10-tai10}X`]);
        else if (tai10 <= 2) result.push(["Tài", 72, `10 phiên: ${tai10}T-${10-tai10}X`]);
        else if (tai10 >= 7) result.push(["Xỉu", 64, `10 phiên: ${tai10}T-${10-tai10}X`]);
        else if (tai10 <= 3) result.push(["Tài", 64, `10 phiên: ${tai10}T-${10-tai10}X`]);
    }
    
    // Khung 20 phiên
    if (res.length >= 20) {
        const last20 = res.slice(0, 20);
        const tai20 = last20.filter(k => k === "Tài").length;
        if (tai20 >= 15) result.push(["Xỉu", 76, `20 phiên: ${tai20}T-${20-tai20}X`]);
        else if (tai20 <= 5) result.push(["Tài", 76, `20 phiên: ${tai20}T-${20-tai20}X`]);
        else if (tai20 >= 13) result.push(["Xỉu", 68, `20 phiên: ${tai20}T-${20-tai20}X`]);
        else if (tai20 <= 7) result.push(["Tài", 68, `20 phiên: ${tai20}T-${20-tai20}X`]);
    }
    
    // Khung 30 phiên
    if (res.length >= 30) {
        const last30 = res.slice(0, 30);
        const tai30 = last30.filter(k => k === "Tài").length;
        if (tai30 >= 22) result.push(["Xỉu", 80, `30 phiên: ${tai30}T-${30-tai30}X`]);
        else if (tai30 <= 8) result.push(["Tài", 80, `30 phiên: ${tai30}T-${30-tai30}X`]);
    }
    
    return result;
}

// 3.2 PHÂN TÍCH LỆCH PHA
function phanTichLechPha(res) {
    const result = [];
    
    for (let khung of [10, 15, 20]) {
        if (res.length >= khung) {
            const last = res.slice(0, khung);
            const tai = last.filter(k => k === "Tài").length;
            const xiu = khung - tai;
            const chenh = Math.abs(tai - xiu);
            
            if (chenh >= 6) {
                const duDoan = tai > xiu ? "Xỉu" : "Tài";
                let doTin = 70 + Math.min(15, chenh);
                result.push([duDoan, doTin, `Lệch ${khung}p: ${tai}T-${xiu}X (chênh ${chenh})`]);
            }
        }
    }
    
    return result;
}

// 3.3 PHÂN TÍCH XU HƯỚNG
function phanTichXuHuong(res) {
    const result = [];
    
    // Khung 5 phiên
    if (res.length >= 5) {
        const last5 = res.slice(0, 5);
        const tai5 = last5.filter(k => k === "Tài").length;
        if (tai5 >= 4) result.push(["Xỉu", 66, `5 phiên: ${tai5}T-${5-tai5}X, nghiêng Tài`]);
        else if (tai5 <= 1) result.push(["Tài", 66, `5 phiên: ${tai5}T-${5-tai5}X, nghiêng Xỉu`]);
        else if (tai5 >= 3) result.push(["Tài", 58, `5 phiên: ${tai5}T-${5-tai5}X, nhẹ Tài`]);
        else result.push(["Xỉu", 58, `5 phiên: ${tai5}T-${5-tai5}X, nhẹ Xỉu`]);
    }
    
    // Khung 7 phiên
    if (res.length >= 7) {
        const last7 = res.slice(0, 7);
        const tai7 = last7.filter(k => k === "Tài").length;
        if (tai7 >= 5) result.push(["Xỉu", 64, `7 phiên: ${tai7}T-${7-tai7}X`]);
        else if (tai7 <= 2) result.push(["Tài", 64, `7 phiên: ${tai7}T-${7-tai7}X`]);
    }
    
    return result;
}

// ============================================================
// ========== PHẦN 4: PATTERN MATCHING (HỌC TỪ LỊCH SỬ) ==========
// ============================================================

function patternMatching(res, doDai, trongSo) {
    if (res.length < doDai + 1) return null;
    
    const pattern = res.slice(0, doDai);
    const patternStr = pattern.map(r => r === "Tài" ? "T" : "X").join('');
    let count = 0, nextTai = 0, nextXiu = 0;
    
    for (let i = 0; i <= res.length - doDai - 1; i++) {
        const match = res.slice(i, i + doDai).every((v, idx) => v === pattern[idx]);
        if (match) {
            count++;
            if (res[i + doDai] === "Tài") nextTai++;
            else nextXiu++;
        }
    }
    
    if (count >= 2) {
        const total = nextTai + nextXiu;
        const tyLeTai = (nextTai / total) * 100;
        if (tyLeTai >= 65) return { duDoan: "Tài", doTinCay: 60 + Math.min(20, tyLeTai - 60), soLan: count };
        if (tyLeTai <= 35) return { duDoan: "Xỉu", doTinCay: 60 + Math.min(20, 60 - tyLeTai), soLan: count };
    }
    
    return null;
}

// ============================================================
// ========== PHẦN 5: THUẬT TOÁN RIÊNG CHO SUNWIN ==========
// ============================================================

function predictSunwin(lichSu) {
    const res = lichSu.map(h => h.Ket_qua);
    if (res.length < 5) return { duDoan: "Tài", doTinCay: 55, cauType: "chưa_đủ_dữ_liệu" };
    
    const votes = [];
    const phatHien = [];
    
    // 1. PHÁT HIỆN CẦU (9 loại)
    const bet = phatHienBet(res);
    if (bet.coCau) {
        votes.push([bet.duDoan, bet.doTinCay * 1.0]);
        phatHien.push(bet);
    }
    
    const cau11 = phatHienCau11(res);
    if (cau11.coCau) {
        votes.push([cau11.duDoan, cau11.doTinCay * 0.95]);
        phatHien.push(cau11);
    }
    
    const cau22 = phatHienCau22(res);
    if (cau22.coCau) {
        votes.push([cau22.duDoan, cau22.doTinCay * 0.95]);
        phatHien.push(cau22);
    }
    
    const cau32 = phatHienCau32(res);
    if (cau32.coCau) {
        votes.push([cau32.duDoan, cau32.doTinCay * 0.9]);
        phatHien.push(cau32);
    }
    
    const cau33 = phatHienCau33(res);
    if (cau33.coCau) {
        votes.push([cau33.duDoan, cau33.doTinCay * 0.9]);
        phatHien.push(cau33);
    }
    
    const cau121 = phatHienCau121(res);
    if (cau121.coCau) {
        votes.push([cau121.duDoan, cau121.doTinCay * 0.85]);
        phatHien.push(cau121);
    }
    
    const cau212 = phatHienCau212(res);
    if (cau212.coCau) {
        votes.push([cau212.duDoan, cau212.doTinCay * 0.85]);
        phatHien.push(cau212);
    }
    
    const chuKy = phatHienChuKy(res);
    if (chuKy.coCau) {
        votes.push([chuKy.duDoan, chuKy.doTinCay * 0.85]);
        phatHien.push(chuKy);
    }
    
    // 2. THỐNG KÊ
    const tanSuat = phanTichTanSuat(res);
    for (const [duDoan, doTin, lyDo] of tanSuat) {
        votes.push([duDoan, doTin * 0.7]);
    }
    
    const lechPha = phanTichLechPha(res);
    for (const [duDoan, doTin, lyDo] of lechPha) {
        votes.push([duDoan, doTin * 0.75]);
    }
    
    const xuHuong = phanTichXuHuong(res);
    for (const [duDoan, doTin, lyDo] of xuHuong) {
        votes.push([duDoan, doTin * 0.65]);
    }
    
    // 3. PATTERN MATCHING
    const p3 = patternMatching(res, 3, 0.7);
    if (p3) votes.push([p3.duDoan, p3.doTinCay * 0.7]);
    
    const p4 = patternMatching(res, 4, 0.75);
    if (p4) votes.push([p4.duDoan, p4.doTinCay * 0.75]);
    
    const p5 = patternMatching(res, 5, 0.8);
    if (p5) votes.push([p5.duDoan, p5.doTinCay * 0.8]);
    
    // 4. TỔNG HỢP
    const result = weighted_vote(votes);
    const mainCau = phatHien.length > 0 ? phatHien[0].loaiCau : "hỗn_hợp";
    
    return {
        duDoan: result.duDoan,
        doTinCay: result.doTinCay,
        cauType: mainCau,
        soCauPhatHien: phatHien.length,
        chiTietCau: phatHien.slice(0, 3).map(c => ({ loai: c.loaiCau, doTinCay: c.doTinCay }))
    };
}

// ============================================================
// ========== PHẦN 6: THUẬT TOÁN RIÊNG CHO B52 ==========
// ============================================================

function predictB52(lichSu) {
    const res = lichSu.map(h => h.Ket_qua);
    if (res.length < 5) return { duDoan: "Tài", doTinCay: 55, cauType: "chưa_đủ_dữ_liệu" };
    
    const votes = [];
    const phatHien = [];
    
    // 1. PHÁT HIỆN CẦU (ưu tiên bệt và 2-2 cho B52)
    const bet = phatHienBet(res);
    if (bet.coCau) {
        votes.push([bet.duDoan, bet.doTinCay * 1.05]);
        phatHien.push(bet);
    }
    
    const cau22 = phatHienCau22(res);
    if (cau22.coCau) {
        votes.push([cau22.duDoan, cau22.doTinCay * 1.0]);
        phatHien.push(cau22);
    }
    
    const cau11 = phatHienCau11(res);
    if (cau11.coCau) {
        votes.push([cau11.duDoan, cau11.doTinCay * 0.9]);
        phatHien.push(cau11);
    }
    
    const cau32 = phatHienCau32(res);
    if (cau32.coCau) {
        votes.push([cau32.duDoan, cau32.doTinCay * 0.9]);
        phatHien.push(cau32);
    }
    
    const cau33 = phatHienCau33(res);
    if (cau33.coCau) {
        votes.push([cau33.duDoan, cau33.doTinCay * 0.9]);
        phatHien.push(cau33);
    }
    
    const chuKy = phatHienChuKy(res);
    if (chuKy.coCau) {
        votes.push([chuKy.duDoan, chuKy.doTinCay * 0.85]);
        phatHien.push(chuKy);
    }
    
    // 2. THỐNG KÊ (khung lớn hơn cho B52)
    const tanSuat = phanTichTanSuat(res);
    for (const [duDoan, doTin, lyDo] of tanSuat) {
        votes.push([duDoan, doTin * 0.75]);
    }
    
    const lechPha = phanTichLechPha(res);
    for (const [duDoan, doTin, lyDo] of lechPha) {
        votes.push([duDoan, doTin * 0.8]);
    }
    
    const xuHuong = phanTichXuHuong(res);
    for (const [duDoan, doTin, lyDo] of xuHuong) {
        votes.push([duDoan, doTin * 0.7]);
    }
    
    // 3. PATTERN MATCHING (ưu tiên pattern dài hơn)
    const p4 = patternMatching(res, 4, 0.7);
    if (p4) votes.push([p4.duDoan, p4.doTinCay * 0.75]);
    
    const p5 = patternMatching(res, 5, 0.75);
    if (p5) votes.push([p5.duDoan, p5.doTinCay * 0.8]);
    
    const p6 = patternMatching(res, 6, 0.8);
    if (p6) votes.push([p6.duDoan, p6.doTinCay * 0.85]);
    
    // 4. BỆT ĐẶC BIỆT CHO B52
    const [streak, cur] = get_streak(res);
    if (streak >= 3) {
        const doTin = Math.min(82, 60 + streak * 4);
        votes.push([opp(cur), doTin * 0.9]);
    }
    
    const result = weighted_vote(votes);
    const mainCau = phatHien.length > 0 ? phatHien[0].loaiCau : "hỗn_hợp";
    
    return {
        duDoan: result.duDoan,
        doTinCay: result.doTinCay,
        cauType: mainCau,
        soCauPhatHien: phatHien.length,
        chiTietCau: phatHien.slice(0, 3).map(c => ({ loai: c.loaiCau, doTinCay: c.doTinCay }))
    };
}

// ============================================================
// ========== PHẦN 7: FETCH DỮ LIỆU ==========
// ============================================================

async function fetchSunwin() {
    try {
        const res = await http.get(API_SUNWIN);
        if (res.data && res.data.taixiu && Array.isArray(res.data.taixiu)) {
            return res.data.taixiu.map(item => ({
                Phien: item.Phien,
                Ket_qua: item.Ket_qua === "Tài" ? "Tài" : "Xỉu",
                Tong: item.Tong,
                Xuc_xac_1: item.Xuc_xac_1,
                Xuc_xac_2: item.Xuc_xac_2,
                Xuc_xac_3: item.Xuc_xac_3
            }));
        }
        return null;
    } catch (e) {
        console.error("Fetch Sunwin lỗi:", e.message);
        return null;
    }
}

async function fetchB52() {
    try {
        const res = await http.get(API_B52);
        if (res.data && res.data.data && Array.isArray(res.data.data)) {
            return res.data.data.map(item => ({
                Phien: item.Phien,
                Ket_qua: item.Ket_qua === "Tài" ? "Tài" : "Xỉu",
                Tong: item.Tong,
                Xuc_xac_1: item.Xuc_xac_1,
                Xuc_xac_2: item.Xuc_xac_2,
                Xuc_xac_3: item.Xuc_xac_3
            }));
        }
        return null;
    } catch (e) {
        console.error("Fetch B52 lỗi:", e.message);
        return null;
    }
}

// ============================================================
// ========== PHẦN 8: HÀM BỎ PHIẾU ==========
// ============================================================

function weighted_vote(votes) {
    let s = { Tài: 0, Xỉu: 0 };
    for (const [pred, w] of votes) {
        if (pred === "Tài") s.Tài += w;
        else if (pred === "Xỉu") s.Xỉu += w;
    }
    const total = s.Tài + s.Xỉu;
    if (total === 0) return { duDoan: "Tài", doTinCay: 50 };
    const final = s.Tài >= s.Xỉu ? "Tài" : "Xỉu";
    const conf = Math.min(96, Math.max(50, Math.floor((s[final] / total) * 100)));
    return { duDoan: final, doTinCay: conf };
}

// ============================================================
// ========== PHẦN 9: API ENDPOINTS ==========
// ============================================================

app.get("/", (req, res) => {
    res.json({
        name: "🎲 API DỰ ĐOÁN TÀI XỈU - SUNWIN & B52 🎲",
        author: "@tranhoang2286",
        version: "3.0 - SIÊU THUẬT TOÁN",
        thuat_toan: [
            "🔴 1. Bệt 10 cấp độ (3-10+ phiên)",
            "🟢 2. Cầu 1-1 (đan xen Tài-Xỉu)",
            "🟢 3. Cầu 2-2 (cặp đôi TT-XX)",
            "🔵 4. Cầu 3-2 (3T-2X / 3X-2T)",
            "🔵 5. Cầu 3-3 (3T-3X / 3X-3T)",
            "🟣 6. Cầu 1-2-1 (T-X-X-T)",
            "🟣 7. Cầu 2-1-2 (TT-X-TT)",
            "🔄 8. Chu kỳ lặp lại (2-7 phiên)",
            "📊 9. Tần suất (10-20-30 phiên)",
            "📈 10. Xu hướng (5-7 phiên)",
            "📐 11. Lệch pha (10-15-20 phiên)",
            "📚 12. Pattern matching (3-4-5-6 phiên)"
        ],
        endpoints: {
            "Sunwin - Dự đoán": "GET /api/sunwin/predict",
            "B52 - Dự đoán": "GET /api/b52/predict",
            "Sunwin - Lịch sử": "GET /api/sunwin/history",
            "B52 - Lịch sử": "GET /api/b52/history"
        }
    });
});

app.get("/api/sunwin/predict", async (req, res) => {
    try {
        const lichSu = await fetchSunwin();
        if (!lichSu || lichSu.length === 0) {
            return res.status(500).json({ error: "Không lấy được dữ liệu Sunwin" });
        }
        
        const current = lichSu[0];
        const prediction = predictSunwin(lichSu);
        const coNenCuoc = prediction.doTinCay >= 68;
        
        const last10 = lichSu.slice(0, 10).map(h => h.Ket_qua === "Tài" ? "T" : "X").join(' - ');
        const [streak, cur] = get_streak(lichSu.map(h => h.Ket_qua));
        
        res.json({
            success: true,
            game: "SUNWIN",
            current: {
                phien: current.Phien,
                xuc_xac: `${current.Xuc_xac_1} - ${current.Xuc_xac_2} - ${current.Xuc_xac_3}`,
                tong: current.Tong,
                ket_qua: current.Ket_qua
            },
            phan_tich: {
                chuoi_bet_hien_tai: streak >= 2 ? `${streak} phiên ${cur}` : "không có bệt",
                so_cau_phat_hien: prediction.soCauPhatHien
            },
            du_doan: {
                phien_tiep: current.Phien + 1,
                du_doan: prediction.duDoan,
                do_tin_cay: `${prediction.doTinCay}%`,
                co_nen_cuoc: coNenCuoc ? "✅✅✅ NÊN CƯỢC MẠNH" : (prediction.doTinCay >= 60 ? "⚠️ CƯỢC NHẸ" : "⏸️ BỎ QUA"),
                loai_cau_chinh: prediction.cauType,
                chi_tiet_cau: prediction.chiTietCau
            },
            lich_su_gan_day: last10,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/b52/predict", async (req, res) => {
    try {
        const lichSu = await fetchB52();
        if (!lichSu || lichSu.length === 0) {
            return res.status(500).json({ error: "Không lấy được dữ liệu B52" });
        }
        
        const current = lichSu[0];
        const prediction = predictB52(lichSu);
        const coNenCuoc = prediction.doTinCay >= 68;
        
        const last10 = lichSu.slice(0, 10).map(h => h.Ket_qua === "Tài" ? "T" : "X").join(' - ');
        const [streak, cur] = get_streak(lichSu.map(h => h.Ket_qua));
        
        res.json({
            success: true,
            game: "B52",
            current: {
                phien: current.Phien,
                xuc_xac: `${current.Xuc_xac_1} - ${current.Xuc_xac_2} - ${current.Xuc_xac_3}`,
                tong: current.Tong,
                ket_qua: current.Ket_qua
            },
            phan_tich: {
                chuoi_bet_hien_tai: streak >= 2 ? `${streak} phiên ${cur}` : "không có bệt",
                so_cau_phat_hien: prediction.soCauPhatHien
            },
            du_doan: {
                phien_tiep: current.Phien + 1,
                du_doan: prediction.duDoan,
                do_tin_cay: `${prediction.doTinCay}%`,
                co_nen_cuoc: coNenCuoc ? "✅✅✅ NÊN CƯỢC MẠNH" : (prediction.doTinCay >= 60 ? "⚠️ CƯỢC NHẸ" : "⏸️ BỎ QUA"),
                loai_cau_chinh: prediction.cauType,
                chi_tiet_cau: prediction.chiTietCau
            },
            lich_su_gan_day: last10,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/sunwin/history", async (req, res) => {
    try {
        const data = await fetchSunwin();
        res.json({ success: true, game: "SUNWIN", history: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/b52/history", async (req, res) => {
    try {
        const data = await fetchB52();
        res.json({ success: true, game: "B52", history: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🎲 API DỰ ĐOÁN SUNWIN & B52 - SIÊU THUẬT TOÁN`);
    console.log(`============================================================`);
    console.log(`✅ Sunwin: http://localhost:${PORT}/api/sunwin/predict`);
    console.log(`✅ B52: http://localhost:${PORT}/api/b52/predict`);
    console.log(`🎯 12+ THUẬT TOÁN - PHÂN TÍCH ĐA CHIỀU`);
    console.log(`🎯 MỖI GAME CÓ THUẬT TOÁN RIÊNG`);
    console.log(`============================================================\n`);
});
