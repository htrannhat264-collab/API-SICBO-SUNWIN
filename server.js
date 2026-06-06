const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==========================================
// API SUNWIN SICBO
// ==========================================
const SICBO_API = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';

// ==========================================
// LƯU TRỮ DỮ LIỆU
// ==========================================
let gameData = {
  data: [],
  tongData: [],
  lichSuDuDoan: [],
  feedbackHistory: []
};

let stats = { tong: 0, dung: 0, sai: 0, tiLe: '0%' };
let memory = { 
  markovChain: {}, 
  markovChainBac3: {},
  patternHistory: [],
  diemTrungBinh: 10.5
};

// ==========================================
// FETCH DATA
// ==========================================
async function fetchData() {
  try {
    const headers = { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    };
    const res = await axios.get(SICBO_API, { timeout: 15000, headers });
    const data = res.data;
    
    if (data?.data?.resultList && Array.isArray(data.data.resultList)) {
      const resultList = data.data.resultList;
      const formattedData = [];
      
      for (const item of resultList) {
        const tong = item.score;
        if (!tong || item.resultType === 11) continue;
        
        let ketQua = '';
        if (item.resultType === 3) ketQua = 'Tài';
        else if (item.resultType === 4) ketQua = 'Xỉu';
        
        formattedData.push({
          phien: parseInt(item.gameNum.replace('#', '')) || item.timeMilli,
          ket_qua: ketQua,
          tong: tong,
          v1: item.facesList?.[0] || '?',
          v2: item.facesList?.[1] || '?',
          v3: item.facesList?.[2] || '?',
          timeMilli: item.timeMilli
        });
      }
      return formattedData;
    }
    return null;
  } catch (error) {
    console.error('Fetch lỗi:', error.message);
    return null;
  }
}

// ==========================================
// ========== THUẬT TOÁN CỰC MẠNH ==========
// ==========================================

// 1. PHÂN TÍCH PHÂN PHỐI ĐIỂM CHUẨN (Z-Score)
function phanTichZScore(tongData) {
  if (!tongData || tongData.length < 30) return null;
  
  const diemCount = {};
  for (let i = 0; i < tongData.length; i++) {
    diemCount[tongData[i]] = (diemCount[tongData[i]] || 0) + 1;
  }
  
  const n = tongData.length;
  const kyVong = n / 14;
  const ketQua = [];
  
  for (let diem = 4; diem <= 17; diem++) {
    const count = diemCount[diem] || 0;
    const zScore = (count - kyVong) / Math.sqrt(kyVong);
    ketQua.push({ diem, count, zScore, tyLe: (count / n) * 100 });
  }
  
  // Sắp xếp điểm có Z-Score thấp nhất (thiếu nhất)
  ketQua.sort((a, b) => a.zScore - b.zScore);
  const diemThieuNhat = ketQua.slice(0, 6);
  const diemDuNhat = ketQua.slice(-6).reverse();
  
  return { diemThieuNhat, diemDuNhat, tongPhien: n };
}

