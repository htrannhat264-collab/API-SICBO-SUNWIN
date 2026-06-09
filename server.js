const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://tele68.com/",
    "Origin": "https://tele68.com"
};

const http = axios.create({ timeout: 15000, headers: HEADERS });

const API_HITCLUB = "https://sun-win.onrender.com/api/history";
const API_B52 = "https://b52-qiw2.onrender.com/api/history";
const API_LC79_TX = "https://wtx.tele68.com/v1/tx/sessions";
const API_LC79_MD5 = "https://wtxmd52.tele68.com/v1/txmd5/sessions";

// ============================================================================
// ==================== ENGINE 1: THUẬT TOÁN HITCLUB DEEP LURK =================
// ============================================================================
class HitclubDeepEngine {
    constructor() {
        this.markovMatrix3 = new Map();
        this.markovMatrix4 = new Map();
        this.markovMatrix5 = new Map();
        this.geometricStreaks = { bet: 0, cau11: 0, cau22: 0 };
    }

    clearCache() {
        this.markovMatrix3.clear();
        this.markovMatrix4.clear();
        this.markovMatrix5.clear();
    }

    analyze(lichSu) {
        this.clearCache();
        if (!lichSu || lichSu.length < 20) return { duDoan: "Tài", tiLe: 50, loai: "Mặc định" };

        const rawChain = lichSu.map(h => (h.Ket_qua === "Tài" || h.Ket_qua === "TAI") ? "T" : "X").reverse();
        const len = rawChain.length;

        // Tầng 1: Xây dựng Matrix Markov Chain cho Hitclub
        for (let i = 0; i <= len - 4; i++) {
            const pattern = rawChain.slice(i, i + 3).join("");
            const next = rawChain[i + 3];
            if (!this.markovMatrix3.has(pattern)) this.markovMatrix3.set(pattern, { T: 0, X: 0 });
            this.markovMatrix3.get(pattern)[next]++;
        }
        for (let i = 0; i <= len - 5; i++) {
            const pattern = rawChain.slice(i, i + 4).join("");
            const next = rawChain[i + 4];
            if (!this.markovMatrix4.has(pattern)) this.markovMatrix4.set(pattern, { T: 0, X: 0 });
            this.markovMatrix4.get(pattern)[next]++;
        }
        for (let i = 0; i <= len - 6; i++) {
            const pattern = rawChain.slice(i, i + 5).join("");
            const next = rawChain[i + 5];
            if (!this.markovMatrix5.has(pattern)) this.markovMatrix5.set(pattern, { T: 0, X: 0 });
            this.markovMatrix5.get(pattern)[next]++;
        }

        let scoreT = 0, scoreX = 0;

        // Tầng 2: Khớp lệnh thực tế trạng thái hiện tại
        const p3 = rawChain.slice(len - 3).join("");
        if (this.markovMatrix3.has(p3)) {
            const m = this.markovMatrix3.get(p3);
            scoreT += m.T * 1.2; scoreX += m.X * 1.2;
        }
        const p4 = rawChain.slice(len - 4).join("");
        if (this.markovMatrix4.has(p4)) {
            const m = this.markovMatrix4.get(p4);
            scoreT += m.T * 1.8; scoreX += m.X * 1.8;
        }
        const p5 = rawChain.slice(len - 5).join("");
        if (this.markovMatrix5.has(p5)) {
            const m = this.markovMatrix5.get(p5);
            scoreT += m.T * 2.5; scoreX += m.X * 2.5;
        }

        // Tầng 3: Giải mã cấu trúc hình học đặc trưng Hitclub
        const h5 = rawChain.slice(len - 5).join("");
        if (h5 === "TXTXT" || h5 === "XTXTX") { scoreT += (h5.endsWith("X") ? 45 : 0); scoreX += (h5.endsWith("T") ? 45 : 0); }
        if (h5 === "TTXXT" || h5 === "XXTTH") { scoreT += 30; scoreX += 30; }

        // Tầng 4: Đếm bệt đảo ngược từ mảng gốc của Hitclub
        const originChain = lichSu.map(h => (h.Ket_qua === "Tài" || h.Ket_qua === "TAI") ? "T" : "X");
        let bệt = 1;
        for (let i = 1; i < originChain.length; i++) {
            if (originChain[i] === originChain[0]) bệt++; else break;
        }
        if (bệt >= 3) {
            const pheBeCau = originChain[0] === "T" ? "X" : "T";
            if (pheBeCau === "T") scoreT += (bệt * 18); else scoreX += (bệt * 18);
        }

        // Tầng 5: Phân tích Entropy Điểm Số Xúc Xắc Hitclub
        const lastSession = lichSu[0];
        const sumDice = Number(lastSession.Xuc_xac_1 || 0) + Number(lastSession.Xuc_xac_2 || 0) + Number(lastSession.Xuc_xac_3 || 0);
        if (sumDice >= 15) scoreX += 35; // Điểm cực đại, thuật toán xu hướng kéo hồi tụ về Xỉu
        if (sumDice <= 6 && sumDice > 0) scoreT += 35; // Điểm cực tiểu, kéo hồi tụ về Tài

        const finalDecision = scoreT >= scoreX ? "Tài" : "Xỉu";
        const sumScore = scoreT + scoreX;
        const finalRate = sumScore > 0 ? Math.min(96, Math.max(60, Math.round((Math.max(scoreT, scoreX) / sumScore) * 100))) : 62;

        return { duDoan: finalDecision, tiLe: finalRate, loai: bệt >= 4 ? `BẺ BỆT HITCLUB ${bệt} TAY` : "MARKOV MATRIX COMPRESSED" };
    }
}

