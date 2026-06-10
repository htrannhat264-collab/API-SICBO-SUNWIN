const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

// ==================== FILE STORAGE ====================
const HISTORY_FILE = './history.json';
const PATTERNS_FILE = './patterns.json';
const MODEL_WEIGHTS_FILE = './model_weights.json';
const HISTORY_LC79_FILE = './history_lc79.json';
const HISTORY_B52_FILE = './history_b52.json';
const HISTORY_HITCLUB_FILE = './history_hitclub.json';

// Load histories
let resultHistory = [];
let lc79History = [];
let b52History = [];
let hitclubHistory = [];

if (fs.existsSync(HISTORY_FILE)) {
    try { resultHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); console.log(`[📂] Đã tải ${resultHistory.length} phiên từ history.json`); } catch (e) {}
}
if (fs.existsSync(HISTORY_LC79_FILE)) {
    try { lc79History = JSON.parse(fs.readFileSync(HISTORY_LC79_FILE, 'utf8')); console.log(`[📂] Đã tải ${lc79History.length} phiên LC79`); } catch (e) {}
}
if (fs.existsSync(HISTORY_B52_FILE)) {
    try { b52History = JSON.parse(fs.readFileSync(HISTORY_B52_FILE, 'utf8')); console.log(`[📂] Đã tải ${b52History.length} phiên B52`); } catch (e) {}
}
if (fs.existsSync(HISTORY_HITCLUB_FILE)) {
    try { hitclubHistory = JSON.parse(fs.readFileSync(HISTORY_HITCLUB_FILE, 'utf8')); console.log(`[📂] Đã tải ${hitclubHistory.length} phiên Hitclub`); } catch (e) {}
}

// Model weights
let modelWeights = { 'model1':1.0,'model2':1.0,'model3':1.0,'model4':1.0,'model5':1.0,'model6':1.0,'model7':1.0,'model8':1.0,'model9':1.0,'model10':1.0,'model11':1.0,'model12':1.0,'model13':1.0,'model14':1.0,'model15':1.0,'model16':1.0,'model17':1.0,'model18':1.0,'model19':1.0,'model20':1.0,'model21':1.0 };
let subModelWeights = {};
let miniModelWeights = {};
for (let i = 1; i <= 42; i++) subModelWeights[`sub_model_${i}`] = 1.0;
for (let i = 1; i <= 21; i++) miniModelWeights[`mini_model_${i}`] = 1.0;

if (fs.existsSync(MODEL_WEIGHTS_FILE)) {
    try { const saved = JSON.parse(fs.readFileSync(MODEL_WEIGHTS_FILE, 'utf8')); modelWeights = saved.modelWeights || modelWeights; subModelWeights = saved.subModelWeights || subModelWeights; miniModelWeights = saved.miniModelWeights || miniModelWeights; } catch (e) {}
}

function saveHistory(entry, type = 'sunwin') {
    if (type === 'sunwin') { resultHistory.push(entry); if (resultHistory.length > 1000) resultHistory.shift(); fs.writeFileSync(HISTORY_FILE, JSON.stringify(resultHistory, null, 2)); }
    else if (type === 'lc79') { lc79History.push(entry); if (lc79History.length > 1000) lc79History.shift(); fs.writeFileSync(HISTORY_LC79_FILE, JSON.stringify(lc79History, null, 2)); }
    else if (type === 'b52') { b52History.push(entry); if (b52History.length > 1000) b52History.shift(); fs.writeFileSync(HISTORY_B52_FILE, JSON.stringify(b52History, null, 2)); }
    else if (type === 'hitclub') { hitclubHistory.push(entry); if (hitclubHistory.length > 1000) hitclubHistory.shift(); fs.writeFileSync(HISTORY_HITCLUB_FILE, JSON.stringify(hitclubHistory, null, 2)); }
}
function saveModelWeights() { fs.writeFileSync(MODEL_WEIGHTS_FILE, JSON.stringify({ modelWeights, subModelWeights, miniModelWeights }, null, 2)); }

// ==================== API CONFIGS ====================
const API_LC79_TX = "https://wtx.tele68.com/v1/tx/sessions";
const API_LC79_MD5 = "https://wtxmd52.tele68.com/v1/txmd5/sessions";
const API_B52 = "https://b52-qiw2.onrender.com/api/history";
const API_HITCLUB = "https://sun-win.onrender.com/api/history";
const HEADERS = { "User-Agent": "Mozilla/5.0", "Accept": "application/json" };
const http = axios.create({ timeout: 10000, headers: HEADERS });

// ==================== GLOBAL VARIABLES ====================
let currentSessionId = null, lastResult = null, lastPrediction = null;
let stats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };
let lc79Stats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };
let b52Stats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };
let hitclubStats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };

let apiResponseData = { "Phien": null, "Xuc_xac_1": null, "Xuc_xac_2": null, "Xuc_xac_3": null, "Tong": null, "Ket_qua": "", "Phien_hien_tai": null, "Du_doan": "", "Loai_cau": "", "Mau_cau_phat_hien": "", "Do_tin_cay": "0%", "Trang_thai": "", "Ket_qua_du_doan": "", "Thong_ke": { "tong": 0, "dung": 0, "sai": 0, "ti_le": "0%" }, "id": "@tranhoang2286" };