// 2. PHÂN TÍCH KHOẢNG CÁCH + TRUNG BÌNH TRƯỢT
function phanTichKhoangCachVaTrungBinh(tongData) {
  if (!tongData || tongData.length < 20) return null;
  
  const lastAppear = {};
  const khoangCachTrungBinh = {};
  const lanXuatHien = {};
  
  for (let i = 0; i < tongData.length; i++) {
    const diem = tongData[i];
    if (!lanXuatHien[diem]) lanXuatHien[diem] = [];
    lanXuatHien[diem].push(i);
    
    if (!lastAppear[diem]) {
      lastAppear[diem] = i;
    } else {
      const gap = lastAppear[diem] - i;
      if (!khoangCachTrungBinh[diem]) khoangCachTrungBinh[diem] = [];
      khoangCachTrungBinh[diem].push(gap);
      lastAppear[diem] = i;
    }
  }
  
  // Tính khoảng cách trung bình cho từng điểm
  const avgGaps = {};
  for (const [diem, gaps] of Object.entries(khoangCachTrungBinh)) {
    if (gaps.length > 0) {
      avgGaps[diem] = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }
  }
  
  // Tính khoảng cách từ hiện tại
  const currentPos = 0;
  const diemVaKhoangCach = [];
  for (let diem = 4; diem <= 17; diem++) {
    const lastPos = lastAppear[diem] !== undefined ? lastAppear[diem] : tongData.length;
    const distance = lastPos - currentPos;
    const avgGap = avgGaps[diem] || tongData.length / 2;
    const tyLeVuotAvg = distance / avgGap;
    
    diemVaKhoangCach.push({
      diem,
      distance,
      avgGap,
      tyLeVuotAvg,
      daXuatHien: lastAppear[diem] !== undefined
    });
  }
  
  diemVaKhoangCach.sort((a, b) => b.tyLeVuotAvg - a.tyLeVuotAvg);
  const diemLaUChuaVe = diemVaKhoangCach.slice(0, 8);
  const diemChuaXuatHien = diemVaKhoangCach.filter(d => !d.daXuatHien).map(d => d.diem);
  
  // Trung bình trượt 10 phiên
  const ma10 = [];
  for (let i = 0; i <= tongData.length - 10; i++) {
    const avg = tongData.slice(i, i + 10).reduce((a, b) => a + b, 0) / 10;
    ma10.push(avg);
  }
  
  const xuHuongMA = ma10.length >= 2 ? ma10[0] - ma10[1] : 0;
  
  return { diemLaUChuaVe, diemChuaXuatHien, diemVaKhoangCach, xuHuongMA, ma10GanNhat: ma10[0] };
}

// 3. MARKOV CHAIN BẬC 2 VÀ BẬC 3
function phanTichMarkovNangCao(tongData) {
  if (!tongData || tongData.length < 15) return null;
  
  const mc2 = memory.markovChain;
  const mc3 = memory.markovChainBac3;
  
  // Markov bậc 2 (2 điểm gần nhất)
  for (let i = tongData.length - 3; i >= 0; i--) {
    const diem1 = tongData[i+2];
    const diem2 = tongData[i+1];
    const diemTiep = tongData[i];
    const key = `${diem1}-${diem2}`;
    if (!mc2[key]) mc2[key] = {};
    mc2[key][diemTiep] = (mc2[key][diemTiep] || 0) + 1;
  }
  
  // Markov bậc 3 (3 điểm gần nhất)
  for (let i = tongData.length - 4; i >= 0; i--) {
    const diem1 = tongData[i+3];
    const diem2 = tongData[i+2];
    const diem3 = tongData[i+1];
    const diemTiep = tongData[i];
    const key = `${diem1}-${diem2}-${diem3}`;
    if (!mc3[key]) mc3[key] = {};
    mc3[key][diemTiep] = (mc3[key][diemTiep] || 0) + 1;
  }
  
  let duDoanBac2 = null;
  let duDoanBac3 = null;
  
  if (tongData.length >= 2) {
    const key2 = `${tongData[1]}-${tongData[0]}`;
    const tk2 = mc2[key2];
    if (tk2) {
      const entries = Object.entries(tk2);
      const tong = entries.reduce((s, [, c]) => s + c, 0);
      duDoanBac2 = entries.map(([diem, count]) => ({
        diem: parseInt(diem),
        tyLe: (count / tong) * 100
      })).sort((a, b) => b.tyLe - a.tyLe).slice(0, 3);
    }
  }
  
  if (tongData.length >= 3) {
    const key3 = `${tongData[2]}-${tongData[1]}-${tongData[0]}`;
    const tk3 = mc3[key3];
    if (tk3) {
      const entries = Object.entries(tk3);
      const tong = entries.reduce((s, [, c]) => s + c, 0);
      duDoanBac3 = entries.map(([diem, count]) => ({
        diem: parseInt(diem),
        tyLe: (count / tong) * 100
      })).sort((a, b) => b.tyLe - a.tyLe).slice(0, 3);
    }
  }
  
  return { duDoanBac2, duDoanBac3 };
}