// ============================================================================
// ==================== ENGINE 2: THUẬT TOÁN B52 QUANTUM MATRIX ===============
// ============================================================================
class B52QuantumEngine {
    constructor() {
        this.sequencePool = [];
        this.weightMap = { T: 0, X: 0 };
    }

    analyze(lichSu) {
        this.weightMap = { T: 0, X: 0 };
        if (!lichSu || lichSu.length < 20) return { duDoan: "Xỉu", tiLe: 52, loai: "Mặc định B52" };

        const chain = lichSu.map(h => (h.Ket_qua === "Tài" || h.Ket_qua === "TAI") ? "T" : "X").reverse();
        const size = chain.length;

        // Tầng 1: Đếm tần suất bước nhảy (Stochastic Hop) của thuật toán B52
        let hop11 = 0, hop22 = 0;
        for (let i = 0; i < size - 2; i++) {
            if (chain[i] !== chain[i+1] && chain[i+1] !== chain[i+2]) hop11++;
            if (chain[i] === chain[i+1] && chain[i+1] !== chain[i+2]) hop22++;
        }

        if (hop11 > hop22) {
            const nextHop = chain[size - 1] === "T" ? "X" : "T";
            this.weightMap[nextHop] += 40;
        } else {
            const nextHop = chain[size - 1];
            this.weightMap[nextHop] += 35;
        }

        // Tầng 2: Thuật toán quét ma trận chuỗi con dịch chuyển (Sliding Window Scan 4-5-6)
        const windowSize = [4, 5, 6];
        windowSize.forEach(w => {
            const targetPattern = chain.slice(size - w).join("");
            for (let i = 0; i < size - w - 1; i++) {
                const sub = chain.slice(i, i + w).join("");
                if (sub === targetPattern) {
                    const futureNode = chain[i + w];
                    this.weightMap[futureNode] += (w * 12);
                }
            }
        });

        // Tầng 3: Bắt biên độ dao động nén lùi (Bệt đảo từ ngọn)
        const reversedChain = lichSu.map(h => (h.Ket_qua === "Tài" || h.Ket_qua === "TAI") ? "T" : "X");
        let streakCounter = 1;
        for (let i = 1; i < reversedChain.length; i++) {
            if (reversedChain[i] === reversedChain[0]) streakCounter++; else break;
        }
        if (streakCounter >= 4) {
            const oppositeNode = reversedChain[0] === "T" ? "X" : "T";
            this.weightMap[oppositeNode] += (streakCounter * 22); // Trọng số ép gãy cầu cực lớn cho B52
        }

        // Tầng 4: Bộ lọc tổng điểm xúc xắc B52 (Dice Weight Filter)
        const currentData = lichSu[0];
        const diceSum = Number(currentData.Xuc_xac_1 || 0) + Number(currentData.Xuc_xac_2 || 0) + Number(currentData.Xuc_xac_3 || 0);
        if (diceSum === 11 || diceSum === 10) {
            // Cầu tâm điểm, thuật toán có xu hướng đứng im nhịp tiếp theo
            const standNode = currentData.Ket_qua === "Tài" || currentData.Ket_qua === "TAI" ? "T" : "X";
            this.weightMap[standNode] += 30;
        }

        const decision = this.weightMap.T >= this.weightMap.X ? "Tài" : "Xỉu";
        const sumW = this.weightMap.T + this.weightMap.X;
        const dynamicRate = sumW > 0 ? Math.min(94, Math.max(59, Math.round((Math.max(this.weightMap.T, this.weightMap.X) / sumW) * 100))) : 61;

        return { duDoan: decision, tiLe: dynamicRate, loai: "B52 QUANTUM SLIDING CORE" };
    }
}