// ==================== TAI XIU ANALYZER ====================
class TaiXiuAnalyzer {
    constructor() { this.modelWeights = modelWeights; this.subModelWeights = subModelWeights; this.miniModelWeights = miniModelWeights; this.subModels = {}; this.miniModels = {}; this.initSubModels(); this.initMiniModels(); }
    initSubModels() {
        const specs = {
            1:{name:'1-1 thuần',type:'1-1',logic:'pure',minLength:4,threshold:0.9},2:{name:'1-1 biến thể',type:'1-1',logic:'variant',minLength:5,threshold:0.8},
            3:{name:'1-1 dài hạn',type:'1-1',logic:'long',minLength:8,threshold:0.75},4:{name:'1-1 kết hợp',type:'1-1',logic:'hybrid',minLength:6,threshold:0.7},
            5:{name:'1-1 gãy',type:'1-1',logic:'break',minLength:6,threshold:0.8},6:{name:'1-1 phục hồi',type:'1-1',logic:'recovery',minLength:7,threshold:0.7},
            7:{name:'2-2 chuẩn',type:'2-2',logic:'pure',minLength:6,threshold:0.9},8:{name:'2-2 lệch',type:'2-2',logic:'offset',minLength:7,threshold:0.8},
            9:{name:'2-2 biến tướng',type:'2-2',logic:'variant',minLength:8,threshold:0.75},10:{name:'2-2 kết hợp 1-1',type:'2-2',logic:'hybrid',minLength:8,threshold:0.7},
            11:{name:'2-2 dài',type:'2-2',logic:'long',minLength:10,threshold:0.8},12:{name:'2-2 bẻ',type:'2-2',logic:'break',minLength:7,threshold:0.85},
            13:{name:'bệt ngắn',type:'bệt',logic:'short',minLength:3,threshold:0.8},14:{name:'bệt trung',type:'bệt',logic:'medium',minLength:5,threshold:0.85},
            15:{name:'bệt dài',type:'bệt',logic:'long',minLength:7,threshold:0.9},16:{name:'bệt gãy',type:'bệt',logic:'break',minLength:5,threshold:0.8},
            17:{name:'bệt xen kẽ',type:'bệt',logic:'hybrid',minLength:6,threshold:0.7},18:{name:'siêu bệt',type:'bệt',logic:'super',minLength:10,threshold:0.95},
            19:{name:'3-3 chuẩn',type:'3-3',logic:'pure',minLength:9,threshold:0.9},20:{name:'3-3 biến thể',type:'3-3',logic:'variant',minLength:10,threshold:0.8},
            21:{name:'3-3 ngắn',type:'3-3',logic:'short',minLength:6,threshold:0.7},22:{name:'3-3 kết hợp',type:'3-3',logic:'hybrid',minLength:9,threshold:0.75},
            23:{name:'3-3 bẻ',type:'3-3',logic:'break',minLength:8,threshold:0.8},24:{name:'3-3 dài',type:'3-3',logic:'long',minLength:12,threshold:0.85},
            25:{name:'2-1-2 chuẩn',type:'2-1-2',logic:'pure',minLength:5,threshold:0.9},26:{name:'2-1-2 biến thể',type:'2-1-2',logic:'variant',minLength:6,threshold:0.8},
            27:{name:'2-1-2 dài',type:'2-1-2',logic:'long',minLength:8,threshold:0.8},28:{name:'1-2-1 chuẩn',type:'1-2-1',logic:'pure',minLength:5,threshold:0.9},
            29:{name:'1-2-1 biến thể',type:'1-2-1',logic:'variant',minLength:6,threshold:0.8},30:{name:'1-2-1 dài',type:'1-2-1',logic:'long',minLength:8,threshold:0.8},
            31:{name:'bẻ cầu 1-1',type:'break',logic:'break11',minLength:4,threshold:0.85},32:{name:'bẻ cầu 2-2',type:'break',logic:'break22',minLength:5,threshold:0.85},
            33:{name:'bẻ cầu bệt',type:'break',logic:'breakStreak',minLength:4,threshold:0.8},34:{name:'chuyển 1-1 sang 2-2',type:'transition',logic:'11to22',minLength:6,threshold:0.75},
            35:{name:'chuyển 2-2 sang 1-1',type:'transition',logic:'22to11',minLength:6,threshold:0.75},36:{name:'chuyển bệt sang 1-1',type:'transition',logic:'streakTo11',minLength:5,threshold:0.7},
            37:{name:'phân tích tần suất',type:'frequency',logic:'frequency',minLength:10,threshold:0.7},38:{name:'phân tích chu kỳ',type:'cycle',logic:'cycle',minLength:12,threshold:0.7},
            39:{name:'phân tích đối xứng',type:'symmetry',logic:'symmetry',minLength:8,threshold:0.75},40:{name:'phân tích Fibonacci',type:'fibonacci',logic:'fibonacci',minLength:8,threshold:0.7},
            41:{name:'phân tích xu hướng dài',type:'trend',logic:'longTrend',minLength:15,threshold:0.8},42:{name:'tổng hợp siêu cầu',type:'super',logic:'super',minLength:20,threshold:0.85}
        };
        for (let i = 1; i <= 42; i++) this.subModels[`sub_model_${i}`] = { ...specs[i], weight: this.subModelWeights[`sub_model_${i}`] || 1.0, accuracy: 0.5 };
    }
    initMiniModels() {
        const specs = {1:'phat_hien_cau_dep',2:'du_doan_bien_dong',3:'nhan_dien_xu_huong_cuc_bo',4:'tinh_toan_xac_suat_cao',5:'phan_tich_so_sanh',
            6:'nhan_dien_mau_lap',7:'tinh_he_so_tuong_quan',8:'du_doan_doan_nhiet',9:'phan_tich_pha',10:'nhan_dien_song',
            11:'tinh_toan_momentum',12:'du_doan_hoi_phuc',13:'phat_hien_dot_bien',14:'phan_tich_can_bang',15:'nhan_dien_tan_so',
            16:'du_doan_chu_ky',17:'tinh_toan_ma_tran',18:'phan_tich_tong_hop',19:'phat_hien_cau_an',20:'du_doan_nguong_nguy_hiem',21:'tinh_toan_xac_suat_chuan'};
        for (let i = 1; i <= 21; i++) this.miniModels[`mini_model_${i}`] = { weight: this.miniModelWeights[`mini_model_${i}`] || 1.0, accuracy: 0.5, specialty: specs[i] || 'chung' };
    }
    getResultArray(history) { return history.map(h => h.Ket_qua || (h.score >= 11 ? 'Tài' : 'Xỉu')); }
    getStreak(results) { if (results.length === 0) return 0; const last = results[results.length-1]; let streak = 1; for (let i=results.length-2; i>=0; i--) if (results[i] === last) streak++; else break; return streak; }
    analyzeFrequency(results) { const recent = results.slice(-20); const taiCount = recent.filter(r=>r==='Tài').length; const ratio = Math.max(taiCount, recent.length-taiCount)/recent.length; return { dominant: taiCount > recent.length/2 ? 'Tài' : 'Xỉu', ratio }; }
    detectCycle(results) { for (let len of [2,3,4]) { if (results.length < len*2) continue; if (JSON.stringify(results.slice(-len)) === JSON.stringify(results.slice(-len*2,-len))) return { found: true, length: len, next: results.slice(-len)[0] }; } return { found: false }; }
    
