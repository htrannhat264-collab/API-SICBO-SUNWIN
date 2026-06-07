const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

const SICBO_API = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';

let gameData = { data: [], tongData: [], lichSuDuDoan: [], baoData: [] };
let stats = { tong: 0, dung: 0, sai: 0, tiLe: '0%', boQua: 0, bao: 0 };
let memory = { 
  markov2: {}, 
  markov3: {}, 
  tyLeDung: 0.5, 
  lastBao: null, 
  baoCount: 0,
  cauHoc: new Map()  // BỘ NHỚ HỌC CẦU
};

// ==========================================
// HỆ THỐNG HỌC CẦU TỰ ĐỘNG
// ==========================================

// 1. HỌC CẦU TỪ LỊCH SỬ
function hocCauTuLichSu(lichSu) {
  if (lichSu.length < 10) return;
  
  // Học các pattern 5 phiên
  for (let i = 0; i <= lichSu.length - 6; i++) {
    const pattern = lichSu.slice(i, i + 5).join('');
    const ketQuaTiep = lichSu[i + 5];
    
    if (!memory.cauHoc.has(pattern)) {
      memory.cauHoc.set(pattern, { Tai: 0, Xiu: 0, tong: 0, lanCuoi: i });
    }
    const data = memory.cauHoc.get(pattern);
    if (ketQuaTiep === 'Tài') data.Tai++;
    else data.Xiu++;
    data.tong++;
    data.lanCuoi = i;
  }
  
  // Học pattern 6 phiên
  for (let i = 0; i <= lichSu.length - 7; i++) {
    const pattern = lichSu.slice(i, i + 6).join('');
    const ketQuaTiep = lichSu[i + 6];
    
    if (!memory.cauHoc.has(pattern)) {
      memory.cauHoc.set(pattern, { Tai: 0, Xiu: 0, tong: 0, lanCuoi: i });
    }
    const data = memory.cauHoc.get(pattern);
    if (ketQuaTiep === 'Tài') data.Tai++;
    else data.Xiu++;
    data.tong++;
    data.lanCuoi = i;
  }
  
  // Học pattern 7 phiên
  for (let i = 0; i <= lichSu.length - 8; i++) {
    const pattern = lichSu.slice(i, i + 7).join('');
    const ketQuaTiep = lichSu[i + 7];
    
    if (!memory.cauHoc.has(pattern)) {
      memory.cauHoc.set(pattern, { Tai: 0, Xiu: 0, tong: 0, lanCuoi: i });
    }
    const data = memory.cauHoc.get(pattern);
    if (ketQuaTiep === 'Tài') data.Tai++;
    else data.Xiu++;
    data.tong++;
    data.lanCuoi = i;
  }
}

// 2. NHẬN DẠNG CẦU ĐANG CHẠY (DỰA TRÊN PATTERN ĐÃ HỌC)
function nhanDangCauTuHoc(lichSu) {
  if (lichSu.length < 5) return null;
  
  const patterns = [
    lichSu.slice(0, 5).join(''),
    lichSu.slice(0, 6).join(''),
    lichSu.slice(0, 7).join('')
  ];
  
  let ketQua = [];
  
  for (const pattern of patterns) {
    if (memory.cauHoc.has(pattern)) {
      const data = memory.cauHoc.get(pattern);
      if (data.tong >= 2) {
        const tyLeTai = (data.Tai / data.tong) * 100;
        const duDoan = tyLeTai >= 60 ? 'Tài' : (tyLeTai <= 40 ? 'Xỉu' : null);
        
        if (duDoan) {
          ketQua.push({
            pattern: pattern,
            doDai: pattern.length,
            duDoan: duDoan,
            tyLe: Math.max(tyLeTai, 100 - tyLeTai),
            soLan: data.tong,
            tinCay: Math.min(90, 60 + data.tong * 3)
          });
        }
      }
    }
  }
  
  if (ketQua.length === 0) return null;
  
  // Chọn kết quả có độ tin cậy cao nhất
  ketQua.sort((a, b) => b.tinCay - a.tinCay);
  return ketQua[0];
}

