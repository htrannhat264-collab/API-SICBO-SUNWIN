const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const URL_TX = "https://wtx.tele68.com/v1/tx/sessions";
const URL_MD5 = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://tele68.com/",
    "Origin": "https://tele68.com"
};

const http = axios.create({ timeout: 10000, headers: HEADERS });

// ============================================================
// ========== HỆ THỐNG PHÂN TÍCH CẦU CHI TIẾT ==========
// ============================================================

// 1. PHÁT HIỆN CẦU BỆT (CHUỖI LIÊN TIẾP GIỐNG NHAU)
function phatHienCauBet(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 3) return null;
    
    let doDaiBet = 1;
    let giaTriBet = lichSuKQ[0];
    
    for (let i = 1; i < lichSuKQ.length; i++) {
        if (lichSuKQ[i] === giaTriBet) doDaiBet++;
        else break;
    }
    
    if (doDaiBet < 3) return null;
    
    // Phân tích cấp độ bệt
    let doTinCay = 0;
    let khuyenNghi = "";
    
    if (doDaiBet >= 7) {
        doTinCay = 88;
        khuyenNghi = "BỆT QUÁ DÀI - CHẮC CHẮN ĐẢO";
    } else if (doDaiBet === 6) {
        doTinCay = 84;
        khuyenNghi = "BỆT 6 - RẤT DỄ ĐẢO";
    } else if (doDaiBet === 5) {
        doTinCay = 78;
        khuyenNghi = "BỆT 5 - KHẢ NĂNG ĐẢO CAO";
    } else if (doDaiBet === 4) {
        doTinCay = 70;
        khuyenNghi = "BỆT 4 - CÓ THỂ ĐẢO";
    } else if (doDaiBet === 3) {
        doTinCay = 62;
        khuyenNghi = "BỆT 3 - THEO HOẶC ĐẢO";
    }
    
    const duDoan = giaTriBet === "TAI" ? "XỈU" : "TÀI";
    
    return {
        coCau: true,
        loaiCau: `BỆT ${doDaiBet}`,
        doDai: doDaiBet,
        duDoan: duDoan,
        doTinCay: doTinCay,
        khuyenNghi: khuyenNghi,
        phanTich: `Phát hiện chuỗi ${doDaiBet} phiên ${giaTriBet === "TAI" ? "TÀI" : "XỈU"} liên tiếp`
    };
}

// 2. PHÁT HIỆN CẦU 1-1 (TÀI XỈU ĐAN XEN)
function phatHienCau11(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 6) return null;
    
    let doDaiCau = 1;
    let dangCau11 = true;
    
    for (let i = 1; i < Math.min(lichSuKQ.length, 15); i++) {
        if (lichSuKQ[i] === lichSuKQ[i-1]) {
            dangCau11 = false;
            break;
        }
        doDaiCau++;
    }
    
    if (!dangCau11 || doDaiCau < 5) return null;
    
    let doTinCay = 0;
    let khuyenNghi = "";
    
    if (doDaiCau >= 10) {
        doTinCay = 85;
        khuyenNghi = "CẦU 1-1 RẤT DÀI - THEO CẦU";
    } else if (doDaiCau >= 8) {
        doTinCay = 80;
        khuyenNghi = "CẦU 1-1 DÀI - THEO CẦU";
    } else if (doDaiCau >= 6) {
        doTinCay = 74;
        khuyenNghi = "CẦU 1-1 ĐANG CHẠY - THEO CẦU";
    } else {
        doTinCay = 68;
        khuyenNghi = "CẦU 1-1 MỚI HÌNH THÀNH";
    }
    
    const duDoan = lichSuKQ[0] === "TAI" ? "XỈU" : "TÀI";
    
    return {
        coCau: true,
        loaiCau: `CẦU 1-1 (${doDaiCau} phiên)`,
        doDai: doDaiCau,
        duDoan: duDoan,
        doTinCay: doTinCay,
        khuyenNghi: khuyenNghi,
        phanTich: `Phát hiện cầu đan xen Tài-Xỉu kéo dài ${doDaiCau} phiên`
    };
}