    runSubModel11(results, model) {
        if (results.length < model.minLength) return null;
        const last = results[results.length-1];
        if (model.logic === 'pure' && this.isPerfectAlternating(results,4)) return { prediction: last==='Tài'?'Xỉu':'Tài', confidence:0.9, reason:'Cầu 1-1 thuần túy' };
        if (model.logic === 'variant' && this.isAlternatingWithTolerance(results,1)) return { prediction: last==='Tài'?'Xỉu':'Tài', confidence:0.8, reason:'Cầu 1-1 biến thể' };
        if (model.logic === 'long') { const altCount = this.countAlternating(results.slice(-12)); if (altCount >= 8) return { prediction: last==='Tài'?'Xỉu':'Tài', confidence:0.7+altCount/20, reason:`Cầu 1-1 dài ${altCount}/11` }; }
        return null;
    }
    isPerfectAlternating(results, len) { const last = results.slice(-len); for (let i=0; i<last.length-1; i++) if (last[i]===last[i+1]) return false; return true; }
    isAlternatingWithTolerance(results, tol) { const last = results.slice(-6); let err=0; for(let i=0;i<last.length-1;i++) if(last[i]===last[i+1]) err++; return err<=tol; }
    countAlternating(results) { let c=0; for(let i=0;i<results.length-1;i++) if(results[i]!==results[i+1]) c++; return c; }
    
    runSubModel22(results, model) {
        if (results.length < model.minLength) return null;
        const last6 = results.slice(-6);
        const last8 = results.slice(-8);
        if (model.logic === 'pure' && last6.length===6 && last6[0]===last6[1] && last6[1]!==last6[2] && last6[2]===last6[3] && last6[3]!==last6[4] && last6[4]===last6[5])
            return { prediction: last6[4]==='Tài'?'Xỉu':'Tài', confidence:0.9, reason:'Cầu 2-2 chuẩn' };
        if (model.logic === 'offset' && last6.length===6 && last6[0]===last6[1] && last6[1]!==last6[2] && last6[2]!==last6[3] && last6[3]===last6[4] && last6[4]!==last6[5])
            return { prediction: last6[4]==='Tài'?'Xỉu':'Tài', confidence:0.8, reason:'Cầu 2-2 lệch' };
        if (model.logic === 'long' && last8.length===8) { let score=0; for(let i=0;i<7;i+=2) if(last8[i]===last8[i+1]) score++; if(score>=3) return { prediction: last8[7]==='Tài'?'Xỉu':'Tài', confidence:0.7+score*0.05, reason:`Cầu 2-2 dài ${score}/4` }; }
        return null;
    }
    
    runSubModelStreak(results, model) {
        const streak = this.getStreak(results);
        const last = results[results.length-1];
        const other = last==='Tài'?'Xỉu':'Tài';
        if (model.logic === 'short' && streak>=2 && streak<=3) return { prediction: last, confidence:0.7+streak*0.05, reason:`Bệt ${streak} phiên` };
        if (model.logic === 'medium' && streak>=4 && streak<=5) return { prediction: last, confidence:0.75+(streak-4)*0.05, reason:`Bệt ${streak} phiên` };
        if (model.logic === 'long' && streak>=6) return { prediction: last, confidence:0.8+Math.min(streak,10)*0.01, reason:`Bệt dài ${streak} phiên` };
        if (model.logic === 'break' && streak>=4) return { prediction: other, confidence:0.6+streak*0.03, reason:`Bệt ${streak} dự đoán gãy` };
        if (model.logic === 'super' && streak>=8) return { prediction: last, confidence:0.9, reason:`Siêu bệt ${streak} phiên` };
        return null;
    }
    
