const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

// ==================== FILE STORAGE ====================
const HISTORY_FILE = './history.json';
const PATTERNS_FILE = './patterns.json';
const MODEL_WEIGHTS_FILE = './model_weights.json';

// Load history if exists
let resultHistory = [];
if (fs.existsSync(HISTORY_FILE)) {
    try {
        resultHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        console.log(`[📂] Đã tải ${resultHistory.length} phiên từ history.json`);
    } catch (e) {
        console.error('[❌] Lỗi đọc history.json:', e.message);
    }
}

// Load model weights if exists
let modelWeights = {
    'model1': 1.0, 'model2': 1.0, 'model3': 1.0, 'model4': 1.0,
    'model5': 1.0, 'model6': 1.0, 'model7': 1.0, 'model8': 1.0,
    'model9': 1.0, 'model10': 1.0, 'model11': 1.0, 'model12': 1.0,
    'model13': 1.0, 'model14': 1.0, 'model15': 1.0, 'model16': 1.0,
    'model17': 1.0, 'model18': 1.0, 'model19': 1.0, 'model20': 1.0,
    'model21': 1.0
};

// Load sub model weights
let subModelWeights = {};
for (let i = 1; i <= 42; i++) {
    subModelWeights[`sub_model_${i}`] = 1.0;
}

// Load mini model weights
let miniModelWeights = {};
for (let i = 1; i <= 21; i++) {
    miniModelWeights[`mini_model_${i}`] = 1.0;
}

if (fs.existsSync(MODEL_WEIGHTS_FILE)) {
    try {
        const savedWeights = JSON.parse(fs.readFileSync(MODEL_WEIGHTS_FILE, 'utf8'));
        modelWeights = savedWeights.modelWeights || modelWeights;
        subModelWeights = savedWeights.subModelWeights || subModelWeights;
        miniModelWeights = savedWeights.miniModelWeights || miniModelWeights;
        console.log('[📂] Đã tải model_weights.json');
    } catch (e) {
        console.error('[❌] Lỗi đọc model_weights.json:', e.message);
    }
}

// Save history
function saveHistory(entry) {
    resultHistory.push(entry);
    if (resultHistory.length > 1000) resultHistory.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(resultHistory, null, 2));
}

// Save model weights
function saveModelWeights() {
    const weights = {
        modelWeights,
        subModelWeights,
        miniModelWeights
    };
    fs.writeFileSync(MODEL_WEIGHTS_FILE, JSON.stringify(weights, null, 2));
}

// ==================== GLOBAL VARIABLES ====================
let currentSessionId = null;
let lastResult = null;
let lastPrediction = null;
let stats = {
    total: 0,
    correct: 0,
    wrong: 0,
    consecutiveLosses: 0,
    modelPerformance: {}
};

let apiResponseData = {
    "Phien": null,
    "Xuc_xac_1": null,
    "Xuc_xac_2": null,
    "Xuc_xac_3": null,
    "Tong": null,
    "Ket_qua": "",
    "Phien_hien_tai": null,
    "Du_doan": "",
    "Loai_cau": "",
    "Mau_cau_phat_hien": "",
    "Do_tin_cay": "0%",
    "Trang_thai": "",
    "Ket_qua_du_doan": "",
    "Thong_ke": {
        "tong": 0,
        "dung": 0,
        "sai": 0,
        "ti_le": "0%"
    },
    "id": "@tranhoang2286"
};

// ==================== TAI XIU ANALYZER ====================
class TaiXiuAnalyzer {
    constructor() {
        this.modelWeights = modelWeights;
        this.subModelWeights = subModelWeights;
        this.miniModelWeights = miniModelWeights;
        this.subModels = {};
        this.initSubModels();
        this.miniModels = {};
        this.initMiniModels();
        this.performanceHistory = {};
        this.patternLibrary = this.loadPatternLibrary();
    }
    
    loadPatternLibrary() {
        if (fs.existsSync(PATTERNS_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8'));
            } catch (e) {
                console.error('[❌] Lỗi đọc patterns.json:', e.message);
            }
        }
        return {
            '1-1': [], '2-2': [], '3-3': [], '1-2': [], '2-1': [],
            '2-1-2': [], '1-2-1': [], 'bệt': [], 'loạn': []
        };
    }
    
    savePatternLibrary() {
        fs.writeFileSync(PATTERNS_FILE, JSON.stringify(this.patternLibrary, null, 2));
    }
    