// 3. PHÁT HIỆN CẦU ĐẶC BIỆT TỪ LỊCH SỬ (Bệt, 1-1, 2-2, 3-2)
function phatHienCauDacBiet(lichSu) {
  if (lichSu.length < 5) return null;
  
  // Bệt
  let bet = 1;
  for (let i = 1; i < lichSu.length; i++) {
    if (lichSu[i] === lichSu[0]) bet++;
    else break;
  }
  
  // Cầu 1-1
  let cau11 = true;
  let doDai11 = 0;
  for (let i = 1; i < Math.min(lichSu.length, 15); i++) {
    if (lichSu[i] === lichSu[i-1]) break;
    cau11 = true;
    doDai11 = i;
  }
  
  // Cầu 2-2
  let cau22 = false;
  let doDai22 = 0;
  if (lichSu.length >= 6) {
    let check22 = true;
    for (let i = 0; i < Math.min(lichSu.length, 12); i += 2) {
      if (i + 1 < lichSu.length && lichSu[i] !== lichSu[i+1]) {
        check22 = false;
        break;
      }
      if (i + 2 < lichSu.length && lichSu[i] === lichSu[i+2]) {
        check22 = false;
        break;
      }
    }
    if (check22) {
      cau22 = true;
      doDai22 = Math.floor(lichSu.length / 2) * 2;
    }
  }
  
  // Cầu 3-2
  let cau32 = false;
  if (lichSu.length >= 10) {
    const p5 = lichSu.slice(0, 5).join('');
    if (p5 === "TàiTàiTàiXỉuXỉu" || p5 === "XỉuXỉuXỉuTàiTài") {
      cau32 = true;
    }
  }
  
  return { bet, cau11, doDai11, cau22, doDai22, cau32 };
}

// ==========================================
// PHÂN TÍCH BÃO (TRIPLE)
// ==========================================
function phanTichBao(lichSu, tongData, baoData) {
  if (lichSu.length < 30) return { co: false, lyDo: "Chưa đủ dữ liệu phân tích Bão" };
  
  let canhBao = false;
  let loaiBao = null;
  let doTinCayBao = 0;
  let lyDo = [];
  
  let bet = 1;
  for (let i = 1; i < Math.min(lichSu.length, 10); i++) {
    if (lichSu[i] === lichSu[0]) bet++;
    else break;
  }
  if (bet >= 5) {
    canhBao = true;
    doTinCayBao += 20;
    lyDo.push(`Bệt ${bet} phiên ${lichSu[0]}`);
  }
  
  if (lichSu.length >= 8) {
    let cau11 = true;
    for (let i = 1; i < 8; i++) {
      if (lichSu[i] === lichSu[i-1]) { cau11 = false; break; }
    }
    if (cau11) {
      canhBao = true;
      doTinCayBao += 18;
      lyDo.push(`Cầu 1-1 dài 8 phiên`);
    }
  }
  
  if (memory.lastBao) {
    const soPhienTuBaoCuoi = gameData.data.findIndex(d => d.phien === memory.lastBao);
    if (soPhienTuBaoCuoi > 50 && soPhienTuBaoCuoi !== -1) {
      canhBao = true;
      doTinCayBao += 15;
      lyDo.push(`Đã ${soPhienTuBaoCuoi} phiên chưa có Bão`);
    }
  }
  
  if (tongData.length >= 10) {
    const last10 = tongData.slice(0, 10);
    const diemXuatHien = {};
    for (const d of last10) diemXuatHien[d] = (diemXuatHien[d] || 0) + 1;
    for (const [diem, count] of Object.entries(diemXuatHien)) {
      if (count >= 5) {
        canhBao = true;
        doTinCayBao += 12;
        lyDo.push(`Điểm ${diem} xuất hiện ${count}/10 phiên`);
        break;
      }
    }
  }
  
  const tongBao = baoData.length;
  const kyVongBao = Math.floor(gameData.data.length / 36);
  if (tongBao < kyVongBao && gameData.data.length > 100) {
    canhBao = true;
    doTinCayBao += 10;
    lyDo.push(`Thiếu Bão (${tongBao}/${kyVongBao})`);
  }
  
  if (canhBao) {
    if (tongData.length >= 10) {
      const avg = tongData.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      loaiBao = avg > 12 ? 6 : (avg < 8 ? 1 : Math.round(avg / 3));
      loaiBao = Math.min(6, Math.max(1, loaiBao));
    } else loaiBao = 3;
    doTinCayBao = Math.min(75, doTinCayBao + 45);
  }
  
  return { co: canhBao, doTinCay: doTinCayBao, loaiBao, lyDo: lyDo.join(' | ') };
}