    runSubModel33(results, model) {
        if (results.length < model.minLength) return null;
        const last9 = results.slice(-9);
        const last12 = results.slice(-12);
        if (model.logic === 'pure' && last9.length===9 && last9[0]===last9[1] && last9[1]===last9[2] && last9[3]===last9[4] && last9[4]===last9[5] && last9[6]===last9[7] && last9[7]===last9[8] && last9[0]!==last9[3] && last9[3]!==last9[6])
            return { prediction: last9[6]==='Tài'?'Xỉu':'Tài', confidence:0.9, reason:'Cầu 3-3 chuẩn' };
        if (model.logic === 'short') { const last6 = results.slice(-6); if(last6[0]===last6[1] && last6[1]===last6[2] && last6[3]===last6[4] && last6[4]===last6[5]) return { prediction: last6[3]==='Tài'?'Xỉu':'Tài', confidence:0.7, reason:'Cầu 3-3 ngắn' }; }
        if (model.logic === 'long' && results.length>=15) { const last15=results.slice(-15); let pattern=[]; for(let i=0;i<15;i+=3) if(i+2<15 && last15[i]===last15[i+1] && last15[i+1]===last15[i+2]) pattern.push(last15[i]); if(pattern.length>=4 && pattern[0]!==pattern[1] && pattern[1]!==pattern[2]) return { prediction: pattern[pattern.length-1]==='Tài'?'Xỉu':'Tài', confidence:0.8, reason:'Cầu 3-3 dài hạn' }; }
        return null;
    }
    
    runSubModel212(results, model) {
        if (results.length < model.minLength) return null;
        const last5 = results.slice(-5);
        if (model.logic === 'pure' && last5.length===5 && last5[0]===last5[1] && last5[1]!==last5[2] && last5[2]!==last5[3] && last5[3]===last5[4] && last5[0]===last5[3])
            return { prediction: last5[4]==='Tài'?'Xỉu':'Tài', confidence:0.9, reason:'Cầu 2-1-2 chuẩn' };
        return null;
    }
    
    runSubModel121(results, model) {
        if (results.length < model.minLength) return null;
        const last5 = results.slice(-5);
        if (model.logic === 'pure' && last5.length===5 && last5[0]!==last5[1] && last5[1]===last5[2] && last5[2]!==last5[3] && last5[3]===last5[4] && last5[0]===last5[3])
            return { prediction: last5[4]==='Tài'?'Xỉu':'Tài', confidence:0.9, reason:'Cầu 1-2-1 chuẩn' };
        return null;
    }
    
    runSubModelBreak(results, model) {
        if (results.length < model.minLength) return null;
        const last4 = results.slice(-4);
        const last5 = results.slice(-5);
        if (model.logic === 'break11' && last4.length===4 && last4[0]!==last4[1] && last4[1]!==last4[2] && last4[2]===last4[3])
            return { prediction: last4[3], confidence:0.85, reason:'Bẻ cầu 1-1' };
        if (model.logic === 'break22' && last5.length===5 && last5[0]===last5[1] && last5[1]!==last5[2] && last5[2]===last5[3] && last5[3]!==last5[4] && last5[0]===last5[4])
            return { prediction: last5[4], confidence:0.85, reason:'Bẻ cầu 2-2' };
        if (model.logic === 'breakStreak') { const streak = this.getStreak(results.slice(0,-1)); if(streak>=3 && results[results.length-1]!==results[results.length-2]) return { prediction: results[results.length-1], confidence:0.8, reason:`Bẻ bệt sau ${streak} phiên` }; }
        return null;
    }
    
    runSubModelAdvanced(results, model) {
        if (results.length < model.minLength) return null;
        if (model.logic === 'frequency') { const freq = this.analyzeFrequency(results); if(freq.ratio>0.6) return { prediction: freq.dominant==='Tài'?'Xỉu':'Tài', confidence:0.6+freq.ratio*0.2, reason:`Tần suất ${freq.dominant} ${(freq.ratio*100).toFixed(0)}%` }; }
        if (model.logic === 'cycle') { const cycle = this.detectCycle(results); if(cycle.found) return { prediction: cycle.next, confidence:0.7, reason:`Chu kỳ ${cycle.length}` }; }
        return null;
    }
    
    runSubModel(index, history) {
        if (history.length < 3) return null;
        const results = this.getResultArray(history);
        const model = this.subModels[`sub_model_${index}`];
        if (!model) return null;
        let result = null;
        switch(model.type) {
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
            if (last3[0]!==last3[1] && last3[1]!==last3[2]) return { prediction: last3[2]==='Tài'?'Xỉu':'Tài', confidence:0.75, reason:'Cầu đẹp 1-1', model_name:mini.specialty };
        }
        if (mini.specialty === 'tinh_toan_xac_suat_cao') {
            const taiCount = results.filter(r=>r==='Tài').length;
            if (taiCount > results.length/2+2) return { prediction: 'Xỉu', confidence:0.7, reason:'Xác suất Tài cao bắt Xỉu', model_name:mini.specialty };
            if (taiCount < results.length/2-2) return { prediction: 'Tài', confidence:0.7, reason:'Xác suất Xỉu cao bắt Tài', model_name:mini.specialty };
        }
        return null;
    }
    
    analyzeBasicPatterns(history) {
        if (history.length < 3) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' };
        const results = this.getResultArray(history);
        const last = results[results.length-1];
        const other = last==='Tài'?'Xỉu':'Tài';
        const last3 = results.slice(-3);
        if (last3[0]===last3[1] && last3[1]===last3[2]) return { prediction: last, confidence:0.7, reason:'Bệt 3', pattern_type:'basic' };
        if (last3[0]!==last3[1] && last3[1]!==last3[2]) return { prediction: other, confidence:0.75, reason:'Cầu 1-1', pattern_type:'basic' };
        return { prediction: other, confidence:0.5, reason:'Đảo cầu', pattern_type:'basic' };
    }
    