    initSubModels() {
        const subModelSpecialties = {
            1: { name: '1-1 thuần', type: '1-1', logic: 'pure', minLength: 4, threshold: 0.9 },
            2: { name: '1-1 biến thể', type: '1-1', logic: 'variant', minLength: 5, threshold: 0.8 },
            3: { name: '1-1 dài hạn', type: '1-1', logic: 'long', minLength: 8, threshold: 0.75 },
            4: { name: '1-1 kết hợp', type: '1-1', logic: 'hybrid', minLength: 6, threshold: 0.7 },
            5: { name: '1-1 gãy', type: '1-1', logic: 'break', minLength: 6, threshold: 0.8 },
            6: { name: '1-1 phục hồi', type: '1-1', logic: 'recovery', minLength: 7, threshold: 0.7 },
            7: { name: '2-2 chuẩn', type: '2-2', logic: 'pure', minLength: 6, threshold: 0.9 },
            8: { name: '2-2 lệch', type: '2-2', logic: 'offset', minLength: 7, threshold: 0.8 },
            9: { name: '2-2 biến tướng', type: '2-2', logic: 'variant', minLength: 8, threshold: 0.75 },
            10: { name: '2-2 kết hợp 1-1', type: '2-2', logic: 'hybrid', minLength: 8, threshold: 0.7 },
            11: { name: '2-2 dài', type: '2-2', logic: 'long', minLength: 10, threshold: 0.8 },
            12: { name: '2-2 bẻ', type: '2-2', logic: 'break', minLength: 7, threshold: 0.85 },
            13: { name: 'bệt ngắn', type: 'bệt', logic: 'short', minLength: 3, threshold: 0.8 },
            14: { name: 'bệt trung', type: 'bệt', logic: 'medium', minLength: 5, threshold: 0.85 },
            15: { name: 'bệt dài', type: 'bệt', logic: 'long', minLength: 7, threshold: 0.9 },
            16: { name: 'bệt gãy', type: 'bệt', logic: 'break', minLength: 5, threshold: 0.8 },
            17: { name: 'bệt xen kẽ', type: 'bệt', logic: 'hybrid', minLength: 6, threshold: 0.7 },
            18: { name: 'siêu bệt', type: 'bệt', logic: 'super', minLength: 10, threshold: 0.95 },
            19: { name: '3-3 chuẩn', type: '3-3', logic: 'pure', minLength: 9, threshold: 0.9 },
            20: { name: '3-3 biến thể', type: '3-3', logic: 'variant', minLength: 10, threshold: 0.8 },
            21: { name: '3-3 ngắn', type: '3-3', logic: 'short', minLength: 6, threshold: 0.7 },
            22: { name: '3-3 kết hợp', type: '3-3', logic: 'hybrid', minLength: 9, threshold: 0.75 },
            23: { name: '3-3 bẻ', type: '3-3', logic: 'break', minLength: 8, threshold: 0.8 },
            24: { name: '3-3 dài', type: '3-3', logic: 'long', minLength: 12, threshold: 0.85 },
            25: { name: '2-1-2 chuẩn', type: '2-1-2', logic: 'pure', minLength: 5, threshold: 0.9 },
            26: { name: '2-1-2 biến thể', type: '2-1-2', logic: 'variant', minLength: 6, threshold: 0.8 },
            27: { name: '2-1-2 dài', type: '2-1-2', logic: 'long', minLength: 8, threshold: 0.8 },
            28: { name: '1-2-1 chuẩn', type: '1-2-1', logic: 'pure', minLength: 5, threshold: 0.9 },
            29: { name: '1-2-1 biến thể', type: '1-2-1', logic: 'variant', minLength: 6, threshold: 0.8 },
            30: { name: '1-2-1 dài', type: '1-2-1', logic: 'long', minLength: 8, threshold: 0.8 },
            31: { name: 'bẻ cầu 1-1', type: 'break', logic: 'break11', minLength: 4, threshold: 0.85 },
            32: { name: 'bẻ cầu 2-2', type: 'break', logic: 'break22', minLength: 5, threshold: 0.85 },
            33: { name: 'bẻ cầu bệt', type: 'break', logic: 'breakStreak', minLength: 4, threshold: 0.8 },
            34: { name: 'chuyển tiếp 1-1 sang 2-2', type: 'transition', logic: '11to22', minLength: 6, threshold: 0.75 },
            35: { name: 'chuyển tiếp 2-2 sang 1-1', type: 'transition', logic: '22to11', minLength: 6, threshold: 0.75 },
            36: { name: 'chuyển tiếp bệt sang 1-1', type: 'transition', logic: 'streakTo11', minLength: 5, threshold: 0.7 },
            37: { name: 'phân tích tần suất', type: 'frequency', logic: 'frequency', minLength: 10, threshold: 0.7 },
            38: { name: 'phân tích chu kỳ', type: 'cycle', logic: 'cycle', minLength: 12, threshold: 0.7 },
            39: { name: 'phân tích đối xứng', type: 'symmetry', logic: 'symmetry', minLength: 8, threshold: 0.75 },
            40: { name: 'phân tích Fibonacci', type: 'fibonacci', logic: 'fibonacci', minLength: 8, threshold: 0.7 },
            41: { name: 'phân tích xu hướng dài', type: 'trend', logic: 'longTrend', minLength: 15, threshold: 0.8 },
            42: { name: 'tổng hợp siêu cầu', type: 'super', logic: 'super', minLength: 20, threshold: 0.85 }
        };
        
        for (let i = 1; i <= 42; i++) {
            this.subModels[`sub_model_${i}`] = {
                ...subModelSpecialties[i],
                weight: this.subModelWeights[`sub_model_${i}`] || 1.0,
                accuracy: 0.5,
                predictions: []
            };
        }
    }
    