// 3. PHÁT HIỆN CẦU 2-2 (CẶP ĐÔI)
function phatHienCau22(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 8) return null;
    
    let soCap = 0;
    let dangCau22 = true;
    
    for (let i = 0; i < Math.min(lichSuKQ.length, 16); i += 2) {
        if (i + 1 >= lichSuKQ.length) break;
        if (lichSuKQ[i] !== lichSuKQ[i+1]) {
            dangCau22 = false;
            break;
        }
        if (i + 2 < lichSuKQ.length && lichSuKQ[i] === lichSuKQ[i+2]) {
            dangCau22 = false;
            break;
        }
        soCap++;
    }
    
    if (!dangCau22 || soCap < 3) return null;
    
    let doTinCay = 0;
    let khuyenNghi = "";
    
    if (soCap >= 5) {
        doTinCay = 86;
        khuyenNghi = "CẦU 2-2 SIÊU DÀI - BẺ CẦU";
    } else if (soCap >= 4) {
        doTinCay = 82;
        khuyenNghi = "CẦU 2-2 RẤT DÀI - BẺ CẦU";
    } else if (soCap >= 3) {
        doTinCay = 76;
        khuyenNghi = "CẦU 2-2 ĐANG CHẠY - BẺ CẦU";
    }
    
    const viTriCuoi = (soCap - 1) * 2;
    const duDoan = lichSuKQ[viTriCuoi] === "TAI" ? "XỈU" : "TÀI";
    
    return {
        coCau: true,
        loaiCau: `CẦU 2-2 (${soCap} cặp)`,
        doDai: soCap * 2,
        duDoan: duDoan,
        doTinCay: doTinCay,
        khuyenNghi: khuyenNghi,
        phanTich: `Phát hiện cầu ${soCap} cặp đôi (${lichSuKQ[0] === "TAI" ? "TT" : "XX"} ${lichSuKQ[2] === "TAI" ? "TT" : "XX"}...)`
    };
}

// 4. PHÁT HIỆN CẦU 3-2 (3 TÀI - 2 XỈU HOẶC NGƯỢC LẠI)
function phatHienCau32(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 10) return null;
    
    const p5 = lichSuKQ.slice(0, 5);
    const p5Str = p5.map(k => k === "TAI" ? "T" : "X").join('');
    
    if (p5Str === "TTTXX") {
        return {
            coCau: true,
            loaiCau: "CẦU 3-2 (3T-2X)",
            doDai: 5,
            duDoan: "XỈU",
            doTinCay: 78,
            khuyenNghi: "CẦU 3 TÀI 2 XỈU - TIẾP TỤC XỈU",
            phanTich: "Phát hiện cầu 3 Tài - 2 Xỉu, dự đoán Xỉu ở nhịp tiếp theo"
        };
    }
    
    if (p5Str === "XXXTT") {
        return {
            coCau: true,
            loaiCau: "CẦU 3-2 (3X-2T)",
            doDai: 5,
            duDoan: "TÀI",
            doTinCay: 78,
            khuyenNghi: "CẦU 3 XỈU 2 TÀI - TIẾP TỤC TÀI",
            phanTich: "Phát hiện cầu 3 Xỉu - 2 Tài, dự đoán Tài ở nhịp tiếp theo"
        };
    }
    
    return null;
}

// 5. PHÁT HIỆN CẦU 3-3 (3 TÀI - 3 XỈU)
function phatHienCau33(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 12) return null;
    
    const p6 = lichSuKQ.slice(0, 6);
    const p6Str = p6.map(k => k === "TAI" ? "T" : "X").join('');
    
    if (p6Str === "TTTXXX" || p6Str === "XXXTTT") {
        const duDoan = p6Str === "TTTXXX" ? "TÀI" : "XỈU";
        return {
            coCau: true,
            loaiCau: `CẦU 3-3 (${p6Str === "TTTXXX" ? "3T-3X" : "3X-3T"})`,
            doDai: 6,
            duDoan: duDoan,
            doTinCay: 82,
            khuyenNghi: "CẦU 3-3 ĐANG CHẠY - THEO CẦU",
            phanTich: `Phát hiện cầu ${p6Str === "TTTXXX" ? "3 Tài - 3 Xỉu" : "3 Xỉu - 3 Tài"}`
        };
    }
    
    return null;
}

// 6. PHÁT HIỆN CẦU 1-2-1 (TÀI - XỈU XỈU - TÀI)
function phatHienCau121(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 6) return null;
    
    const p5 = lichSuKQ.slice(0, 5);
    if (p5[0] === p5[2] && p5[0] === p5[4] && p5[1] === p5[3] && p5[0] !== p5[1]) {
        const duDoan = p5[0] === "TAI" ? "XỈU" : "TÀI";
        return {
            coCau: true,
            loaiCau: "CẦU 1-2-1",
            doDai: 5,
            duDoan: duDoan,
            doTinCay: 74,
            khuyenNghi: "CẦU 1-2-1 - BẺ CẦU",
            phanTich: `Phát hiện cầu ${p5[0] === "TAI" ? "T-X-X-T" : "X-T-T-X"}`
        };
    }
    
    return null;
}