    analyzeTrend(history) {
        if (history.length < 5) return { prediction: null, confidence: 0 };
        const results = this.getResultArray(history);
        const short = results.slice(-3).filter(r=>r==='Tài').length;
        const long = results.slice(-10).filter(r=>r==='Tài').length;
        if (short>=2 && long>=6) return { prediction: short>=2?'Tài':'Xỉu', confidence:0.7, reason:'Xu hướng đồng thuận' };
        if (short>=2) return { prediction: short>=2?'Tài':'Xỉu', confidence:0.6, reason:'Xu hướng ngắn' };
        if (long>=6) return { prediction: long>=6?'Tài':'Xỉu', confidence:0.6, reason:'Xu hướng dài' };
        return { prediction: results[results.length-1]==='Tài'?'Xỉu':'Tài', confidence:0.5, reason:'Không rõ đảo cầu' };
    }
    
    analyzeImbalance(history) {
        if (history.length < 12) return { prediction: null, confidence: 0 };
        const results = this.getResultArray(history.slice(-12));
        const taiCount = results.filter(r=>r==='Tài').length;
        const imbalance = Math.abs(taiCount-6)/12;
        if (imbalance > 0.3) return { prediction: taiCount>6?'Xỉu':'Tài', confidence:0.7+imbalance*0.2, reason:`Chênh lệch ${taiCount}T-${12-taiCount}X` };
        return { prediction: results[results.length-1], confidence:0.5, reason:'Cân bằng theo xu hướng' };
    }
    
    analyzeShortTerm(history) {
        if (history.length < 3) return { prediction: null, confidence: 0 };
        const results = this.getResultArray(history);
        const last3 = results.slice(-3);
        if (last3[0]===last3[1] && last3[1]===last3[2]) return { prediction: last3[0], confidence:0.75, pattern:'bệt', reason:'Bệt 3 phiên' };
        if (last3[0]!==last3[1] && last3[1]!==last3[2]) return { prediction: last3[2]==='Tài'?'Xỉu':'Tài', confidence:0.8, pattern:'xen_kẽ', reason:'Cầu xen kẽ' };
        if (last3[0]===last3[1] && last3[1]!==last3[2]) return { prediction: last3[2], confidence:0.7, pattern:'2-1', reason:'Pattern 2-1' };
        return { prediction: results[results.length-1], confidence:0.4, pattern:'không_rõ', reason:'Không rõ' };
    }
    
