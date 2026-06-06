const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// API SUNWIN SICBO
const SICBO_API = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';

// LƯU TRỮ
let gameData = { data: [], tongData: [], lichSuDuDoan: [] };
let stats = { tong: 0, dung: 0, sai: 0, tiLe: '0%' };
let memory = {};

// FETCH DATA
async function fetchData() {
  try {
    const res = await axios.get(SICBO_API, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = res.data;
    if (!data?.data?.resultList) return null;
    
    return data.data.resultList.filter(item => item.score && item.resultType !== 11).map(item => ({
      phien: parseInt(item.gameNum.replace('#', '')) || item.timeMilli,
      ket_qua: item.resultType === 3 ? 'Tài' : 'Xỉu',
      tong: item.score,
      v1: item.facesList?.[0] || '?',
      v2: item.facesList?.[1] || '?',
      v3: item.facesList?.[2] || '?',
      timeMilli: item.timeMilli
    }));
  } catch (error) {
    console.error('Fetch lỗi:', error.message);
    return null;
  }
}

// ==========================================
// THUẬT TOÁN CỐT LÕI - CỰC MẠNH
// ==========================================

// 1. PHÁT HIỆN QUY LUẬT CHUỖI (BỆT & CẦU)
function timQuyLuat(lichSu) {
  if (lichSu.length < 3) return null;
  
  // Chuỗi bệt
  let bet = 1;
  for (let i = 1; i < lichSu.length; i++) {
    if (lichSu[i] === lichSu[0]) bet++;
    else break;
  }
  
  // Cầu 1-1
  let cau11 = true;
  for (let i = 1; i < Math.min(5, lichSu.length); i++) {
    if (lichSu[i] === lichSu[i-1]) { cau11 = false; break; }
  }
  
  // Cầu 2-2
  let cau22 = false;
  if (lichSu.length >= 6) {
    cau22 = (lichSu[0] === lichSu[1] && lichSu[2] === lichSu[3] && lichSu[4] === lichSu[5] && 
             lichSu[1] !== lichSu[2] && lichSu[3] !== lichSu[4]);
  }
  
  return { bet, cau11, cau22 };
}

// 2. PHÂN TÍCH TẦN SUẤT ĐIỂM (XÁC SUẤT THỐNG KÊ)
function phanTichTanSuatDiem(tongData) {
  if (tongData.length < 30) return null;
  
  const dem = {};
  for (let i = 0; i < tongData.length; i++) dem[tongData[i]] = (dem[tongData[i]] || 0) + 1;
  
  const kyVong = tongData.length / 14;
  const diemThieu = [];
  const diemThua = [];
  
  for (let d = 4; d <= 17; d++) {
    const count = dem[d] || 0;
    const lech = count - kyVong;
    if (lech < -1.5) diemThieu.push({ d, lech });
    if (lech > 1.5) diemThua.push({ d, lech });
  }
  
  diemThieu.sort((a, b) => a.lech - b.lech);
  return { diemThieu: diemThieu.slice(0, 5), diemThua: diemThua.slice(0, 3) };
}

// 3. TÍNH KHOẢNG CÁCH (ĐIỂM LÂU CHƯA VỀ)
function diemLaUChuaVe(tongData) {
  if (tongData.length < 30) return [];
  
  const lastPos = {};
  for (let i = 0; i < tongData.length; i++) {
    if (!lastPos[tongData[i]]) lastPos[tongData[i]] = i;
  }
  
  const result = [];
  for (let d = 4; d <= 17; d++) {
    const pos = lastPos[d] !== undefined ? lastPos[d] : tongData.length;
    result.push({ d, khoangCach: pos });
  }
  
  result.sort((a, b) => b.khoangCach - a.khoangCach);
  return result.slice(0, 6).map(r => r.d);
}

// 4. MARKOV CHAIN (DỰ ĐOÁN DỰA TRÊN 2-3 PHIÊN GẦN NHẤT)
function markovPrediction(tongData) {
  if (tongData.length < 5) return null;
  
  const key = `${tongData[1]}-${tongData[0]}`;
  if (!memory[key]) memory[key] = {};
  
  // Cập nhật ma trận
  for (let i = tongData.length - 2; i >= 0; i--) {
    const k = `${tongData[i+1]}-${tongData[i]}`;
    const next = tongData[i-1];
    if (next) {
      if (!memory[k]) memory[k] = {};
      memory[k][next] = (memory[k][next] || 0) + 1;
    }
  }
  
  const stats = memory[key];
  if (!stats) return null;
  
  const entries = Object.entries(stats);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  return entries.map(([d, c]) => ({ d: parseInt(d), p: (c / total) * 100 })).sort((a, b) => b.p - a.p);
}

// 5. DỰ ĐOÁN LOẠI (TÀI/XỈU) - TỔNG HỢP ĐA CHỈ BÁO
function duDoanLoai(lichSu, tongData) {
  const quyLuat = timQuyLuat(lichSu);
  const tanSuat = phanTichTanSuatDiem(tongData);
  const diemLau = diemLaUChuaVe(tongData);
  const markov = markovPrediction(tongData);
  
  let diemTai = 0, diemXiu = 0;
  let lyDo = [];
  
  // 1. Quy luật chuỗi (trọng số cao)
  if (quyLuat.bet >= 4) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    const diem = 70 + quyLuat.bet * 3;
    duDoan === 'Tài' ? diemTai += diem : diemXiu += diem;
    lyDo.push(`🔥 Bệt ${quyLuat.bet} phiên ${lichSu[0]}`);
  }
  if (quyLuat.cau11) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    duDoan === 'Tài' ? diemTai += 75 : diemXiu += 75;
    lyDo.push(`🎯 Cầu 1-1`);
  }
  if (quyLuat.cau22) {
    const duDoan = lichSu[2] === 'Tài' ? 'Xỉu' : 'Tài';
    duDoan === 'Tài' ? diemTai += 82 : diemXiu += 82;
    lyDo.push(`🔄 Cầu 2-2`);
  }
  
  // 2. Điểm lâu chưa về
  if (diemLau.length > 0) {
    const diemTaiLau = diemLau.filter(d => d >= 11).length;
    const diemXiuLau = diemLau.filter(d => d <= 10).length;
    if (diemTaiLau > diemXiuLau) diemTai += diemTaiLau * 12;
    else if (diemXiuLau > diemTaiLau) diemXiu += diemXiuLau * 12;
    lyDo.push(`⏰ Điểm lâu chưa về: ${diemLau.slice(0, 3).join(',')}`);
  }
  
  // 3. Điểm thiếu (Z-score)
  if (tanSuat && tanSuat.diemThieu.length > 0) {
    const taiThieu = tanSuat.diemThieu.filter(d => d.d >= 11).length;
    const xiuThieu = tanSuat.diemThieu.filter(d => d.d <= 10).length;
    if (taiThieu > xiuThieu) diemTai += taiThieu * 15;
    else if (xiuThieu > taiThieu) diemXiu += xiuThieu * 15;
    lyDo.push(`📊 Điểm thiếu: ${tanSuat.diemThieu.slice(0, 3).map(d => d.d).join(',')}`);
  }
  
  // 4. Markov chain
  if (markov && markov[0]) {
    const diem = markov[0].d;
    diem >= 11 ? diemTai += markov[0].p : diemXiu += markov[0].p;
    lyDo.push(`🔗 Markov: ${diem} (${Math.round(markov[0].p)}%)`);
  }
  
  // 5. Xu hướng tổng điểm 10 phiên
  if (tongData.length >= 10) {
    const avg = tongData.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    if (avg > 12) diemXiu += 20;
    if (avg < 9) diemTai += 20;
    lyDo.push(`📈 TB10: ${avg.toFixed(1)}`);
  }
  
  // QUYẾT ĐỊNH
  let loai = 'Tài';
  let doTinCay = 60;
  
  if (lichSu.length === 1) {
    loai = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    doTinCay = 62;
  } else if (diemTai > diemXiu) {
    loai = 'Tài';
    doTinCay = Math.min(94, 55 + Math.round((diemTai - diemXiu) / (diemTai + diemXiu) * 45));
  } else if (diemXiu > diemTai) {
    loai = 'Xỉu';
    doTinCay = Math.min(94, 55 + Math.round((diemXiu - diemTai) / (diemTai + diemXiu) * 45));
  } else {
    loai = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    doTinCay = 64;
  }
  
  return { loai, doTinCay, lyDo: lyDo.slice(0, 4).join(' | ') };
}