    initMiniModels() {
        const specialties = {
            1: 'phat_hien_cau_dep',
            2: 'du_doan_bien_dong',
            3: 'phan_tich_so_sanh',
            4: 'nhan_dien_xu_huong_cuc_bo',
            5: 'tinh_toan_xac_suat_cao',
            6: 'phat_hien_diem_gay',
            7: 'du_doan_nguong',
            8: 'phan_tich_chuoi',
            9: 'nhan_dien_mau_lap',
            10: 'tinh_he_so_tuong_quan',
            11: 'du_doan_doan_nhiet',
            12: 'phan_tich_pha',
            13: 'nhan_dien_song',
            14: 'tinh_toan_momentum',
            15: 'du_doan_hoi_phuc',
            16: 'phat_hien_dot_bien',
            17: 'phan_tich_can_bang',
            18: 'nhan_dien_tan_so',
            19: 'du_doan_chu_ky',
            20: 'tinh_toan_ma_tran',
            21: 'phan_tich_tong_hop'
        };
        
        for (let i = 1; i <= 21; i++) {
            this.miniModels[`mini_model_${i}`] = {
                weight: this.miniModelWeights[`mini_model_${i}`] || 1.0,
                accuracy: 0.5,
                specialty: specialties[i] || 'chung',
                predictions: []
            };
        }
    }
    
    getResultArray(history) {
        return history.map(h => h.Ket_qua || (h.score >= 11 ? 'Tài' : 'Xỉu'));
    }
    
    // Helper functions
    isPerfectAlternating(results, length) {
        const last = results.slice(-length);
        for (let i = 0; i < last.length - 1; i++) {
            if (last[i] === last[i+1]) return false;
        }
        return true;
    }
    
    isAlternatingWithTolerance(results, tolerance) {
        const last = results.slice(-6);
        let errors = 0;
        for (let i = 0; i < last.length - 1; i++) {
            if (last[i] === last[i+1]) errors++;
        }
        return errors <= tolerance;
    }
    
    countAlternating(results) {
        let count = 0;
        for (let i = 0; i < results.length - 1; i++) {
            if (results[i] !== results[i+1]) count++;
        }
        return count;
    }
    
    getStreak(results) {
        if (results.length === 0) return 0;
        const last = results[results.length - 1];
        let streak = 1;
        for (let i = results.length - 2; i >= 0; i--) {
            if (results[i] === last) streak++;
            else break;
        }
        return streak;
    }
    
    analyzeFrequency(results) {
        const recent = results.slice(-20);
        const taiCount = recent.filter(r => r === 'Tài').length;
        const xiuCount = recent.length - taiCount;
        const ratio = Math.max(taiCount, xiuCount) / recent.length;
        const dominant = taiCount > xiuCount ? 'Tài' : 'Xỉu';
        return { dominant, ratio };
    }
    
    detectCycle(results) {
        for (let cycleLen of [2, 3, 4]) {
            if (results.length < cycleLen * 2) continue;
            const lastCycle = results.slice(-cycleLen);
            const prevCycle = results.slice(-cycleLen*2, -cycleLen);
            if (JSON.stringify(lastCycle) === JSON.stringify(prevCycle)) {
                return {
                    found: true,
                    length: cycleLen,
                    next: lastCycle[0]
                };
            }
        }
        return { found: false };
    }
    
    checkSymmetry(results) {
        if (results.length < 6) return { found: false };
        const last3 = results.slice(-3);
        const prev3 = results.slice(-6, -3);
        if (last3[0] === prev3[2] && last3[1] === prev3[1] && last3[2] === prev3[0]) {
            return {
                found: true,
                prediction: last3[1]
            };
        }
        return { found: false };
    }
    
    checkFibonacci(results) {
        if (results.length < 5) return { found: false };
        const fibs = [1, 2, 3, 5];
        for (let fib of fibs) {
            if (results.length >= fib * 2) {
                const lastFib = results.slice(-fib);
                const prevFib = results.slice(-fib*2, -fib);
                if (JSON.stringify(lastFib) === JSON.stringify(prevFib)) {
                    return {
                        found: true,
                        prediction: lastFib[0]
                    };
                }
            }
        }
        return { found: false };
    }
    