// ==========================================
// KIỂM TRA TÍN HIỆU MẠNH (TÀI/XỈU)
// ==========================================
function tinHieuManh(lichSu, tongData) {
  if (lichSu.length < 5) return { co: false, lyDo: "Chưa đủ dữ liệu" };
  
  // 1. TỪ HỆ THỐNG HỌC CẦU
  const cauHoc = nhanDangCauTuHoc(lichSu);
  if (cauHoc && cauHoc.tinCay >= 70) {
    return { 
      co: true, 
      duDoan: cauHoc.duDoan, 
      doTinCay: cauHoc.tinCay, 
      loai: `CẦU HỌC (${cauHoc.pattern})`,
      tuHoc: true
    };
  }
  
  // 2. TỪ CẦU ĐẶC BIỆT
  const cauDacBiet = phatHienCauDacBiet(lichSu);
  
  if (cauDacBiet.bet >= 5) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { co: true, duDoan, doTinCay: 88 + (cauDacBiet.bet - 5) * 2, loai: `BỆT ${cauDacBiet.bet}` };
  }
  
  if (cauDacBiet.bet === 4) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { co: true, duDoan, doTinCay: 82, loai: "BỆT 4" };
  }
  
  if (cauDacBiet.cau22 && cauDacBiet.doDai22 >= 6) {
    const duDoan = lichSu[4] === 'Tài' ? 'Xỉu' : 'Tài';
    return { co: true, duDoan, doTinCay: 86, loai: "CẦU 2-2" };
  }
  
  if (cauDacBiet.cau11 && cauDacBiet.doDai11 >= 5) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { co: true, duDoan, doTinCay: 84, loai: "CẦU 1-1 DÀI" };
  }
  
  if (cauDacBiet.cau32) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { co: true, duDoan, doTinCay: 82, loai: "CẦU 3-2" };
  }
  
  // 3. TỪ THỐNG KÊ LỆCH PHA
  if (lichSu.length >= 10) {
    const last10 = lichSu.slice(0, 10);
    const tai10 = last10.filter(r => r === 'Tài').length;
    if (tai10 >= 8) return { co: true, duDoan: 'Xỉu', doTinCay: 88, loai: "LỆCH TÀI" };
    if (tai10 <= 2) return { co: true, duDoan: 'Tài', doTinCay: 88, loai: "LỆCH XỈU" };
  }
  
  return { co: false, lyDo: "Không có tín hiệu mạnh" };
}