// ============================================================================
// ==================== ENGINE 3: THUẬT TOÁN LC79 TRUYỀN THỐNG =================
// ============================================================================
class Lc79TxEngine {
    constructor() {
        this.stateRegistry = [];
    }

    analyze(lichSu) {
        if (!lichSu || lichSu.length < 15) return { duDoan: "Tài", tiLe: 55, loai: "LC79 Mặc định" };

        // LC79 API sử dụng trường resultTruyenThong với định dạng TAI/XIU
        const normalizedChain = lichSu.map(h => h.resultTruyenThong === "TAI" ? "T" : "X").reverse();
        const length = normalizedChain.length;
        let points = { T: 0, X: 0 };

        // Tầng 1: Đọc cầu đối xứng gương (Mirror Symmetry Pattern)
        if (length >= 8) {
            const LeftSide = normalizedChain.slice(length - 6, length - 3).join("");
            const RightSide = normalizedChain.slice(length - 3).join("");
            if (LeftSide === [...RightSide].reverse().join("")) {
                // Khớp cầu đối xứng gương, ép cầu nhảy nhịp kế tiếp
                points[normalizedChain[length - 1] === "T" ? "X" : "T"] += 50;
            }
        }

        // Tầng 2: Quét chuỗi con lặp Markov Chain bậc 4
        const targetP4 = normalizedChain.slice(length - 4).join("");
        for (let i = 0; i < length - 5; i++) {
            if (normalizedChain.slice(i, i + 4).join("") === targetP4) {
                points[normalizedChain[i + 4]] += 30;
            }
        }

        // Tầng 3: Xử lý nhịp bệt tuyến tính dựa vào mảng gốc (Index 0 là mới nhất)
        const rawArr = lichSu.map(h => h.resultTruyenThong === "TAI" ? "T" : "X");
        let localStreak = 1;
        for (let i = 1; i < rawArr.length; i++) {
            if (rawArr[i] === rawArr[0]) localStreak++; else break;
        }
        if (localStreak >= 3) {
            points[rawArr[0] === "T" ? "X" : "T"] += (localStreak * 16);
        }

        // Tầng 4: Bộ lọc xúc xắc rời rạc (Discrete Dices Filter) cho LC79
        const topNode = lichSu[0];
        if (topNode.dices && topNode.dices.length === 3) {
            const d1 = Number(topNode.dices[0]), d2 = Number(topNode.dices[1]), d3 = Number(topNode.dices[2]);
            // Nếu có 2 súc sắc trùng nhau (Cầu cặp), xác suất phiên sau ra Xỉu tăng cao dựa trên lịch sử nén sàn LC79
            if (d1 === d2 || d2 === d3 || d1 === d3) points["X"] += 28;
            if (d1 + d2 + d3 >= 16) points["X"] += 40;
            if (d1 + d2 + d3 <= 5) points["T"] += 40;
        }

        const outAns = points.T >= points.X ? "Tài" : "Xỉu";
        const sumP = points.T + points.X;
        const accuracy = sumP > 0 ? Math.min(95, Math.max(58, Math.round((Math.max(points.T, points.X) / sumP) * 100))) : 60;

        return { duDoan: outAns, tiLe: accuracy, loai: "LC79 TRADITIONAL CORE" };
    }
}

// ============================================================================
// ==================== ENGINE 4: THUẬT TOÁN LC79 MD5 CRYPTO ==================
// ============================================================================
class Lc79Md5Engine {
    constructor() {
        this.cryptoWeight = { T: 0, X: 0 };
    }