    getLongTrend(results) {
        if (results.length < 10) return { strength: 0, direction: null };
        const first = results.slice(0, 5);
        const last = results.slice(-5);
        const firstTai = first.filter(r => r === 'Tài').length;
        const lastTai = last.filter(r => r === 'Tài').length;
        if (lastTai > firstTai + 2) return { strength: 0.8, direction: 'Tài' };
        if (lastTai < firstTai - 2) return { strength: 0.8, direction: 'Xỉu' };
        return { strength: 0.5, direction: lastTai > 2 ? 'Tài' : 'Xỉu' };
    }
    
    superAnalysis(results) {
        const freq = this.analyzeFrequency(results);
        const trend = this.getLongTrend(results);
        const cycle = this.detectCycle(results);
        let score = 0, predictions = [];
        if (freq.ratio > 0.6) { predictions.push({ pred: freq.dominant, weight: freq.ratio }); score++; }
        if (trend.strength > 0.7) { predictions.push({ pred: trend.direction, weight: trend.strength }); score++; }
        if (cycle.found) { predictions.push({ pred: cycle.next, weight: 0.7 }); score++; }
        if (score >= 2) {
            const taiWeight = predictions.filter(p => p.pred === 'Tài').reduce((s, p) => s + p.weight, 0);
            const xiuWeight = predictions.filter(p => p.pred === 'Xỉu').reduce((s, p) => s + p.weight, 0);
            if (taiWeight > xiuWeight * 1.5) return { prediction: 'Tài', confidence: 0.85, reason: 'Siêu phân tích đồng thuận Tài' };
            if (xiuWeight > taiWeight * 1.5) return { prediction: 'Xỉu', confidence: 0.85, reason: 'Siêu phân tích đồng thuận Xỉu' };
        }
        return { confidence: 0 };
    }
    