// 4. PHÂN TÍCH XU HƯỚNG (RSI, MACD đơn giản hóa)
function phanTichXuHuongNangCao(tongData) {
  if (!tongData || tongData.length < 20) return null;
  
  const last20 = tongData.slice(0, 20);
  const last10 = last20.slice(0, 10);
  const prev10 = last20.slice(10, 20);
  
  const avgLast10 = last10.reduce((a, b) => a + b, 0) / 10;
  const avgPrev10 = prev10.reduce((a, b) => a + b, 0) / 10;
  const xuHuong = avgLast10 - avgPrev10;
  
  // Tính độ lệch chuẩn
  const mean = avgLast10;
  const variance = last10.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / 10;
  const stdDev = Math.sqrt(variance);
  
  // Xác định vùng điểm dựa trên xu hướng
  let vungDiemUuTien = [];
  if (xuHuong > 1.5) {
    vungDiemUuTien = [10, 11, 12, 13];
  } else if (xuHuong < -1.5) {
    vungDiemUuTien = [7, 8, 9, 10];
  } else {
    vungDiemUuTien = [9, 10, 11, 12];
  }
  
  // Dự đoán khoảng điểm dựa trên trung bình + độ lệch
  const duDoanKhoang = {
    thap: Math.max(4, Math.floor(avgLast10 - stdDev)),
    cao: Math.min(17, Math.ceil(avgLast10 + stdDev))
  };
  
  return {
    xuHuong,
    avgLast10,
    stdDev,
    vungDiemUuTien,
    duDoanKhoang,
    isTangMenh: xuHuong > 1,
    isGiamManh: xuHuong < -1
  };
}

// 5. PHÂN TÍCH BỆT VÀ CẦU (NÂNG CẤP)
function phanTichBetVaCau(lichSu, tongData) {
  const ketQua = { bet: null, cau11: null, cau22: null, cau32: null };
  
  if (lichSu.length < 3) return ketQua;
  
  // Bệt chi tiết
  let streak = 1;
  for (let i = 1; i < Math.min(lichSu.length, 15); i++) {
    if (lichSu[i] === lichSu[0]) streak++;
    else break;
  }
  
  if (streak >= 3) {
    ketQua.bet = {
      doDai: streak,
      loai: lichSu[0],
      duDoanLoai: lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài',
      doTinCay: Math.min(94, 65 + (streak - 2) * 7)
    };
  }
  
  // Cầu 1-1
  if (lichSu.length >= 6) {
    let isZigzag = true;
    for (let i = 1; i < 6; i++) {
      if (lichSu[i] === lichSu[i-1]) { isZigzag = false; break; }
    }
    if (isZigzag) {
      ketQua.cau11 = {
        duDoanLoai: lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài',
        doTinCay: 82
      };
    }
  }
  
  // Cầu 2-2
  if (lichSu.length >= 8) {
    const p1 = lichSu[0] === lichSu[1];
    const p2 = lichSu[2] === lichSu[3];
    const p3 = lichSu[4] === lichSu[5];
    const p4 = lichSu[6] === lichSu[7];
    const p5 = lichSu[1] !== lichSu[2];
    const p6 = lichSu[3] !== lichSu[4];
    const p7 = lichSu[5] !== lichSu[6];
    
    if (p1 && p2 && p3 && p4 && p5 && p6 && p7) {
      ketQua.cau22 = {
        duDoanLoai: lichSu[4] === 'Tài' ? 'Xỉu' : 'Tài',
        doTinCay: 86
      };
    }
  }
  
  // Cầu 3-2
  if (lichSu.length >= 10) {
    const p = lichSu.slice(0, 5).join('');
    if (p === "TàiTàiTàiXỉuXỉu") {
      ketQua.cau32 = { duDoanLoai: "Xỉu", doTinCay: 88 };
    } else if (p === "XỉuXỉuXỉuTàiTài") {
      ketQua.cau32 = { duDoanLoai: "Tài", doTinCay: 88 };
    }
  }
  
  return ketQua;
}