    analyzeDiceVolatility(history) {
        if (history.length < 5 || !history[0].Xuc_xac_1) return { prediction: null, confidence: 0 };
        const recentFaces = [];
        history.slice(-5).forEach(h => { if(h.Xuc_xac_1) recentFaces.push(h.Xuc_xac_1); if(h.Xuc_xac_2) recentFaces.push(h.Xuc_xac_2); if(h.Xuc_xac_3) recentFaces.push(h.Xuc_xac_3); });
        const freq = {1:0,2:0,3:0,4:0,5:0,6:0};
        recentFaces.forEach(f=>freq[f]++);
        const lowFaces = []; for(let f=1;f<=6;f++) if(freq[f]<2) lowFaces.push(f);
        if(lowFaces.length>=3) {
            const avg = (lowFaces[0]+lowFaces[1]+lowFaces[2])/3;
            return { prediction: avg>=11?'Tài':'Xỉu', confidence:0.6, reason:`Mặt ít về ${lowFaces.slice(0,3).join(',')}` };
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
        details.sort((a,b)=>b.confidence - a.confidence);
        if (totalWeight > 0) {
            const taiRatio = taiWeight / totalWeight;
            if (taiRatio > 0.55) return { prediction: 'Tài', confidence: taiRatio, reason: `${details.length} models đồng thuận Tài`, pattern_type: details[0]?.model || 'N/A', pattern: '', details: details.slice(0,5) };
            if (taiRatio < 0.45) return { prediction: 'Xỉu', confidence: 1-taiRatio, reason: `${details.length} models đồng thuận Xỉu`, pattern_type: details[0]?.model || 'N/A', pattern: '', details: details.slice(0,5) };
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
const WS_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = { "User-Agent": "Mozilla/5.0", "Origin": "https://play.sun.win" };
const RECONNECT_DELAY = 2500;
const PING_INTERVAL = 15000;
const INIT_MSGS = [[1,"MiniGame","GM_apivopnha","WangLin",{"info":"{\"ipAddress\":\"14.249.227.107\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiI5ODE5YW5zc3MiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMjMyODExNTEsImFmZklkIjoic3VuLndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzYzMDMyOTI4NzcwLCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjE0LjI0OS4yMjcuMTA3IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wNS5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiI4ODM4NTMzZS1kZTQzLTRiOGQtOTUwMy02MjFmNDA1MDUzNGUiLCJyZWdUaW1lIjoxNzYxNjMyMzAwNTc2LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6IkdNX2FwaXZvcG5oYSJ9.guH6ztJSPXUL1cU8QdMz8O1Sdy_SbxjSM-CDzWPTr-0\",\"locale\":\"vi\",\"userId\":\"8838533e-de43-4b8d-9503-621f4050534e\",\"username\":\"GM_apivopnha\",\"timestamp\":1763032928770,\"refreshToken\":\"e576b43a64e84f789548bfc7c4c8d1e5.7d4244a361e345908af95ee2e8ab2895\"}","signature":"45EF4B318C883862C36E1B189A1DF5465EBB60CB602BA05FAD8FCBFCD6E0DA8CB3CE65333EDD79A2BB4ABFCE326ED5525C7D971D9DEDB5A17A72764287FFE6F62CBC2DF8A04CD8EFF8D0D5AE27046947ADE45E62E644111EFDE96A74FEC635A97861A425FF2B5732D74F41176703CA10CFEED67D0745FF15EAC1065E1C8BCBFA"}],
    [6,"MiniGame","taixiuPlugin",{cmd:1005}],[6,"MiniGame","lobbyPlugin",{cmd:10001}]];
let ws = null, pingInterval = null, reconnectTimeout = null;

function connectWebSocket() {
    if (ws) { ws.removeAllListeners(); ws.close(); }
    ws = new WebSocket(WS_URL, { headers: WS_HEADERS });
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
                let correct = false;
                if (lastPrediction && lastPrediction.ket_qua) {
                    correct = (lastPrediction.ket_qua === result);
                    stats.total++; if (correct) { stats.correct++; stats.consecutiveLosses = 0; } else { stats.wrong++; stats.consecutiveLosses++; }
                    analyzer.updateModelWeights(result, lastPrediction.ket_qua, lastPrediction.do_tin_cay);
                }
                const entry = { phien: currentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: lastPrediction?.ket_qua, loai_cau: lastPrediction?.loai_cau, do_tin_cay: lastPrediction?.do_tin_cay, thoi_gian: new Date().toISOString() };
                saveHistory(entry, 'sunwin');
                const histForAnalyzer = resultHistory.map(h => ({ score: h.Tong, Ket_qua: h.Ket_qua, Xuc_xac_1: h.Xuc_xac_1, Xuc_xac_2: h.Xuc_xac_2, Xuc_xac_3: h.Xuc_xac_3 }));
                const ensemble = analyzer.ensembleModels(histForAnalyzer);
                let finalPred = ensemble.prediction, finalConf = ensemble.confidence, finalType = ensemble.pattern_type, finalPattern = ensemble.pattern;
                if (stats.consecutiveLosses >= 3) { finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài'; finalConf = 0.4; finalType = 'CHỐNG ĐẢO'; finalPattern = ''; }
                lastPrediction = { phien: currentSessionId ? parseInt(currentSessionId) + 1 : null, ket_qua: finalPred, loai_cau: finalType, mau_cau: finalPattern, do_tin_cay: (finalConf * 100).toFixed(0) + '%' };
                apiResponseData = { "Phien": currentSessionId, "Xuc_xac_1": d1, "Xuc_xac_2": d2, "Xuc_xac_3": d3, "Tong": total, "Ket_qua": result, "Phien_hien_tai": currentSessionId ? parseInt(currentSessionId)+1 : null, "Du_doan": finalPred, "Loai_cau": finalType, "Mau_cau_phat_hien": finalPattern, "Do_tin_cay": (finalConf*100).toFixed(0)+'%', "Trang_thai": finalType.includes('CHỐNG')?'Chống đảo':'Theo cầu', "Ket_qua_du_doan": correct ? '✅' : (stats.total>0?'❌':''), "Thong_ke": { "tong": stats.total, "dung": stats.correct, "sai": stats.wrong, "ti_le": stats.total>0 ? ((stats.correct/stats.total)*100).toFixed(1)+'%' : '0%' }, "id": "@tranhoang2286" };
                console.log(`🎲 Sunwin #${currentSessionId} | KQ:${result} | Dự đoán:${finalPred} (${(finalConf*100).toFixed(0)}%) | ${correct?'✅':'❌'} | TL:${stats.total>0?((stats.correct/stats.total)*100).toFixed(1):'0'}%`);
                currentSessionId = null;
            }
        } catch(e) { console.error('[❌] Lỗi:', e.message); }
    });
    ws.on('close', () => { clearInterval(pingInterval); clearTimeout(reconnectTimeout); reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY); });
    ws.on('error', (err) => { console.error('[❌] WS error:', err.message); ws.close(); });
}

// ==================== FETCH APIs ====================
async function fetchLC79(url, type) {
    try { const res = await http.get(url); if (res.data?.list && res.data.list.length) return { data: res.data.list, type }; return null; }
    catch(e) { return null; }
}
async function fetchB52() {
    try { const res = await http.get(API_B52); if (res.data?.data && res.data.data.length) return res.data.data; return null; }
    catch(e) { return null; }
}
async function fetchHitclub() {
    try { const res = await http.get(API_HITCLUB); if (res.data?.taixiu && res.data.taixiu.length) return res.data.taixiu; return null; }
    catch(e) { return null; }
}