    // Sub Models
    runSubModel11(results, model) {
        if (results.length < model.minLength) return null;
        const last = results[results.length - 1];
        if (model.logic === 'pure' && this.isPerfectAlternating(results, 4)) {
            return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 1-1 thuần túy' };
        }
        if (model.logic === 'variant' && this.isAlternatingWithTolerance(results, 1)) {
            return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 1-1 biến thể' };
        }
        if (model.logic === 'long') {
            const altCount = this.countAlternating(results.slice(-12));
            if (altCount >= 8) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (altCount / 20), reason: `Cầu 1-1 dài hạn với ${altCount}/11 cặp xen kẽ` };
        }
        return null;
    }
    
    runSubModel22(results, model) {
        if (results.length < model.minLength) return null;
        const last6 = results.slice(-6);
        const last8 = results.slice(-8);
        if (model.logic === 'pure' && last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] !== last6[4] && last6[4] === last6[5]) {
            return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 2-2 chuẩn' };
        }
        if (model.logic === 'offset' && last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] !== last6[3] && last6[3] === last6[4] && last6[4] !== last6[5]) {
            return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 2-2 lệch' };
        }
        if (model.logic === 'long' && last8.length === 8) {
            let score = 0;
            for (let i = 0; i < 7; i+=2) if (last8[i] === last8[i+1]) score++;
            if (score >= 3) return { prediction: last8[7] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (score * 0.05), reason: `Cầu 2-2 dài với ${score}/4 cặp đúng` };
        }
        return null;
    }
    
    runSubModelStreak(results, model) {
        const streak = this.getStreak(results);
        const last = results[results.length - 1];
        const other = last === 'Tài' ? 'Xỉu' : 'Tài';
        if (model.logic === 'short' && streak >= 2 && streak <= 3) return { prediction: last, confidence: 0.7 + (streak * 0.05), reason: `Bệt ngắn ${streak} phiên` };
        if (model.logic === 'medium' && streak >= 4 && streak <= 5) return { prediction: last, confidence: 0.75 + ((streak - 4) * 0.05), reason: `Bệt trung ${streak} phiên` };
        if (model.logic === 'long' && streak >= 6) return { prediction: last, confidence: 0.8 + (Math.min(streak, 10) * 0.01), reason: `Bệt dài ${streak} phiên` };
        if (model.logic === 'break' && streak >= 4) return { prediction: other, confidence: 0.6 + (streak * 0.03), reason: `Bệt ${streak} phiên, dự đoán sắp gãy` };
        if (model.logic === 'super' && streak >= 8) return { prediction: last, confidence: 0.9, reason: `Siêu bệt ${streak} phiên` };
        return null;
    }
    
    runSubModel33(results, model) {
        if (results.length < model.minLength) return null;
        const last9 = results.slice(-9);
        const last12 = results.slice(-12);
        if (model.logic === 'pure' && last9.length === 9 && last9[0] === last9[1] && last9[1] === last9[2] && last9[3] === last9[4] && last9[4] === last9[5] && last9[6] === last9[7] && last9[7] === last9[8] && last9[0] !== last9[3] && last9[3] !== last9[6]) {
            return { prediction: last9[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 3-3 chuẩn' };
        }
        if (model.logic === 'short') {
            const last6 = results.slice(-6);
            if (last6[0] === last6[1] && last6[1] === last6[2] && last6[3] === last6[4] && last6[4] === last6[5]) {
                return { prediction: last6[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Cầu 3-3 ngắn (6 phiên)' };
            }
        }
        if (model.logic === 'long' && results.length >= 15) {
            const last15 = results.slice(-15);
            let pattern = [];
            for (let i = 0; i < 15; i+=3) if (i+2 < 15 && last15[i] === last15[i+1] && last15[i+1] === last15[i+2]) pattern.push(last15[i]);
            if (pattern.length >= 4 && pattern[0] !== pattern[1] && pattern[1] !== pattern[2]) {
                return { prediction: pattern[pattern.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Cầu 3-3 dài hạn' };
            }
        }
        return null;
    }
    
    runSubModel212(results, model) {
        if (results.length < model.minLength) return null;
        const last5 = results.slice(-5);
        if (model.logic === 'pure' && last5.length === 5 && last5[0] === last5[1] && last5[1] !== last5[2] && last5[2] !== last5[3] && last5[3] === last5[4] && last5[0] === last5[3]) {
            return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 2-1-2 chuẩn' };
        }
        return null;
    }
    
    runSubModel121(results, model) {
        if (results.length < model.minLength) return null;
        const last5 = results.slice(-5);
        if (model.logic === 'pure' && last5.length === 5 && last5[0] !== last5[1] && last5[1] === last5[2] && last5[2] !== last5[3] && last5[3] === last5[4] && last5[0] === last5[3]) {
            return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 1-2-1 chuẩn' };
        }
        return null;
    }
    
    runSubModelBreak(results, model) {
        if (results.length < model.minLength) return null;
        const last4 = results.slice(-4);
        const last5 = results.slice(-5);
        if (model.logic === 'break11' && last4.length === 4 && last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] === last4[3]) {
            return { prediction: last4[3], confidence: 0.85, reason: 'Phát hiện bẻ cầu 1-1' };
        }
        if (model.logic === 'break22' && last5.length === 5 && last5[0] === last5[1] && last5[1] !== last5[2] && last5[2] === last5[3] && last5[3] !== last5[4] && last5[0] === last5[4]) {
            return { prediction: last5[4], confidence: 0.85, reason: 'Phát hiện bẻ cầu 2-2' };
        }
        if (model.logic === 'breakStreak') {
            const streak = this.getStreak(results.slice(0, -1));
            if (streak >= 3 && results[results.length-1] !== results[results.length-2]) {
                return { prediction: results[results.length-1], confidence: 0.8, reason: `Phát hiện bẻ cầu bệt sau ${streak} phiên` };
            }
        }
        return null;
    }
    
    runSubModelAdvanced(results, model) {
        if (results.length < model.minLength) return null;
        if (model.logic === 'frequency') {
            const freq = this.analyzeFrequency(results);
            if (freq.ratio > 0.6) return { prediction: freq.dominant === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.6 + (freq.ratio * 0.2), reason: `Tần suất ${freq.dominant} ${(freq.ratio*100).toFixed(0)}%` };
        }
        if (model.logic === 'cycle') {
            const cycle = this.detectCycle(results);
            if (cycle.found) return { prediction: cycle.next, confidence: 0.7, reason: `Phát hiện chu kỳ ${cycle.length} phiên` };
        }
        if (model.logic === 'super') {
            const superAnalysis = this.superAnalysis(results);
            if (superAnalysis.confidence > 0.8) return superAnalysis;
        }
        return null;
    }
    
    runSubModel(index, history) {
        if (history.length < 3) return null;
        const results = this.getResultArray(history);
        const model = this.subModels[`sub_model_${index}`];
        if (!model) return null;
        let result = null;
        switch (model.type) {
            case '1-1': result = this.runSubModel11(results, model); break;
            case '2-2': result = this.runSubModel22(results, model); break;
            case 'bệt': result = this.runSubModelStreak(results, model); break;
            case '3-3': result = this.runSubModel33(results, model); break;
            case '2-1-2': result = this.runSubModel212(results, model); break;
            case '1-2-1': result = this.runSubModel121(results, model); break;
            case 'break': result = this.runSubModelBreak(results, model); break;
            default: result = this.runSubModelAdvanced(results, model);
        }
        if (result) { result.model_name = model.name; return result; }
        return null;
    }
    
    runMiniModel(index, history) {
        if (history.length < 2) return null;
        const results = this.getResultArray(history);
        const mini = this.miniModels[`mini_model_${index}`];
        if (mini.specialty === 'phat_hien_cau_dep') {
            const last3 = results.slice(-3);
            if (last3[0] !== last3[1] && last3[1] !== last3[2]) {
                return { prediction: last3[2] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Cầu đẹp 1-1', model_name: mini.specialty };
            }
        }
        if (mini.specialty === 'tinh_toan_xac_suat_cao') {
            const taiCount = results.filter(r => r === 'Tài').length;
            if (taiCount > results.length/2 + 2) return { prediction: 'Xỉu', confidence: 0.7, reason: 'Xác suất Tài cao bắt Xỉu', model_name: mini.specialty };
            if (taiCount < results.length/2 - 2) return { prediction: 'Tài', confidence: 0.7, reason: 'Xác suất Xỉu cao bắt Tài', model_name: mini.specialty };
        }
        return null;
    }
    
    analyzeBasicPatterns(history) {
        if (history.length < 3) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' };
        const results = this.getResultArray(history);
        const last = results[results.length-1];
        const other = last === 'Tài' ? 'Xỉu' : 'Tài';
        const last3 = results.slice(-3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) return { prediction: last, confidence: 0.7, reason: 'Bệt 3', pattern_type: 'basic' };
        if (last3[0] !== last3[1] && last3[1] !== last3[2]) return { prediction: other, confidence: 0.75, reason: 'Cầu 1-1', pattern_type: 'basic' };
        return { prediction: other, confidence: 0.5, reason: 'Đảo cầu', pattern_type: 'basic' };
    }
    
    analyzeTrend(history) {
        if (history.length < 5) return { prediction: null, confidence: 0 };
        const results = this.getResultArray(history);
        const short = results.slice(-3).filter(r => r === 'Tài').length;
        const long = results.slice(-10).filter(r => r === 'Tài').length;
        if (short >= 2 && long >= 6) return { prediction: short >= 2 ? 'Tài' : 'Xỉu', confidence: 0.7, reason: 'Xu hướng đồng thuận' };
        if (short >= 2) return { prediction: short >= 2 ? 'Tài' : 'Xỉu', confidence: 0.6, reason: 'Xu hướng ngắn' };
        if (long >= 6) return { prediction: long >= 6 ? 'Tài' : 'Xỉu', confidence: 0.6, reason: 'Xu hướng dài' };
        return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.5, reason: 'Không rõ đảo cầu' };
    }
    
    analyzeImbalance(history) {
        if (history.length < 12) return { prediction: null, confidence: 0 };
        const results = this.getResultArray(history.slice(-12));
        const taiCount = results.filter(r => r === 'Tài').length;
        const imbalance = Math.abs(taiCount - 6) / 12;
        if (imbalance > 0.3) return { prediction: taiCount > 6 ? 'Xỉu' : 'Tài', confidence: 0.7 + imbalance * 0.2, reason: `Chênh lệch ${taiCount}T-${12-taiCount}X` };
        return { prediction: results[results.length-1], confidence: 0.5, reason: 'Cân bằng theo xu hướng' };
    }
    
    analyzeShortTerm(history) {
        if (history.length < 3) return { prediction: null, confidence: 0 };
        const results = this.getResultArray(history);
        const last3 = results.slice(-3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) return { prediction: last3[0], confidence: 0.75, pattern: 'bệt', reason: 'Bệt 3 phiên' };
        if (last3[0] !== last3[1] && last3[1] !== last3[2]) return { prediction: last3[2] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, pattern: 'xen_kẽ', reason: 'Cầu xen kẽ' };
        if (last3[0] === last3[1] && last3[1] !== last3[2]) return { prediction: last3[2], confidence: 0.7, pattern: '2-1', reason: 'Pattern 2-1' };
        return { prediction: results[results.length-1], confidence: 0.4, pattern: 'không_rõ', reason: 'Không rõ' };
    }
    
    analyzeDiceVolatility(history) {
        if (history.length < 5 || !history[0].Xuc_xac_1) return { prediction: null, confidence: 0 };
        const recentFaces = [];
        history.slice(-5).forEach(h => { if(h.Xuc_xac_1) recentFaces.push(h.Xuc_xac_1); if(h.Xuc_xac_2) recentFaces.push(h.Xuc_xac_2); if(h.Xuc_xac_3) recentFaces.push(h.Xuc_xac_3); });
        const freq = {1:0,2:0,3:0,4:0,5:0,6:0};
        recentFaces.forEach(f => freq[f]++);
        const lowFaces = []; for(let f=1;f<=6;f++) if(freq[f]<2) lowFaces.push(f);
        if(lowFaces.length >= 3) {
            const avg = (lowFaces[0] + lowFaces[1] + lowFaces[2]) / 3;
            return { prediction: avg >= 11 ? 'Tài' : 'Xỉu', confidence: 0.6, reason: `Mặt ít về ${lowFaces.slice(0,3).join(',')}` };
        }
        return null;
    }
    
    ensembleModels(history) {
        const modelResults = {};
        modelResults.model1 = this.analyzeBasicPatterns(history);
        modelResults.model2 = this.analyzeTrend(history);
        modelResults.model3 = this.analyzeImbalance(history);
        modelResults.model4 = this.analyzeShortTerm(history);
        modelResults.model11 = this.analyzeDiceVolatility(history);
        for (let i = 1; i <= 42; i++) { const r = this.runSubModel(i, history); if (r && r.prediction) modelResults[`sub_model_${i}`] = r; }
        for (let i = 1; i <= 21; i++) { const r = this.runMiniModel(i, history); if (r && r.prediction) modelResults[`mini_model_${i}`] = r; }
        let taiWeight = 0, xiuWeight = 0, totalWeight = 0, details = [];
        for (let [name, res] of Object.entries(modelResults)) {
            if (res && res.prediction && res.confidence > 0.3) {
                let w = 1.0;
                if (name.startsWith('sub')) w = this.subModelWeights[name] || 1.0;
                else if (name.startsWith('mini')) w = this.miniModelWeights[name] || 1.0;
                else w = this.modelWeights[name] || 1.0;
                const wc = w * res.confidence;
                if (res.prediction === 'Tài') taiWeight += wc;
                else xiuWeight += wc;
                totalWeight += wc;
                details.push({ model: res.model_name || name, prediction: res.prediction, confidence: res.confidence, reason: res.reason });
            }
        }
        details.sort((a,b) => b.confidence - a.confidence);
        if (totalWeight > 0) {
            const taiRatio = taiWeight / totalWeight;
            if (taiRatio > 0.55) return { prediction: 'Tài', confidence: taiRatio, reason: `${details.length} models đồng thuận Tài`, pattern_type: details[0]?.model || 'N/A', pattern: '', details: details.slice(0,5) };
            if (taiRatio < 0.45) return { prediction: 'Xỉu', confidence: 1 - taiRatio, reason: `${details.length} models đồng thuận Xỉu`, pattern_type: details[0]?.model || 'N/A', pattern: '', details: details.slice(0,5) };
        }
        return { prediction: history[history.length-1]?.Ket_qua || 'Tài', confidence: 0.5, reason: 'Không đủ đồng thuận', pattern_type: 'mặc định', pattern: '', details: details.slice(0,3) };
    }
    
    updateModelWeights(actual, predicted, confidence) {
        const correct = actual === predicted;
        for (let name in this.modelWeights) this.modelWeights[name] = correct ? Math.min(this.modelWeights[name]*1.01,2.0) : Math.max(this.modelWeights[name]*0.99,0.5);
        for (let name in this.subModelWeights) this.subModelWeights[name] = correct ? Math.min(this.subModelWeights[name]*1.005,1.5) : Math.max(this.subModelWeights[name]*0.995,0.7);
        for (let name in this.miniModelWeights) this.miniModelWeights[name] = correct ? Math.min(this.miniModelWeights[name]*1.003,1.3) : Math.max(this.miniModelWeights[name]*0.997,0.8);
        saveModelWeights();
    }
}

const analyzer = new TaiXiuAnalyzer();

// ==================== WEBSOCKET ====================
const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = { "User-Agent": "Mozilla/5.0", "Origin": "https://play.sun.win" };
const RECONNECT_DELAY = 2500;
const PING_INTERVAL = 15000;
const INIT_MSGS = [
    [1,"MiniGame","GM_apivopnha","WangLin",{"info":"{\"ipAddress\":\"14.249.227.107\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiI5ODE5YW5zc3MiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMjMyODExNTEsImFmZklkIjoic3VuLndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzYzMDMyOTI4NzcwLCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjE0LjI0OS4yMjcuMTA3IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wNS5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiI4ODM4NTMzZS1kZTQzLTRiOGQtOTUwMy02MjFmNDA1MDUzNGUiLCJyZWdUaW1lIjoxNzYxNjMyMzAwNTc2LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6IkdNX2FwaXZvcG5oYSJ9.guH6ztJSPXUL1cU8QdMz8O1Sdy_SbxjSM-CDzWPTr-0\",\"locale\":\"vi\",\"userId\":\"8838533e-de43-4b8d-9503-621f4050534e\",\"username\":\"GM_apivopnha\",\"timestamp\":1763032928770,\"refreshToken\":\"e576b43a64e84f789548bfc7c4c8d1e5.7d4244a361e345908af95ee2e8ab2895\"}","signature":"45EF4B318C883862C36E1B189A1DF5465EBB60CB602BA05FAD8FCBFCD6E0DA8CB3CE65333EDD79A2BB4ABFCE326ED5525C7D971D9DEDB5A17A72764287FFE6F62CBC2DF8A04CD8EFF8D0D5AE27046947ADE45E62E644111EFDE96A74FEC635A97861A425FF2B5732D74F41176703CA10CFEED67D0745FF15EAC1065E1C8BCBFA"}],
    [6,"MiniGame","taixiuPlugin",{cmd:1005}],[6,"MiniGame","lobbyPlugin",{cmd:10001}]
];
let ws = null, pingInterval = null, reconnectTimeout = null;

function connectWebSocket() {
    if (ws) { ws.removeAllListeners(); ws.close(); }
    ws = new WebSocket(WEBSOCKET_URL, { headers: WS_HEADERS });
    ws.on('open', () => {
        console.log('[✅] WebSocket connected.');
        INIT_MSGS.forEach((msg, i) => setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }, i * 600));
        clearInterval(pingInterval);
        pingInterval = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.ping(); }, PING_INTERVAL);
    });
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;
            const { cmd, sid, d1, d2, d3, gBB } = data[1];
            if (cmd === 1008 && sid) currentSessionId = sid;
            if (cmd === 1003 && gBB && d1 && d2 && d3) {
                const total = d1 + d2 + d3;
                const result = total > 10 ? "Tài" : "Xỉu";
                let predictionCorrect = false;
                if (lastPrediction && lastPrediction.ket_qua) {
                    predictionCorrect = (lastPrediction.ket_qua === result);
                    stats.total++;
                    if (predictionCorrect) { stats.correct++; stats.consecutiveLosses = 0; }
                    else { stats.wrong++; stats.consecutiveLosses++; }
                    analyzer.updateModelWeights(result, lastPrediction.ket_qua, lastPrediction.do_tin_cay);
                }
                const historyEntry = { phien: currentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: lastPrediction?.ket_qua, loai_cau: lastPrediction?.loai_cau, do_tin_cay: lastPrediction?.do_tin_cay, thoi_gian: new Date().toISOString() };
                saveHistory(historyEntry);
                const historyForAnalyzer = resultHistory.map(h => ({ score: h.Tong, Ket_qua: h.Ket_qua, Xuc_xac_1: h.Xuc_xac_1, Xuc_xac_2: h.Xuc_xac_2, Xuc_xac_3: h.Xuc_xac_3 }));
                const ensemble = analyzer.ensembleModels(historyForAnalyzer);
                let finalPred = ensemble.prediction, finalConf = ensemble.confidence, finalType = ensemble.pattern_type, finalPattern = ensemble.pattern, finalReason = ensemble.reason;
                if (stats.consecutiveLosses >= 3) { finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài'; finalConf = 0.4; finalType = 'CHỐNG ĐẢO'; finalPattern = ''; finalReason = 'Chống đảo do thua liên tiếp'; }
                lastPrediction = { phien: currentSessionId ? parseInt(currentSessionId) + 1 : null, ket_qua: finalPred, loai_cau: finalType, mau_cau: finalPattern, do_tin_cay: (finalConf * 100).toFixed(0) + '%' };
                const trangThai = finalType.includes('CHỐNG') ? 'Chống đảo' : (finalType.includes('THEO') ? 'Đang theo kết quả' : 'Đang theo cầu');
                const tiLe = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%';
                apiResponseData = { "Phien": currentSessionId, "Xuc_xac_1": d1, "Xuc_xac_2": d2, "Xuc_xac_3": d3, "Tong": total, "Ket_qua": result, "Phien_hien_tai": currentSessionId ? parseInt(currentSessionId) + 1 : null, "Du_doan": finalPred, "Loai_cau": finalType, "Mau_cau_phat_hien": finalPattern, "Do_tin_cay": (finalConf * 100).toFixed(0) + '%', "Trang_thai": trangThai, "Ket_qua_du_doan": predictionCorrect ? '✅' : (stats.total > 0 ? '❌' : ''), "Thong_ke": { "tong": stats.total, "dung": stats.correct, "sai": stats.wrong, "ti_le": tiLe }, "id": "@tranhoang2286" };
                console.log(`🎲 Phiên ${apiResponseData.Phien} | KQ: ${result} | Dự đoán: ${finalPred} (${(finalConf*100).toFixed(0)}%) | ${predictionCorrect ? '✅' : '❌'} | TL: ${tiLe}`);
                currentSessionId = null;
            }
        } catch(e) { console.error('[❌] Lỗi xử lý message:', e.message); }
    });
    ws.on('close', () => { clearInterval(pingInterval); clearTimeout(reconnectTimeout); reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY); });
    ws.on('error', (err) => { console.error('[❌] WebSocket error:', err.message); ws.close(); });
}

// ==================== EXPRESS API ====================
app.get('/api/sunwin', (req, res) => { res.json(apiResponseData); });
app.get('/api/sunwin/history', (req, res) => { res.json({ success: true, total: resultHistory.length, data: resultHistory.slice(-30).reverse(), stats: { tong: stats.total, dung: stats.correct, sai: stats.wrong, ti_le: stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%' } }); });
app.get('/api/sunwin/models', (req, res) => { res.json({ main_models: Object.keys(analyzer.modelWeights).length, sub_models: Object.keys(analyzer.subModels).length, mini_models: Object.keys(analyzer.miniModels).length, total: 84 }); });
app.get('/', (req, res) => { res.json(apiResponseData); });

connectWebSocket();
app.listen(PORT, () => console.log(`[🌐] Server running at http://localhost:${PORT}\n✅ /api/sunwin\n✅ /api/sunwin/history\n✅ /api/sunwin/models`));