// 6. CHỌN 3 VỊ CỤ THỂ
function chon3Vi(loai, tongData) {
  const tanSuat = phanTichTanSuatDiem(tongData);
  const diemLau = diemLaUChuaVe(tongData);
  const markov = markovPrediction(tongData);
  
  const khoang = loai === 'Tài' ? [11, 12, 13, 14, 15, 16, 17] : [4, 5, 6, 7, 8, 9, 10];
  const diemSo = {};
  
  // Khởi tạo điểm
  khoang.forEach(d => diemSo[d] = 0);
  
  // Điểm lâu chưa về (+30)
  diemLau.forEach(d => { if (khoang.includes(d)) diemSo[d] += 30; });
  
  // Điểm thiếu trong thống kê (+25)
  if (tanSuat && tanSuat.diemThieu) {
    tanSuat.diemThieu.forEach(item => { if (khoang.includes(item.d)) diemSo[item.d] += 25; });
  }
  
  // Markov prediction (+40)
  if (markov && markov[0] && khoang.includes(markov[0].d)) {
    diemSo[markov[0].d] += 40;
  }
  
  // Điểm có tổng đẹp (+15)
  const diemDep = loai === 'Tài' ? [13, 14, 11, 15, 12, 16] : [7, 8, 6, 9, 5, 10];
  diemDep.forEach((d, idx) => { if (khoang.includes(d)) diemSo[d] += (15 - idx); });
  
  // Sắp xếp và chọn 3 điểm cao nhất
  const ketQua = Object.entries(diemSo)
    .map(([d, s]) => ({ d: parseInt(d), s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(item => item.d);
  
  // Nếu thiếu, bổ sung
  if (ketQua.length < 3) {
    const defaultList = loai === 'Tài' ? [13, 14, 11] : [7, 8, 6];
    for (let d of defaultList) {
      if (!ketQua.includes(d) && ketQua.length < 3) ketQua.push(d);
    }
  }
  
  return ketQua;
}

// ==========================================
// DỰ ĐOÁN 2 PHIÊN
// ==========================================
async function duDoan2Phien() {
  const rawData = await fetchData();
  if (!rawData) throw new Error('Không lấy được dữ liệu');
  
  // Cập nhật dữ liệu
  for (const item of rawData) {
    const exists = gameData.data.find(x => x.phien === item.phien);
    if (!exists) {
      gameData.data.unshift(item);
      if (item.tong) gameData.tongData.unshift(item.tong);
    }
  }
  
  if (gameData.data.length > 200) gameData.data = gameData.data.slice(0, 200);
  if (gameData.tongData.length > 200) gameData.tongData = gameData.tongData.slice(0, 200);
  
  const current = gameData.data[0];
  const lichSu = gameData.data.map(d => d.ket_qua).filter(k => k === 'Tài' || k === 'Xỉu');
  const tongData = gameData.tongData;
  
  // KIỂM TRA DỰ ĐOÁN CŨ
  if (gameData.lichSuDuDoan.length > 0 && gameData.lichSuDuDoan[0].ket_qua === 'CHỜ' && current?.ket_qua) {
    const last = gameData.lichSuDuDoan[0];
    if (last.du_doan_loai) {
      const dung = current.ket_qua === last.du_doan_loai;
      dung ? stats.dung++ : stats.sai++;
      stats.tong++;
      stats.tiLe = ((stats.dung / stats.tong) * 100).toFixed(1) + '%';
      last.ket_qua = dung ? 'ĐÚNG' : 'SAI';
      last.thuc_te = current.ket_qua;
    }
  }
  
  // DỰ ĐOÁN PHIÊN 1
  const p1 = duDoanLoai(lichSu, tongData);
  const v1 = chon3Vi(p1.loai, tongData);
  
  // DỰ ĐOÁN PHIÊN 2 (dùng dữ liệu giả định)
  const lichSuGia = [p1.loai, ...lichSu];
  const tongDataGia = [v1[0], ...tongData];
  const p2 = duDoanLoai(lichSuGia, tongDataGia);
  const v2 = chon3Vi(p2.loai, tongDataGia);
  
  // LƯU DỰ ĐOÁN
  gameData.lichSuDuDoan.unshift({
    phien: current?.phien,
    du_doan_loai: p1.loai,
    ba_vi: v1,
    do_tin_cay: p1.doTinCay,
    ly_do: p1.lyDo,
    ket_qua: 'CHỜ',
    thoi_gian: Date.now()
  });
  if (gameData.lichSuDuDoan.length > 100) gameData.lichSuDuDoan.pop();
  
  return {
    success: true,
    game: 'sunwin_sicbo',
    current: {
      phien: current?.phien,
      ket_qua: current?.ket_qua,
      vi: current ? `${current.v1} - ${current.v2} - ${current.v3}` : '? - ? - ?',
      tong: current?.tong || '?'
    },
    du_doan: {
      phien_1: (current?.phien || 0) + 1,
      du_doan_1: p1.loai,
      vi_cuoc_1: v1.join(', '),
      ti_le_1: p1.doTinCay + '%',
      ly_do_1: p1.lyDo,
      
      phien_2: (current?.phien || 0) + 2,
      du_doan_2: p2.loai,
      vi_cuoc_2: v2.join(', '),
      ti_le_2: p2.doTinCay + '%',
      ly_do_2: p2.lyDo
    },
    thong_ke: stats,
    id: '@tranhoang2286',
    lich_su: lichSu.slice(0, 10)
  };
}

// ==========================================
// API
// ==========================================
app.get('/api/games', (req, res) => {
  res.json({ games: ['sunwin_sicbo'], total: 1, author: '@tranhoang2286' });
});

app.get('/api/predict/sunwin_sicbo', async (req, res) => {
  try {
    const result = await duDoan2Phien();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/predict', async (req, res) => {
  try {
    const result = await duDoan2Phien();
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
  const dung = du_doan === ket_qua_thuc_te;
  if (dung) stats.dung++;
  else stats.sai++;
  stats.tong++;
  stats.tiLe = ((stats.dung / stats.tong) * 100).toFixed(1) + '%';
  res.json({ success: true, dung, stats });
});

app.get('/api/stats', (req, res) => res.json(stats));

app.get('/', (req, res) => {
  res.json({
    name: '🔥 SUNWIN SICBO - SIÊU THUẬT TOÁN 🔥',
    author: '@tranhoang2286',
    version: '5.0',
    thuat_toan: ['Bệt (4-7+)', 'Cầu 1-1, 2-2', 'Z-Score thống kê', 'Khoảng cách điểm', 'Markov Chain', 'Trung bình 10 phiên'],
    cach_du_doan: 'Dự đoán 2 phiên liên tiếp, mỗi phiên 3 vị cụ thể',
    endpoints: {
      'Dự đoán': 'GET /api/predict/sunwin_sicbo',
      'Feedback': 'POST /api/feedback',
      'Stats': 'GET /api/stats'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`🔥 SUNWIN SICBO - SIÊU THUẬT TOÁN 🔥`);
  console.log(`============================================================`);
  console.log(`🎯 Dự đoán 2 phiên liên tiếp | 3 vị cụ thể mỗi phiên`);
  console.log(`🧠 Thuật toán: Bệt | Cầu | Z-Score | Khoảng cách | Markov | TB10`);
  console.log(`🚀 PORT: ${PORT}`);
  console.log(`============================================================\n`);
});