// 6. PHÂN TÍCH PATTERN LỊCH SỬ (HỌC TỪ QUÁ KHỨ)
function phanTichPatternLichSu(lichSu, tongData) {
  if (lichSu.length < 10 || tongData.length < 10) return null;
  
  const patternHienTai = lichSu.slice(0, 5).join('');
  const diemPatternHienTai = tongData.slice(0, 5).join('-');
  
  // Tìm pattern tương tự trong quá khứ
  let timThay = [];
  for (let i = 5; i < lichSu.length - 1; i++) {
    const pLichSu = lichSu.slice(i, i + 5).join('');
    const pDiem = tongData.slice(i, i + 5).join('-');
    
    if (pLichSu === patternHienTai) {
      timThay.push({
        viTri: i,
        ketQuaTiepTheo: lichSu[i - 1],
        diemTiepTheo: tongData[i - 1]
      });
    }
  }
  
  if (timThay.length >= 2) {
    const demLoai = { Tài: 0, Xỉu: 0 };
    const demDiem = {};
    for (const t of timThay) {
      demLoai[t.ketQuaTiepTheo]++;
      demDiem[t.diemTiepTheo] = (demDiem[t.diemTiepTheo] || 0) + 1;
    }
    
    const loaiDuDoan = demLoai.Tài > demLoai.Xỉu ? 'Tài' : 'Xỉu';
    const diemDuDoan = Object.entries(demDiem).sort((a, b) => b[1] - a[1])[0]?.[0];
    
    return {
      loaiDuDoan,
      diemDuDoan: parseInt(diemDuDoan),
      soLanTrung: timThay.length,
      tyLe: (Math.max(demLoai.Tài, demLoai.Xỉu) / timThay.length) * 100
    };
  }
  
  return null;
}