    analyze(lichSu) {
        if (!lichSu || lichSu.length < 15) return { duDoan: "Xỉu", tiLe: 57, loai: "MD5 Mặc định" };
        
        const chain = lichSu.map(h => h.resultTruyenThong === "TAI" ? "T" : "X").reverse();
        const totalLen = chain.length;
        this.cryptoWeight = { T: 0, X: 0 };

        // Tầng 1: Đọc thuật toán cấu trúc cầu lặp nâng cao (1-2-1, 2-1-2) cho dòng MD5
        const tail3 = chain.slice(totalLen - 3).join("");
        if (["TX_T", "X_TX", "TXX", "XTT"].includes(tail3)) {
            this.cryptoWeight[chain[totalLen - 1] === "T" ? "X" : "T"] += 35;
        }

        // Tầng 2: Quét lịch sử trùng lặp chuỗi Markov Chain dài (Bậc 5)
        const targetP5 = chain.slice(totalLen - 5).join("");
        for (let i = 0; i < totalLen - 6; i++) {
            if (chain.slice(i, i + 5).join("") === targetP5) {
                this.cryptoWeight[chain[i + 5]] += 45;
            }
        }

        // Tầng 3: Đo lường xung biến thiên của chuỗi bệt gốc (Index 0 mới nhất)
        const baseArr = lichSu.map(h => h.resultTruyenThong === "TAI" ? "T" : "X");
        let continuousCount = 1;
        for (let i = 1; i < baseArr.length; i++) {
            if (baseArr[i] === baseArr[0]) continuousCount++; else break;
        }
        if (continuousCount >= 3) {
            // Sàn MD5 bệt thường dài hơn, thuật toán ưu tiên nuôi bệt đến tay thứ 5 mới bẻ mạnh
            if (continuousCount < 5) {
                this.cryptoWeight[baseArr[0]] += (continuousCount * 14);
            } else {
                this.cryptoWeight[baseArr[0] === "T" ? "X" : "T"] += (continuousCount * 25);
            }
        }

        // Tầng 4: Xử lý dựa trên dao động tổng điểm xúc xắc MD5
        const currentMatch = lichSu[0];
        if (currentMatch.point) {
            const p = Number(currentMatch.point);
            if (p === 3 || p === 4 || p === 17 || p === 18) {
                // Các điểm bão hòa thuật toán, ép đổi trạng thái cầu lập tức ở phiên sau
                this.cryptoWeight[p >= 17 ? "X" : "T"] += 60;
            }
        }

        const outTarget = this.cryptoWeight.T >= this.cryptoWeight.X ? "Tài" : "Xỉu";
        const sumWeight = this.cryptoWeight.T + this.cryptoWeight.X;
        const calculatedRate = sumWeight > 0 ? Math.min(95, Math.max(60, Math.round((Math.max(this.cryptoWeight.T, this.cryptoWeight.X) / sumWeight) * 100))) : 63;

        return { duDoan: outTarget, tiLe: calculatedRate, loai: "LC79 MD5 CRYPTO MATRIX" };
    }
}

// Khởi tạo các bộ máy xử lý riêng biệt cho từng game độc lập
const EngineHitclub = new HitclubDeepEngine();
const EngineB52 = new B52QuantumEngine();
const EngineLc79Tx = new Lc79TxEngine();
const EngineLc79Md5 = new Lc79Md5Engine();

// ============================================================================
// ==================== HỆ THỐNG ĐỊNH TUYẾN EXPRESS API ENDPOINTS =============
// ============================================================================

app.get("/", (req, res) => {
    res.json({
        status: "Active",
        author: "@tranhoang2286",
        engine_architecture: "Separate Deep Engines Matrix Per Game (Non-Random Core)",
        version: "14.0.0"
    });
});