// 4. CHỌN 3 VỊ
function chon3Vi(loai, tongData) {
  if (tongData.length < 20) return loai === 'Tài' ? [13, 14, 11] : [7, 8, 6];
  
  const dem = {};
  for (let i = 0; i < tongData.length; i++) dem[tongData[i]] = (dem[tongData[i]] || 0) + 1;
  
  const khoang = loai === 'Tài' ? [11,12,13,14,15,16,17] : [4,5,6,7,8,9,10];
  const diemSo = {};
  khoang.forEach(d => diemSo[d] = (dem[d] || 0) * -1);
  
  const lastPos = {};
  for (let i = 0; i < tongData.length; i++) if (!lastPos[tongData[i]]) lastPos[tongData[i]] = i;
  for (let d of khoang) {
    const pos = lastPos[d] !== undefined ? lastPos[d] : tongData.length;
    diemSo[d] += pos * 0.5;
  }
  
  const ketQua = Object.entries(diemSo)
    .map(([d, s]) => ({ d: parseInt(d), s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(item => item.d);
  
  return ketQua.length === 3 ? ketQua : (loai === 'Tài' ? [13, 14, 11] : [7, 8, 6]);
}

// ==========================================
// DỰ ĐOÁN TỔNG HỢP
// ==========================================
async function duDoanTongHop() {
  const rawData = await fetchData();
  if (!rawData) throw new Error('Không lấy được dữ liệu');
  
  for (const item of rawData) {
    if (!gameData.data.find(x => x.phien === item.phien)) {
      gameData.data.unshift(item);
      if (item.tong && item.ket_qua !== 'Bão') gameData.tongData.unshift(item.tong);
      if (item.isBao) {
        gameData.baoData.unshift(item);
        memory.lastBao = item.phien;
        memory.baoCount++;
      }
    }
  }
  
  gameData.data = gameData.data.slice(0, 500);
  gameData.tongData = gameData.tongData.slice(0, 500);
  
  const current = gameData.data[0];
  const lichSu = gameData.data.filter(d => d.ket_qua !== 'Bão').map(d => d.ket_qua);
  const tongData = gameData.tongData;
  const baoData = gameData.baoData;
  
  // HỌC CẦU TỪ LỊCH SỬ
  hocCauTuLichSu(lichSu);
  
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
  
  // PHÂN TÍCH BÃO
  const bao = phanTichBao(lichSu, tongData, baoData);
  
  let duDoan = null;
  let duDoan2 = null;
  
  if (bao.co && bao.doTinCay >= 55) {
    duDoan = {
      coDuDoan: true,
      duDoan: 'Bão',
      vi: `${bao.loaiBao}-${bao.loaiBao}-${bao.loaiBao}`,
      doTinCay: bao.doTinCay,
      loaiTinHieu: 'BÃO SẮP VỀ',
      lyDo: bao.lyDo
    };
  } else {
    const tinHieu = tinHieuManh(lichSu, tongData);
    
    if (tinHieu.co) {
      const vi = chon3Vi(tinHieu.duDoan, tongData);
      duDoan = {
        coDuDoan: true,
        duDoan: tinHieu.duDoan,
        vi: vi,
        doTinCay: tinHieu.doTinCay,
        loaiTinHieu: tinHieu.loai,
        tuHoc: tinHieu.tuHoc || false
      };
      
      const lichSuGia = [tinHieu.duDoan, ...lichSu];
      const tongDataGia = [vi[0], ...tongData];
      const tinHieu2 = tinHieuManh(lichSuGia, tongDataGia);
      if (tinHieu2.co) {
        const vi2 = chon3Vi(tinHieu2.duDoan, tongDataGia);
        duDoan2 = {
          duDoan: tinHieu2.duDoan,
          vi: vi2,
          doTinCay: tinHieu2.doTinCay,
          loaiTinHieu: tinHieu2.loai
        };
      }
    }
  }
  
  if (duDoan && duDoan.coDuDoan) {
    gameData.lichSuDuDoan.unshift({
      phien: current?.phien,
      du_doan_loai: duDoan.duDoan,
      ba_vi: duDoan.vi,
      do_tin_cay: duDoan.doTinCay,
      ket_qua: 'CHỜ',
      thoi_gian: Date.now()
    });
  } else {
    stats.boQua++;
  }
  if (gameData.lichSuDuDoan.length > 100) gameData.lichSuDuDoan.pop();
  
  // Lấy thông tin các cầu đã học gần đây
  const cauDaHoc = Array.from(memory.cauHoc.entries())
    .filter(([_, data]) => data.tong >= 2)
    .slice(0, 5)
    .map(([pattern, data]) => ({
      pattern: pattern,
      tyLeTai: Math.round((data.Tai / data.tong) * 100) + '%',
      soLan: data.tong
    }));
  
  return {
    success: true,
    game: 'sunwin_sicbo',
    current: {
      phien: current?.phien,
      ket_qua: current?.ket_qua || '?',
      vi: current ? `${current.v1} - ${current.v2} - ${current.v3}` : '? - ? - ?',
      tong: current?.tong || '?'
    },
    du_doan: duDoan ? {
      co_nen_cuoc: '✅ NÊN CƯỢC',
      phien: (current?.phien || 0) + 1,
      du_doan: duDoan.duDoan,
      vi_cuoc: typeof duDoan.vi === 'string' ? duDoan.vi : duDoan.vi.join(', '),
      ti_le: duDoan.doTinCay + '%',
      loai_tin_hieu: duDoan.loaiTinHieu,
      tu_hoc: duDoan.tuHoc || false,
      ly_do: duDoan.lyDo || null
    } : {
      co_nen_cuoc: '⏸️ BỎ QUA',
      ly_do: "Không có tín hiệu mạnh",
      note: 'BỎ QUA PHIÊN NÀY ĐỂ BẢO TOÀN VỐN'
    },
    du_doan_phien_2: duDoan2 ? {
      phien: (current?.phien || 0) + 2,
      du_doan: duDoan2.duDoan,
      vi_cuoc: duDoan2.vi.join(', '),
      ti_le: duDoan2.doTinCay + '%',
      loai_tin_hieu: duDoan2.loaiTinHieu
    } : null,
    bao_canh_bao: bao.co ? {
      ty_le: bao.doTinCay + '%',
      loai: `BÃO ${bao.loaiBao}-${bao.loaiBao}-${bao.loaiBao}`,
      ly_do: bao.lyDo
    } : null,
    cau_da_hoc: cauDaHoc,
    thong_ke: {
      ...stats,
      so_lan_bao_da_ra: memory.baoCount,
      last_bao: memory.lastBao,
      so_cau_da_hoc: memory.cauHoc.size
    },
    lich_su_gan_day: lichSu.slice(0, 10),
    id: '@tranhoang2286'
  };
}

async function fetchData() {
  try {
    const res = await axios.get(SICBO_API, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = res.data;
    if (!data?.data?.resultList) return null;
    
    return data.data.resultList.map(item => {
      let ketQua = '';
      let isBao = false;
      
      if (item.resultType === 3) ketQua = 'Tài';
      else if (item.resultType === 4) ketQua = 'Xỉu';
      else if (item.resultType === 11) {
        ketQua = 'Bão';
        isBao = true;
      }
      
      return {
        phien: parseInt(item.gameNum.replace('#', '')) || item.timeMilli,
        ket_qua: ketQua,
        tong: item.score || null,
        v1: item.facesList?.[0] || '?',
        v2: item.facesList?.[1] || '?',
        v3: item.facesList?.[2] || '?',
        isBao: isBao,
        giaTriBao: isBao ? item.facesList?.[0] : null
      };
    });
  } catch (error) {
    console.error('Fetch lỗi:', error.message);
    return null;
  }
}

// ==========================================
// API
// ==========================================
app.get('/api/games', (req, res) => {
  res.json({ games: ['sunwin_sicbo'], total: 1, author: '@tranhoang2286' });
});

app.get('/api/predict/sunwin_sicbo', async (req, res) => {
  try {
    const result = await duDoanTongHop();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/predict', async (req, res) => {
  try {
    const result = await duDoanTongHop();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/feedback', (req, res) => {
  const { du_doan, ket_qua_thuc_te } = req.body;
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
    name: '🔥 SUNWIN SICBO - HỆ THỐNG HỌC CẦU THÔNG MINH 🔥',
    author: '@tranhoang2286',
    tinh_nang: {
      hoc_cau: 'Tự động học các pattern cầu từ lịch sử (5-6-7 phiên)',
      nhan_dang_cau: 'Nhận dạng cầu đang chạy dựa trên pattern đã học',
      bao: 'Phân tích dấu hiệu Bão sắp về',
      tai_xiu: 'Chỉ cược khi có tín hiệu mạnh (Bệt, Cầu, Lệch pha)'
    },
    cau_da_hoc: memory.cauHoc.size,
    endpoints: {
      'Dự đoán': 'GET /api/predict/sunwin_sicbo',
      'Feedback': 'POST /api/feedback'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`🔥 SUNWIN SICBO - HỆ THỐNG HỌC CẦU 🔥`);
  console.log(`============================================================`);
  console.log(`✅ CẦU ĐƯỢC HỌC TỪ LỊCH SỬ THỰC TẾ`);
  console.log(`🎯 TỰ ĐỘNG NHẬN DẠNG CẦU ĐANG CHẠY`);
  console.log(`🚀 PORT: ${PORT}`);
  console.log(`============================================================\n`);
});