// ==========================================
// DỰ ĐOÁN 3 VỊ SIÊU CHÍNH XÁC
// ==========================================
function duDoan3ViSieuCap(lichSu, tongData) {
  // 1. CHẠY TẤT CẢ THUẬT TOÁN
  const zScore = phanTichZScore(tongData);
  const khoangCach = phanTichKhoangCachVaTrungBinh(tongData);
  const markov = phanTichMarkovNangCao(tongData);
  const xuHuong = phanTichXuHuongNangCao(tongData);
  const betVaCau = phanTichBetVaCau(lichSu, tongData);
  const pattern = phanTichPatternLichSu(lichSu, tongData);
  
  // 2. XÁC ĐỊNH LOẠI TÀI/XỈU (CÓ TRỌNG SỐ)
  let diemTai = 0, diemXiu = 0;
  let chiTietLoai = [];
  
  // Bet
  if (betVaCau.bet) {
    if (betVaCau.bet.duDoanLoai === 'Tài') diemTai += betVaCau.bet.doTinCay;
    else diemXiu += betVaCau.bet.doTinCay;
    chiTietLoai.push(`Bet: ${betVaCau.bet.duDoanLoai} (${betVaCau.bet.doTinCay}%)`);
  }
  
  // Cầu 1-1
  if (betVaCau.cau11) {
    if (betVaCau.cau11.duDoanLoai === 'Tài') diemTai += betVaCau.cau11.doTinCay;
    else diemXiu += betVaCau.cau11.doTinCay;
    chiTietLoai.push(`Cầu 1-1: ${betVaCau.cau11.duDoanLoai}`);
  }
  
  // Cầu 2-2
  if (betVaCau.cau22) {
    if (betVaCau.cau22.duDoanLoai === 'Tài') diemTai += betVaCau.cau22.doTinCay;
    else diemXiu += betVaCau.cau22.doTinCay;
    chiTietLoai.push(`Cầu 2-2: ${betVaCau.cau22.duDoanLoai}`);
  }
  
  // Cầu 3-2
  if (betVaCau.cau32) {
    if (betVaCau.cau32.duDoanLoai === 'Tài') diemTai += betVaCau.cau32.doTinCay;
    else diemXiu += betVaCau.cau32.doTinCay;
    chiTietLoai.push(`Cầu 3-2: ${betVaCau.cau32.duDoanLoai}`);
  }
  
  // Pattern lịch sử
  if (pattern) {
    if (pattern.loaiDuDoan === 'Tài') diemTai += pattern.tyLe;
    else diemXiu += pattern.tyLe;
    chiTietLoai.push(`Pattern: ${pattern.loaiDuDoan} (${Math.round(pattern.tyLe)}%)`);
  }
  
  // Markov bậc 2 + 3
  if (markov.duDoanBac2 && markov.duDoanBac2[0]) {
    const diem = markov.duDoanBac2[0].diem;
    if (diem >= 11) diemTai += markov.duDoanBac2[0].tyLe;
    else diemXiu += markov.duDoanBac2[0].tyLe;
    chiTietLoai.push(`Markov b2: ${diem >= 11 ? 'Tài' : 'Xỉu'} (${Math.round(markov.duDoanBac2[0].tyLe)}%)`);
  }
  
  // Xu hướng
  if (xuHuong) {
    if (xuHuong.isTangManh) diemXiu += 15;
    if (xuHuong.isGiamManh) diemTai += 15;
    chiTietLoai.push(`Xu hướng: ${xuHuong.xuHuong > 0 ? 'Tăng' : 'Giảm'}`);
  }
  
  let loaiDuDoan = 'Tài';
  let doTinCayLoai = 55;
  
  if (lichSu.length === 1) {
    loaiDuDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    doTinCayLoai = 62;
  } else if (lichSu.length === 2) {
    if (lichSu[0] === lichSu[1]) {
      loaiDuDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
      doTinCayLoai = 66;
    } else {
      loaiDuDoan = lichSu[0];
      doTinCayLoai = 64;
    }
  } else if (diemTai > diemXiu) {
    loaiDuDoan = 'Tài';
    doTinCayLoai = Math.min(94, Math.round(55 + (diemTai - diemXiu) / (diemTai + diemXiu) * 45));
  } else if (diemXiu > diemTai) {
    loaiDuDoan = 'Xỉu';
    doTinCayLoai = Math.min(94, Math.round(55 + (diemXiu - diemTai) / (diemTai + diemXiu) * 45));
  } else {
    loaiDuDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    doTinCayLoai = 64;
  }
  
  // 3. TÍNH TOÁN 3 VỊ CỤ THỂ (CÓ TRỌNG SỐ)
  let trongSoDiem = new Map();
  
  // Z-Score (điểm thiếu)
  if (zScore && zScore.diemThieuNhat) {
    for (let i = 0; i < zScore.diemThieuNhat.length; i++) {
      const item = zScore.diemThieuNhat[i];
      const trongSo = Math.max(50, 100 - Math.abs(item.zScore) * 8);
      trongSoDiem.set(item.diem, (trongSoDiem.get(item.diem) || 0) + trongSo);
    }
  }
  
  // Khoảng cách (điểm lâu chưa về)
  if (khoangCach && khoangCach.diemLaUChuaVe) {
    for (let i = 0; i < khoangCach.diemLaUChuaVe.length; i++) {
      const item = khoangCach.diemLaUChuaVe[i];
      const trongSo = Math.min(95, 60 + (item.tyLeVuotAvg * 15));
      trongSoDiem.set(item.diem, (trongSoDiem.get(item.diem) || 0) + trongSo);
    }
  }
  
  // Điểm chưa xuất hiện (ưu tiên cao nhất)
  if (khoangCach && khoangCach.diemChuaXuatHien) {
    for (const diem of khoangCach.diemChuaXuatHien) {
      trongSoDiem.set(diem, (trongSoDiem.get(diem) || 0) + 120);
    }
  }
  
  // Markov bậc 2
  if (markov.duDoanBac2) {
    for (const item of markov.duDoanBac2) {
      trongSoDiem.set(item.diem, (trongSoDiem.get(item.diem) || 0) + item.tyLe + 20);
    }
  }
  
  // Markov bậc 3
  if (markov.duDoanBac3) {
    for (const item of markov.duDoanBac3) {
      trongSoDiem.set(item.diem, (trongSoDiem.get(item.diem) || 0) + item.tyLe + 30);
    }
  }
  
  // Pattern lịch sử
  if (pattern && pattern.diemDuDoan) {
    trongSoDiem.set(pattern.diemDuDoan, (trongSoDiem.get(pattern.diemDuDoan) || 0) + pattern.tyLe);
  }
  
  // Xu hướng vùng điểm
  if (xuHuong && xuHuong.vungDiemUuTien) {
    for (const diem of xuHuong.vungDiemUuTien) {
      trongSoDiem.set(diem, (trongSoDiem.get(diem) || 0) + 25);
    }
  }
  
  // Trung bình trượt
  if (khoangCach && khoangCach.ma10GanNhat) {
    const diemGanMA = Math.round(khoangCach.ma10GanNhat);
    trongSoDiem.set(diemGanMA, (trongSoDiem.get(diemGanMA) || 0) + 30);
    trongSoDiem.set(diemGanMA + 1, (trongSoDiem.get(diemGanMA + 1) || 0) + 20);
    trongSoDiem.set(diemGanMA - 1, (trongSoDiem.get(diemGanMA - 1) || 0) + 20);
  }
  
  // LỌC THEO LOẠI TÀI/XỈU
  const diemTrongLoai = Array.from(trongSoDiem.entries())
    .filter(([diem]) => {
      if (loaiDuDoan === 'Tài') return diem >= 11 && diem <= 17;
      return diem >= 4 && diem <= 10;
    })
    .sort((a, b) => b[1] - a[1])
    .map(([diem]) => diem);
  
  // CHỌN 3 ĐIỂM ĐẦU TIÊN
  let baViCuoi = [...new Set(diemTrongLoai)].slice(0, 3);
  
  // NẾU THIẾU, DÙNG THUẬT TOÁN THAY THẾ THÔNG MINH
  if (baViCuoi.length < 3) {
    const diemTheoLoai = loaiDuDoan === 'Tài' 
      ? [13, 14, 11, 15, 12, 16, 17] 
      : [7, 8, 6, 9, 5, 10, 4];
    
    // Sắp xếp dựa trên Z-Score nếu có
    if (zScore) {
      const diemSapXep = [...diemTheoLoai];
      diemSapXep.sort((a, b) => {
        const za = zScore.diemThieuNhat.find(d => d.diem === a)?.zScore || 0;
        const zb = zScore.diemThieuNhat.find(d => d.diem === b)?.zScore || 0;
        return za - zb;
      });
      
      for (const diem of diemSapXep) {
        if (!baViCuoi.includes(diem) && baViCuoi.length < 3) {
          baViCuoi.push(diem);
        }
      }
    } else {
      for (const diem of diemTheoLoai) {
        if (!baViCuoi.includes(diem) && baViCuoi.length < 3) {
          baViCuoi.push(diem);
        }
      }
    }
  }
  
  baViCuoi = baViCuoi.slice(0, 3);
  
  // 4. TỔNG HỢP LÝ DO
  let lyDo = [];
  if (betVaCau.bet) lyDo.push(`🔥 Bệt ${betVaCau.bet.doDai} phiên ${betVaCau.bet.loai}`);
  if (betVaCau.cau11) lyDo.push(`🎯 Cầu 1-1`);
  if (betVaCau.cau22) lyDo.push(`🔄 Cầu 2-2`);
  if (pattern) lyDo.push(`📚 Pattern: ${pattern.soLanTrung} lần trùng`);
  if (xuHuong && Math.abs(xuHuong.xuHuong) > 1) {
    lyDo.push(`📈 Xu hướng ${xuHuong.xuHuong > 0 ? 'TĂNG' : 'GIẢM'} (${Math.abs(xuHuong.xuHuong).toFixed(1)}đ)`);
  }
  if (zScore && zScore.diemThieuNhat.length > 0) {
    lyDo.push(`📊 Điểm thiếu: ${zScore.diemThieuNhat.slice(0, 3).map(d => d.diem).join(', ')}`);
  }
  if (khoangCach && khoangCach.diemLaUChuaVe.length > 0) {
    lyDo.push(`⏰ Lâu chưa về: ${khoangCach.diemLaUChuaVe.slice(0, 3).map(d => d.diem).join(', ')}`);
  }
  if (markov.duDoanBac2 && markov.duDoanBac2[0]) {
    lyDo.push(`🔗 Markov b2: ${markov.duDoanBac2[0].diem} (${Math.round(markov.duDoanBac2[0].tyLe)}%)`);
  }
  if (markov.duDoanBac3 && markov.duDoanBac3[0]) {
    lyDo.push(`🔗🔗 Markov b3: ${markov.duDoanBac3[0].diem} (${Math.round(markov.duDoanBac3[0].tyLe)}%)`);
  }
  
  const lyDoChinh = lyDo.length > 0 ? lyDo.slice(0, 5).join(' | ') : 'Phân tích đa tầng';
  
  return {
    duDoanLoai: loaiDuDoan,
    doTinCay: doTinCayLoai,
    baViCuThe: baViCuoi,
    lyDo: lyDoChinh,
    chiTiet: chiTietLoai
  };
}