function predictWithHistory(history, statsObj, type, isLC79 = false) {
    if (!history || history.length < 5) return { duDoan: 'Tài', doTinCay: 55, loaiCau: 'chưa_đủ', giaiThich: 'Chưa đủ dữ liệu', chiTiet: [] };
    const histForAnalyzer = history.map(h => ({ score: h.Tong || h.point || h.tong, Ket_qua: h.Ket_qua || (h.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu'), Xuc_xac_1: h.Xuc_xac_1 || h.dices?.[0], Xuc_xac_2: h.Xuc_xac_2 || h.dices?.[1], Xuc_xac_3: h.Xuc_xac_3 || h.dices?.[2] }));
    const ensemble = analyzer.ensembleModels(histForAnalyzer);
    let finalPred = ensemble.prediction, finalConf = ensemble.confidence, finalType = ensemble.pattern_type;
    if (statsObj.consecutiveLosses >= 3) { finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài'; finalConf = 0.4; finalType = 'CHỐNG ĐẢO'; }
    return { duDoan: finalPred, doTinCay: Math.round(finalConf * 100), loaiCau: finalType, giaiThich: ensemble.reason, chiTiet: ensemble.details?.slice(0,3) || [] };
}

function updateStatsForApi(statsObj, pred, actual) {
    const dung = pred === actual;
    if (dung) { statsObj.correct++; statsObj.consecutiveLosses = 0; }
    else { statsObj.wrong++; statsObj.consecutiveLosses++; }
    statsObj.total++;
    return dung;
}

// ==================== EXPRESS API ====================
app.get('/api/sunwin', (req, res) => { res.json(apiResponseData); });
app.get('/api/sunwin/history', (req, res) => { res.json({ success: true, total: resultHistory.length, data: resultHistory.slice(-30).reverse(), stats: { tong: stats.total, dung: stats.correct, sai: stats.wrong, ti_le: stats.total>0?((stats.correct/stats.total)*100).toFixed(1)+'%':'0%' } }); });
app.get('/api/sunwin/models', (req, res) => { res.json({ main:21, sub:42, mini:21, total:84 }); });

app.get('/api/lc79/tx', async (req, res) => {
    const fetchRes = await fetchLC79(API_LC79_TX, 'tx');
    if (!fetchRes) return res.status(500).json({ error: 'Lỗi LC79 TX' });
    const data = fetchRes.data;
    const cur = data[0];
    const pred = predictWithHistory(lc79History, lc79Stats, 'lc79', true);
    const historyEntry = { phien: cur.id, Xuc_xac_1: cur.dices[0], Xuc_xac_2: cur.dices[1], Xuc_xac_3: cur.dices[2], Tong: cur.point, Ket_qua: cur.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu', thoi_gian: new Date().toISOString() };
    if (!lc79History.find(h => h.phien === cur.id)) { saveHistory(historyEntry, 'lc79'); lc79History.push(historyEntry); if(lc79History.length>500) lc79History.shift(); }
    const ketQua = historyEntry.Ket_qua;
    const lastPred = lc79History[lc79History.length-2]?.du_doan;
    if (lastPred) updateStatsForApi(lc79Stats, lastPred, ketQua);
    res.json({ game: 'LC79_TX', phien: cur.id, ket_qua: ketQua, xuc_xac: `${cur.dices[0]}-${cur.dices[1]}-${cur.dices[2]}`, tong: cur.point, du_doan: { phien: cur.id+1, du_doan: pred.duDoan, ti_le: `${pred.doTinCay}%`, loai_cau: pred.loaiCau, giai_thich: pred.giaiThich }, thong_ke: { tong: lc79Stats.total, dung: lc79Stats.correct, sai: lc79Stats.wrong, ti_le: lc79Stats.total>0?((lc79Stats.correct/lc79Stats.total)*100).toFixed(1)+'%':'0%' } });
});
app.get('/api/lc79/md5', async (req, res) => {
    const fetchRes = await fetchLC79(API_LC79_MD5, 'md5');
    if (!fetchRes) return res.status(500).json({ error: 'Lỗi LC79 MD5' });
    const data = fetchRes.data;
    const cur = data[0];
    const pred = predictWithHistory(lc79History, lc79Stats, 'lc79', true);
    const historyEntry = { phien: cur.id, Xuc_xac_1: cur.dices[0], Xuc_xac_2: cur.dices[1], Xuc_xac_3: cur.dices[2], Tong: cur.point, Ket_qua: cur.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu', thoi_gian: new Date().toISOString() };
    if (!lc79History.find(h => h.phien === cur.id)) { saveHistory(historyEntry, 'lc79'); lc79History.push(historyEntry); if(lc79History.length>500) lc79History.shift(); }
    const ketQua = historyEntry.Ket_qua;
    const lastPred = lc79History[lc79History.length-2]?.du_doan;
    if (lastPred) updateStatsForApi(lc79Stats, lastPred, ketQua);
    res.json({ game: 'LC79_MD5', phien: cur.id, ket_qua: ketQua, xuc_xac: `${cur.dices[0]}-${cur.dices[1]}-${cur.dices[2]}`, tong: cur.point, du_doan: { phien: cur.id+1, du_doan: pred.duDoan, ti_le: `${pred.doTinCay}%`, loai_cau: pred.loaiCau, giai_thich: pred.giaiThich }, thong_ke: { tong: lc79Stats.total, dung: lc79Stats.correct, sai: lc79Stats.wrong, ti_le: lc79Stats.total>0?((lc79Stats.correct/lc79Stats.total)*100).toFixed(1)+'%':'0%' } });
});
app.get('/api/lc79/stats', (req, res) => { res.json({ total: lc79Stats.total, correct: lc79Stats.correct, wrong: lc79Stats.wrong, rate: lc79Stats.total>0?((lc79Stats.correct/lc79Stats.total)*100).toFixed(1)+'%':'0%' }); });

app.get('/api/b52', async (req, res) => {
    const data = await fetchB52();
    if (!data) return res.status(500).json({ error: 'Lỗi B52' });
    const cur = data[0];
    const pred = predictWithHistory(b52History, b52Stats, 'b52');
    const historyEntry = { phien: cur.Phien, Xuc_xac_1: cur.Xuc_xac_1, Xuc_xac_2: cur.Xuc_xac_2, Xuc_xac_3: cur.Xuc_xac_3, Tong: cur.Tong, Ket_qua: cur.Ket_qua, thoi_gian: new Date().toISOString() };
    if (!b52History.find(h => h.phien === cur.Phien)) { saveHistory(historyEntry, 'b52'); b52History.push(historyEntry); if(b52History.length>500) b52History.shift(); }
    const ketQua = historyEntry.Ket_qua;
    const lastPred = b52History[b52History.length-2]?.du_doan;
    if (lastPred) updateStatsForApi(b52Stats, lastPred, ketQua);
    res.json({ game: 'B52', phien: cur.Phien, ket_qua: ketQua, xuc_xac: `${cur.Xuc_xac_1}-${cur.Xuc_xac_2}-${cur.Xuc_xac_3}`, tong: cur.Tong, du_doan: { phien: cur.Phien+1, du_doan: pred.duDoan, ti_le: `${pred.doTinCay}%`, loai_cau: pred.loaiCau, giai_thich: pred.giaiThich }, thong_ke: { tong: b52Stats.total, dung: b52Stats.correct, sai: b52Stats.wrong, ti_le: b52Stats.total>0?((b52Stats.correct/b52Stats.total)*100).toFixed(1)+'%':'0%' } });
});
app.get('/api/b52/stats', (req, res) => { res.json({ total: b52Stats.total, correct: b52Stats.correct, wrong: b52Stats.wrong, rate: b52Stats.total>0?((b52Stats.correct/b52Stats.total)*100).toFixed(1)+'%':'0%' }); });

app.get('/api/hitclub', async (req, res) => {
    const data = await fetchHitclub();
    if (!data) return res.status(500).json({ error: 'Lỗi Hitclub' });
    const cur = data[0];
    const pred = predictWithHistory(hitclubHistory, hitclubStats, 'hitclub');
    const historyEntry = { phien: cur.Phien, Xuc_xac_1: cur.Xuc_xac_1, Xuc_xac_2: cur.Xuc_xac_2, Xuc_xac_3: cur.Xuc_xac_3, Tong: cur.Tong, Ket_qua: cur.Ket_qua, thoi_gian: new Date().toISOString() };
    if (!hitclubHistory.find(h => h.phien === cur.Phien)) { saveHistory(historyEntry, 'hitclub'); hitclubHistory.push(historyEntry); if(hitclubHistory.length>500) hitclubHistory.shift(); }
    const ketQua = historyEntry.Ket_qua;
    const lastPred = hitclubHistory[hitclubHistory.length-2]?.du_doan;
    if (lastPred) updateStatsForApi(hitclubStats, lastPred, ketQua);
    res.json({ game: 'HITCLUB', phien: cur.Phien, ket_qua: ketQua, xuc_xac: `${cur.Xuc_xac_1}-${cur.Xuc_xac_2}-${cur.Xuc_xac_3}`, tong: cur.Tong, du_doan: { phien: cur.Phien+1, du_doan: pred.duDoan, ti_le: `${pred.doTinCay}%`, loai_cau: pred.loaiCau, giai_thich: pred.giaiThich }, thong_ke: { tong: hitclubStats.total, dung: hitclubStats.correct, sai: hitclubStats.wrong, ti_le: hitclubStats.total>0?((hitclubStats.correct/hitclubStats.total)*100).toFixed(1)+'%':'0%' } });
});
app.get('/api/hitclub/stats', (req, res) => { res.json({ total: hitclubStats.total, correct: hitclubStats.correct, wrong: hitclubStats.wrong, rate: hitclubStats.total>0?((hitclubStats.correct/hitclubStats.total)*100).toFixed(1)+'%':'0%' }); });

app.get('/api/all', async (req, res) => {
    const [tx, md5, b52, hitclub] = await Promise.all([fetchLC79(API_LC79_TX,'tx'), fetchLC79(API_LC79_MD5,'md5'), fetchB52(), fetchHitclub()]);
    res.json({
        sunwin: apiResponseData,
        lc79_tx: tx ? { phien: tx.data[0]?.id, ket_qua: tx.data[0]?.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu' } : null,
        lc79_md5: md5 ? { phien: md5.data[0]?.id, ket_qua: md5.data[0]?.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu' } : null,
        b52: b52 ? { phien: b52[0]?.Phien, ket_qua: b52[0]?.Ket_qua } : null,
        hitclub: hitclub ? { phien: hitclub[0]?.Phien, ket_qua: hitclub[0]?.Ket_qua } : null,
        timestamp: new Date().toISOString()
    });
});
app.get('/api/all/stats', (req, res) => {
    res.json({
        sunwin: { tong: stats.total, dung: stats.correct, sai: stats.wrong, ti_le: stats.total>0?((stats.correct/stats.total)*100).toFixed(1)+'%':'0%' },
        lc79: { tong: lc79Stats.total, dung: lc79Stats.correct, sai: lc79Stats.wrong, ti_le: lc79Stats.total>0?((lc79Stats.correct/lc79Stats.total)*100).toFixed(1)+'%':'0%' },
        b52: { tong: b52Stats.total, dung: b52Stats.correct, sai: b52Stats.wrong, ti_le: b52Stats.total>0?((b52Stats.correct/b52Stats.total)*100).toFixed(1)+'%':'0%' },
        hitclub: { tong: hitclubStats.total, dung: hitclubStats.correct, sai: hitclubStats.wrong, ti_le: hitclubStats.total>0?((hitclubStats.correct/hitclubStats.total)*100).toFixed(1)+'%':'0%' }
    });
});
app.get('/api/models', (req, res) => { res.json({ main:21, sub:42, mini:21, total:84 }); });
app.get('/', (req, res) => { res.json({ name: '🎲 API TÀI XỈU ALL GAMES', author: '@tranhoang2286', endpoints: { sunwin:'/api/sunwin', lc79_tx:'/api/lc79/tx', lc79_md5:'/api/lc79/md5', b52:'/api/b52', hitclub:'/api/hitclub', all:'/api/all', stats:'/api/all/stats' } }); });

connectWebSocket();
app.listen(PORT, () => console.log(`[🌐] Server running at http://localhost:${PORT}\n✅ /api/sunwin\n✅ /api/lc79/tx\n✅ /api/lc79/md5\n✅ /api/b52\n✅ /api/hitclub\n✅ /api/all\n✅ /api/all/stats`));