// 7. PHÁT HIỆN CẦU 2-1-2 (TÀI TÀI - XỈU - TÀI TÀI)
function phatHienCau212(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 7) return null;
    
    const p6 = lichSuKQ.slice(0, 6);
    if (p6[0] === p6[1] && p6[3] === p6[4] && p6[0] !== p6[2] && p6[2] === p6[5] && p6[0] !== p6[3]) {
        const duDoan = p6[3] === "TAI" ? "XỈU" : "TÀI";
        return {
            coCau: true,
            loaiCau: "CẦU 2-1-2",
            doDai: 6,
            duDoan: duDoan,
            doTinCay: 76,
            khuyenNghi: "CẦU 2-1-2 - BẺ CẦU",
            phanTich: `Phát hiện cầu ${p6[0] === "TAI" ? "TT-X-TT" : "XX-T-XX"}`
        };
    }
    
    return null;
}

// 8. PHÁT HIỆN CHU KỲ LẶP LẠI
function phatHienChuKy(lichSuKQ) {
    if (!lichSuKQ || lichSuKQ.length < 20) return null;
    
    const chuoi = lichSuKQ.map(k => k === "TAI" ? "T" : "X").join('');
    
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
            const duDoan = chuoi[viTri] === "T" ? "TÀI" : "XỈU";
            return {
                coCau: true,
                loaiCau: `CHU KỲ ${doDai}`,
                doDai: doDai,
                duDoan: duDoan,
                doTinCay: 70,
                khuyenNghi: `CHU KỲ ${doDai} PHIÊN - THEO CHU KỲ`,
                phanTich: `Phát hiện chu kỳ lặp lại mỗi ${doDai} phiên`
            };
        }
    }
    
    return null;
}

// 9. PHÂN TÍCH LỆCH PHA
function phanTichLechPha(lichSuKQ, khung = 15) {
    if (lichSuKQ.length < khung) return null;
    
    const ganDay = lichSuKQ.slice(0, khung);
    const tai = ganDay.filter(k => k === "TAI").length;
    const xiu = khung - tai;
    const chenhLech = Math.abs(tai - xiu);
    
    if (chenhLech < 4) return null;
    
    let doTinCay = 0;
    let khuyenNghi = "";
    
    if (chenhLech >= 8) {
        doTinCay = 85;
        khuyenNghi = "LỆCH CỰC ĐẠI - BẮT CỬA THIẾU";
    } else if (chenhLech >= 6) {
        doTinCay = 78;
        khuyenNghi = "LỆCH LỚN - BẮT CỬA THIẾU";
    } else {
        doTinCay = 68;
        khuyenNghi = "LỆCH VỪA - CÓ THỂ BẮT CỬA THIẾU";
    }
    
    const duDoan = tai > xiu ? "XỈU" : "TÀI";
    
    return {
        coCau: true,
        loaiCau: `LỆCH PHA ${khung}P (${tai}T-${xiu}X)`,
        doDai: khung,
        duDoan: duDoan,
        doTinCay: doTinCay,
        khuyenNghi: khuyenNghi,
        phanTich: `${khung} phiên gần nhất: ${tai} Tài - ${xiu} Xỉu, chênh lệch ${chenhLech}`
    };
}