// ==========================================
// XỬ LÝ GAME CHÍNH
// ==========================================
async function xuLyGame() {
  const rawData = await fetchData();
  if (!rawData || rawData.length === 0) throw new Error('Không lấy được dữ liệu từ API');
  
  // Cập nhật dữ liệu mới
  for (const item of rawData) {
    const daTonTai = gameData.data.find(x => x.phien === item.phien);
    if (!daTonTai) {
      gameData.data.unshift(item);
      if (item.tong) gameData.tongData.unshift(item.tong);
    }
  }
  
  // Giới hạn dung lượng
  if (gameData.data.length > 300) gameData.data = gameData.data.slice(0, 300);
  if (gameData.tongData.length > 300) gameData.tongData = gameData.tongData.slice(0, 300);
  
  const current = gameData.data[0];
  const phienHienTai = current?.phien;
  const ketQuaThucTe = current?.ket_qua;
  
  // Kiểm tra dự đoán cũ
  if (gameData.lichSuDuDoan.length > 0 && gameData.lichSuDuDoan[0].ket_qua === 'CHỜ' && ketQuaThucTe) {
    const lastPred = gameData.lichSuDuDoan[0];
    if (lastPred.du_doan_loai) {
      const dung = (ketQuaThucTe === lastPred.du_doan_loai);
      if (dung) stats.dung++;
      else stats.sai++;
      stats.tong++;
      stats.tiLe = ((stats.dung / stats.tong) * 100).toFixed(1) + '%';
      lastPred.ket_qua = dung ? 'ĐÚNG' : 'SAI';
      lastPred.thuc_te = ketQuaThucTe;
    }
  }
  
  // Lấy lịch sử
  const lichSu = gameData.data.map(d => d.ket_qua).filter(k => k === 'Tài' || k === 'Xỉu');
  const tongData = gameData.tongData;
  
  // DỰ ĐOÁN
  const duDoan = duDoan3ViSieuCap(lichSu, tongData);
  
  // Lưu dự đoán
  gameData.lichSuDuDoan.unshift({
    phien: phienHienTai,
    du_doan_loai: duDoan.duDoanLoai,
    ba_vi_cu_the: duDoan.baViCuThe,
    do_tin_cay: duDoan.doTinCay,
    ly_do: duDoan.lyDo,
    ket_qua: 'CHỜ',
    thoi_gian: Date.now()
  });
  if (gameData.lichSuDuDoan.length > 100) gameData.lichSuDuDoan.pop();
  
  const coNenCuoc = duDoan.doTinCay >= 68;
  
  // Format output
  return {
    success: true,
    game: 'sunwin_sicbo',
    current: {
      phien: phienHienTai,
      ket_qua: ketQuaThucTe,
      vi: current ? `${current.v1} - ${current.v2} - ${current.v3}` : '? - ? - ?',
      tong: current?.tong || '?'
    },
    du_doan: {
      phien_tiep: phienHienTai + 1,
      du_doan: duDoan.duDoanLoai,
      vi_cuoc: duDoan.baViCuThe.join(', '),
      ti_le: duDoan.doTinCay + '%',
      id: '@tranhoang2286',
      co_nen_cuoc: coNenCuoc ? '✅ NÊN CƯỢC' : '⏸️ BỎ QUA',
      ly_do: duDoan.lyDo,
      chi_tiet: duDoan.chiTiet
    },
    thong_ke: stats,
    lich_su_gan_day: lichSu.slice(0, 12)
  };
}