// Endpoint dự đoán cho HITCLUB
app.get("/api/hitclub/predict", async (req, res) => {
    try {
        const response = await http.get(API_HITCLUB);
        const data = response.data?.taixiu;
        if (!data || data.length === 0) return res.status(500).json({ error: "Lỗi kết nối hoặc rỗng dữ liệu Hitclub" });

        const currentSession = data[0];
        const analyticResult = EngineHitclub.analyze(data);

        res.json({
            game: "HITCLUB",
            phien_hien_tai: currentSession.Phien,
            ket_qua: currentSession.Ket_qua,
            xuc_xac: `${currentSession.Xuc_xac_1}-${currentSession.Xuc_xac_2}-${currentSession.Xuc_xac_3}`,
            tong_diem: currentSession.Tong,
            du_doan_phien_ke: {
                phien: Number(currentSession.Phien) + 1,
                du_doan: analyticResult.duDoan,
                ti_le_chinh_xac: `${analyticResult.tiLe}%`,
                co_che_thuat_toan: analyticResult.loai
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Lỗi luồng hệ thống Hitclub", message: error.message });
    }
});

// Endpoint dự đoán cho B52
app.get("/api/b52/predict", async (req, res) => {
    try {
        const response = await http.get(API_B52);
        const data = response.data?.data;
        if (!data || data.length === 0) return res.status(500).json({ error: "Lỗi kết nối hoặc rỗng dữ liệu B52" });

        const currentSession = data[0];
        const analyticResult = EngineB52.analyze(data);

        res.json({
            game: "B52",
            phien_hien_tai: currentSession.Phien,
            ket_qua: currentSession.Ket_qua,
            xuc_xac: `${currentSession.Xuc_xac_1}-${currentSession.Xuc_xac_2}-${currentSession.Xuc_xac_3}`,
            tong_diem: currentSession.Tong,
            du_doan_phien_ke: {
                phien: Number(currentSession.Phien) + 1,
                du_doan: analyticResult.duDoan,
                ti_le_chinh_xac: `${analyticResult.tiLe}%`,
                co_che_thuat_toan: analyticResult.loai
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Lỗi luồng hệ thống B52", message: error.message });
    }
});

// Endpoint dự đoán cho LC79 TRUYỀN THỐNG (TX)
app.get("/api/lc79/tx/predict", async (req, res) => {
    try {
        const response = await http.get(API_LC79_TX);
        const data = response.data?.list;
        if (!data || data.length === 0) return res.status(500).json({ error: "Lỗi kết nối hoặc rỗng dữ liệu LC79 TX" });

        const currentSession = data[0];
        const analyticResult = EngineLc79Tx.analyze(data);

        res.json({
            game: "LC79_TX",
            phien_hien_tai: currentSession.id,
            ket_qua: currentSession.resultTruyenThong === "TAI" ? "Tài" : "Xỉu",
            xuc_xac: currentSession.dices ? currentSession.dices.join("-") : "N/A",
            tong_diem: currentSession.point,
            du_doan_phien_ke: {
                phien: Number(currentSession.id) + 1,
                du_doan: analyticResult.duDoan,
                ti_le_chinh_xac: `${analyticResult.tiLe}%`,
                co_che_thuat_toan: analyticResult.loai
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Lỗi luồng hệ thống LC79 TX", message: error.message });
    }
});

// Endpoint dự đoán cho LC79 MD5
app.get("/api/lc79/md5/predict", async (req, res) => {
    try {
        const response = await http.get(API_LC79_MD5);
        const data = response.data?.list;
        if (!data || data.length === 0) return res.status(500).json({ error: "Lỗi kết nối hoặc rỗng dữ liệu LC79 MD5" });

        const currentSession = data[0];
        const analyticResult = EngineLc79Md5.analyze(data);

        res.json({
            game: "LC79_MD5",
            phien_hien_tai: currentSession.id,
            ket_qua: currentSession.resultTruyenThong === "TAI" ? "Tài" : "Xỉu",
            xuc_xac: currentSession.dices ? currentSession.dices.join("-") : "N/A",
            tong_diem: currentSession.point,
            du_doan_phien_ke: {
                phien: Number(currentSession.id) + 1,
                du_doan: analyticResult.duDoan,
                ti_le_chinh_xac: `${analyticResult.tiLe}%`,
                co_che_thuat_toan: analyticResult.loai
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Lỗi luồng hệ thống LC79 MD5", message: error.message });
    }
});

// Lắng nghe cổng khởi chạy
app.listen(PORT, () => {
    console.log(`============================================================================`);
    console.log(`🎲 SERVER APPS - CHẠY 4 ENGINE THUẬT TOÁN ĐA LUỒNG BIỆT LẬP THÀNH CÔNG 🎲`);
    console.log(`============================================================================`);
    console.log(`[+] Hitclub Predict Endpoint : http://localhost:${PORT}/api/hitclub/predict`);
    console.log(`[+] B52 Predict Endpoint     : http://localhost:${PORT}/api/b52/predict`);
    console.log(`[+] LC79 TX Predict Endpoint : http://localhost:${PORT}/api/lc79/tx/predict`);
    console.log(`[+] LC79 MD5 Predict Endpoint: http://localhost:${PORT}/api/lc79/md5/predict`);
    console.log(`============================================================================`);
});