// 10. TỔNG HỢP TẤT CẢ CÁC LOẠI CẦU
function tongHopCau(lichSuKQ) {
    const tatCaCau = [];
    
    // Thu thập tất cả các loại cầu
    const cauBet = phatHienCauBet(lichSuKQ);
    if (cauBet) tatCaCau.push(cauBet);
    
    const cau11 = phatHienCau11(lichSuKQ);
    if (cau11) tatCaCau.push(cau11);
    
    const cau22 = phatHienCau22(lichSuKQ);
    if (cau22) tatCaCau.push(cau22);
    
    const cau32 = phatHienCau32(lichSuKQ);
    if (cau32) tatCaCau.push(cau32);
    
    const cau33 = phatHienCau33(lichSuKQ);
    if (cau33) tatCaCau.push(cau33);
    
    const cau121 = phatHienCau121(lichSuKQ);
    if (cau121) tatCaCau.push(cau121);
    
    const cau212 = phatHienCau212(lichSuKQ);
    if (cau212) tatCaCau.push(cau212);
    
    const chuKy = phatHienChuKy(lichSuKQ);
    if (chuKy) tatCaCau.push(chuKy);
    
    const lechPha = phanTichLechPha(lichSuKQ, 15);
    if (lechPha) tatCaCau.push(lechPha);
    
    const lechPha10 = phanTichLechPha(lichSuKQ, 10);
    if (lechPha10) tatCaCau.push(lechPha10);
    
    if (tatCaCau.length === 0) return null;
    
    // Sắp xếp theo độ tin cậy giảm dần
    tatCaCau.sort((a, b) => b.doTinCay - a.doTinCay);
    
    return tatCaCau[0];
}

// 11. PHÂN TÍCH XÚC XẮC (BỔ SUNG)
function phanTichXucXac(lichSu) {
    if (!lichSu || lichSu.length < 10) return null;
    
    const matDem = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const tongDem = [];
    
    for (let i = 0; i < Math.min(lichSu.length, 30); i++) {
        if (lichSu[i]?.dices) {
            for (let d of lichSu[i].dices) matDem[d]++;
            const tong = lichSu[i].dices.reduce((a,b) => a+b, 0);
            tongDem.push(tong);
        }
    }
    
    const tongTB = tongDem.length > 0 ? tongDem.reduce((a,b) => a+b, 0) / tongDem.length : 10.5;
    const ganDay = tongDem.slice(0, 10);
    const ganDayTB = ganDay.length > 0 ? ganDay.reduce((a,b) => a+b, 0) / ganDay.length : 10.5;
    
    return { tongTB, ganDayTB, xuHuong: ganDayTB > tongTB + 1 ? "TANG" : (ganDayTB < tongTB - 1 ? "GIAM" : "ON_DINH") };
}

// ============================================================
// ========== DỰ ĐOÁN CHÍNH ==========
// ============================================================

async function duDoan(game) {
    const url = game === "TX" ? URL_TX : URL_MD5;
    const data = await fetchData(url);
    if (!data || !data.list || data.list.length === 0) {
        return { error: "Không có dữ liệu" };
    }
    
    const lichSu = data.list;
    const current = lichSu[0];
    const lichSuKQ = lichSu.map(h => h.resultTruyenThong);
    
    // 1. Phân tích cầu
    const cau = tongHopCau(lichSuKQ);
    
    // 2. Phân tích xúc xắc
    const xx = phanTichXucXac(lichSu);
    
    // 3. Quyết định dự đoán
    let duDoanResult = null;
    let doTinCay = 0;
    let lyDo = "";
    let phanTichChiTiet = [];
    
    if (cau) {
        duDoanResult = cau.duDoan;
        doTinCay = cau.doTinCay;
        lyDo = cau.khuyenNghi;
        phanTichChiTiet.push(`🎯 ${cau.phanTich}`);
        phanTichChiTiet.push(`📊 Độ tin cậy: ${doTinCay}%`);
    }
    
    // Nếu không có cầu hoặc độ tin cậy thấp, dùng xúc xắc
    if (!duDoanResult || doTinCay < 60) {
        if (xx) {
            if (xx.xuHuong === "TANG" && xx.ganDayTB > 11) {
                duDoanResult = "XỈU";
                doTinCay = 62;
                lyDo = "XÚC XẮC ĐANG TĂNG MẠNH";
                phanTichChiTiet.push(`🎲 Xu hướng xúc xắc: TĂNG (${xx.ganDayTB.toFixed(1)} điểm)`);
            } else if (xx.xuHuong === "GIAM" && xx.ganDayTB < 10) {
                duDoanResult = "TÀI";
                doTinCay = 62;
                lyDo = "XÚC XẮC ĐANG GIẢM MẠNH";
                phanTichChiTiet.push(`🎲 Xu hướng xúc xắc: GIẢM (${xx.ganDayTB.toFixed(1)} điểm)`);
            } else {
                duDoanResult = "TÀI";
                doTinCay = 58;
                lyDo = "CÂN BẰNG - THEO XU HƯỚNG CƠ BẢN";
                phanTichChiTiet.push(`⚖️ Không có cầu rõ ràng, dự đoán mặc định`);
            }
        } else {
            duDoanResult = "TÀI";
            doTinCay = 55;
            lyDo = "THIẾU DỮ LIỆU - DỰ ĐOÁN MẶC ĐỊNH";
        }
    }
    
    // Xúc xắc hiện tại
    let tong = 0, xx_hienTai = [0,0,0];
    if (current.dices && current.dices.length === 3) {
        xx_hienTai = current.dices;
        tong = current.dices.reduce((a,b) => a+b, 0);
    }
    
    const coNenCuoc = doTinCay >= 65;
    
    // Thống kê nhanh 30 phiên
    const lichSu30 = lichSuKQ.slice(0, 30);
    const tai30 = lichSu30.filter(k => k === "TAI").length;
    const xiu30 = 30 - tai30;
    
    return {
        success: true,
        game: game,
        current: {
            phien: current.id,
            xuc_xac: `${xx_hienTai[0]} - ${xx_hienTai[1]} - ${xx_hienTai[2]}`,
            tong: tong,
            ket_qua: current.resultTruyenThong === "TAI" ? "TÀI" : "XỈU"
        },
        du_doan: {
            phien_tiep: current.id + 1,
            du_doan: duDoanResult,
            do_tin_cay: `${doTinCay}%`,
            co_nen_cuoc: coNenCuoc ? "✅ NÊN CƯỢC" : "⏸️ BỎ QUA",
            ly_do: lyDo
        },
        phan_tich_cau: cau ? {
            loai_cau: cau.loaiCau,
            do_dai: cau.doDai,
            do_tin_cay: `${cau.doTinCay}%`,
            mo_ta: cau.phanTich
        } : { loai_cau: "KHÔNG CÓ CẦU RÕ RÀNG" },
        chi_tiet_phan_tich: phanTichChiTiet,
        thong_ke: {
            tong_phien_phan_tich: Math.min(lichSu.length, 50),
            ti_le_tai_30p: `${Math.round(tai30 / 30 * 100)}%`,
            tai_30p: `${tai30}T - ${xiu30}X`
        },
        timestamp: new Date().toISOString()
    };
}