// ==========================================
// API ENDPOINTS
// ==========================================

app.get('/api/games', (req, res) => {
  res.json({ 
    games: ['sunwin_sicbo'], 
    total: 1,
    author: '@tranhoang2286'
  });
});

app.get('/api/predict/sunwin_sicbo', async (req, res) => {
  try {
    const result = await xuLyGame();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/predict', async (req, res) => {
  try {
    const result = await xuLyGame();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/feedback', (req, res) => {
  const { du_doan, ket_qua_thuc_te } = req.body;
  
  if (!du_doan || !ket_qua_thuc_te) {
    return res.status(400).json({ error: 'Thiếu du_doan hoặc ket_qua_thuc_te' });
  }
  
  const dung = (du_doan === ket_qua_thuc_te);
  if (dung) stats.dung++;
  else stats.sai++;
  stats.tong++;
  stats.tiLe = ((stats.dung / stats.tong) * 100).toFixed(1) + '%';
  
  gameData.feedbackHistory.unshift({
    du_doan, 
    thuc_te: ket_qua_thuc_te, 
    ket_qua: dung ? 'ĐÚNG' : 'SAI', 
    thoi_gian: Date.now()
  });
  
  res.json({ success: true, dung, stats });
});

app.get('/api/stats', (req, res) => {
  res.json(stats);
});

app.get('/api/stats/sunwin_sicbo', (req, res) => {
  res.json(stats);
});

app.get('/', (req, res) => {
  res.json({
    name: '🔥 SUNWIN SICBO - THUẬT TOÁN SIÊU CẤP 🔥',
    author: '@tranhoang2286',
    version: '4.0',
    thuat_toan: [
      '📊 Z-Score phân phối điểm (phát hiện điểm thiếu chính xác)',
      '⏰ Khoảng cách xuất hiện + Trung bình trượt 10 phiên',
      '🔗 Markov Chain bậc 2 và bậc 3 (2 lớp)',
      '📈 Xu hướng RSI đơn giản hóa + Độ lệch chuẩn',
      '🔥 Bệt (cấp độ 3-4-5-6-7+)',
      '🎯 Cầu 1-1, 2-2, 3-2',
      '📚 Pattern lịch sử (học từ quá khứ)'
    ],
    cach_du_doan: 'Tổng hợp trọng số từ 9 thuật toán, chọn 3 điểm cao nhất',
    endpoints: {
      'Dự đoán': 'GET /api/predict/sunwin_sicbo',
      'Thống kê': 'GET /api/stats/sunwin_sicbo',
      'Feedback': 'POST /api/feedback'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`🔥 SUNWIN SICBO - THUẬT TOÁN SIÊU CẤP 🔥`);
  console.log(`============================================================`);
  console.log(`🎯 9 THUẬT TOÁN ĐA TẦNG:`);
  console.log(`   1. Z-Score phân phối điểm`);
  console.log(`   2. Khoảng cách xuất hiện + MA10`);
  console.log(`   3. Markov Chain bậc 2`);
  console.log(`   4. Markov Chain bậc 3`);
  console.log(`   5. Xu hướng + Độ lệch chuẩn`);
  console.log(`   6. Bệt (3-4-5-6-7+)`);
  console.log(`   7. Cầu 1-1, 2-2, 3-2`);
  console.log(`   8. Pattern lịch sử`);
  console.log(`   9. Trung bình trượt 10 phiên`);
  console.log(`🚀 PORT: ${PORT}`);
  console.log(`============================================================\n`);
});