async function fetchData(url) {
    try {
        const res = await http.get(url);
        return res.data;
    } catch (e) {
        return null;
    }
}

// ============================================================
// ========== API ==========
// ============================================================

app.get("/", (req, res) => {
    res.json({
        name: "🎲 LC79 - HỆ THỐNG PHÂN TÍCH CẦU TOÀN DIỆN 🎲",
        author: "@tranhoang2286",
        version: "13.0",
        cac_loai_cau: [
            "📊 Cầu bệt (3-4-5-6-7+) - Đảo cầu khi bệt dài",
            "📊 Cầu 1-1 (đan xen Tài-Xỉu)",
            "📊 Cầu 2-2 (cặp đôi TT-XX)",
            "📊 Cầu 3-2 (3T-2X / 3X-2T)",
            "📊 Cầu 3-3 (3T-3X / 3X-3T)",
            "📊 Cầu 1-2-1 (T-X-X-T / X-T-T-X)",
            "📊 Cầu 2-1-2 (TT-X-TT / XX-T-XX)",
            "📊 Chu kỳ lặp lại",
            "📊 Lệch pha (10-15 phiên)",
            "🎲 Phân tích xúc xắc"
        ],
        quy_tac: "✅ CHỈ CƯỢC KHI 'co_nen_cuoc' = '✅ NÊN CƯỢC' (độ tin cậy >= 65%)",
        endpoints: {
            "TX (Hũ)": "GET /taixiu",
            "MD5": "GET /taixiumd5"
        }
    });
});

app.get("/taixiu", async (req, res) => {
    try {
        const r = await duDoan("TX");
        res.json(r);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/taixiumd5", async (req, res) => {
    try {
        const r = await duDoan("MD5");
        res.json(r);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n================================================================`);
    console.log(`🎲 LC79 - HỆ THỐNG PHÂN TÍCH CẦU TOÀN DIỆN v13.0`);
    console.log(`================================================================`);
    console.log(`✅ TX: http://localhost:${PORT}/taixiu`);
    console.log(`✅ MD5: http://localhost:${PORT}/taixiumd5`);
    console.log(`🎯 10+ LOẠI CẦU ĐƯỢC PHÂN TÍCH`);
    console.log(`🎯 CHỈ CƯỢC KHI "co_nen_cuoc" = "✅ NÊN CƯỢC"`);
    console.log(`================================================================\n`);
});
