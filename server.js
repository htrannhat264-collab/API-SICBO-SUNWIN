const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==========================================
// CHỈ GIỮ LẠI API SUNWIN SICBO
// ==========================================
const GAME_APIS = {
  'sunwin_sicbo': 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1'
};

// ==========================================
// LƯU TRỮ DỮ LIỆU
// ==========================================
const gameData = {};
const statsDB = {};
const memory = {};

for (let key in GAME_APIS) {
  gameData[key] = { data: [], tongData: [], lichSuDuDoan: [], feedbackHistory: [] };
  statsDB[key] = { tong: 0, dung: 0, sai: 0, tiLe: '0%' };
  memory[key] = { patterns: [], markovChain: {}, kalmanState: { x: 10.5, p: 1 } };
}

// ==========================================
// HÀM TIỆN ÍCH
// ==========================================
function chuanHoa(ketQua) {
  if (!ketQua) return null;
  const kq = String(ketQua).toLowerCase().trim();
  if (kq === 'tài' || kq === 'tai' || kq === 'big') return 'Tài';
  if (kq === 'xỉu' || kq === 'xiu' || kq === 'small') return 'Xỉu';
  return ketQua;
}

// ==========================================
// FETCH DATA TỪ API SUNWIN SICBO
// ==========================================
async function fetchGameData(url, gameKey) {
  try {
    const headers = { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    };
    const res = await axios.get(url, { timeout: 10000, headers });
    const data = res.data;
    
    if (data?.data?.resultList && Array.isArray(data.data.resultList) && data.data.resultList.length > 0) {
      const resultList = data.data.resultList;
      const formattedData = [];
      
      for (const item of resultList) {
        let ketQua = '';
        if (item.resultType === 3) ketQua = 'Tài';
        else if (item.resultType === 4) ketQua = 'Xỉu';
        else if (item.resultType === 11) ketQua = 'Bão';
        
        if (ketQua !== 'Bão') {
          formattedData.push({
            phien: parseInt(item.gameNum.replace('#', '')) || item.timeMilli,
            ket_qua: chuanHoa(ketQua),
            dice: item.facesList || [],
            tong: item.score || null,
            timeMilli: item.timeMilli
          });
        }
      }
      
      return formattedData;
    }
    return null;
  } catch (error) {
    console.error(`❌ Fetch lỗi:`, error.message);
    return null;
  }
}

// ==========================================
// THUẬT TOÁN DỰ ĐOÁN CỰC MẠNH
// ==========================================

// 1. PHÂN TÍCH BỆT (CHUỖI)
function phanTichBet(lichSu) {
  if (lichSu.length < 2) return { duDoan: null, doTinCay: 0, lyDo: '' };
  
  let streak = 1;
  for (let i = 1; i < Math.min(lichSu.length, 10); i++) {
    if (lichSu[i] === lichSu[0]) streak++;
    else break;
  }
  
  if (streak >= 5) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 92, lyDo: `🔥 BỆT CỰC ĐẠI ${streak} PHIÊN ${lichSu[0]} => BẺ CẦU ${duDoan}` };
  }
  if (streak === 4) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 85, lyDo: `🔥 BỆT ${streak} PHIÊN ${lichSu[0]} => BẺ CẦU ${duDoan}` };
  }
  if (streak === 3) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 75, lyDo: `⚡ BỆT ${streak} PHIÊN ${lichSu[0]} => ĐẢO ${duDoan}` };
  }
  if (streak === 2 && lichSu.length >= 3 && lichSu[2] === lichSu[1]) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 68, lyDo: `📊 BỆT 2 PHIÊN ${lichSu[0]}, ĐANG CHẠY => ĐẢO ${duDoan}` };
  }
  
  return { duDoan: null, doTinCay: 0, lyDo: '' };
}

// 2. PHÂN TÍCH CẦU 1-1 (ZIGZAG)
function phanTichCau11(lichSu) {
  if (lichSu.length < 4) return { duDoan: null, doTinCay: 0, lyDo: '' };
  
  let isZigzag = true;
  for (let i = 1; i < 4; i++) {
    if (lichSu[i] === lichSu[i-1]) {
      isZigzag = false;
      break;
    }
  }
  
  if (isZigzag) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    let doTinCay = 78;
    if (lichSu.length >= 6 && lichSu[4] !== lichSu[3]) doTinCay = 84;
    return { duDoan, doTinCay, lyDo: `🎯 CẦU 1-1 ĐANG CHẠY (${lichSu[0]}→${lichSu[1]}→${lichSu[2]}→${lichSu[3]}) => ${duDoan}` };
  }
  
  return { duDoan: null, doTinCay: 0, lyDo: '' };
}

// 3. PHÂN TÍCH CẦU 2-2 (DOUBLE)
function phanTichCau22(lichSu) {
  if (lichSu.length < 6) return { duDoan: null, doTinCay: 0, lyDo: '' };
  
  const p1 = lichSu[0] === lichSu[1];
  const p2 = lichSu[2] === lichSu[3];
  const p3 = lichSu[4] === lichSu[5];
  const p4 = lichSu[1] !== lichSu[2];
  const p5 = lichSu[3] !== lichSu[4];
  
  if (p1 && p2 && p3 && p4 && p5) {
    const duDoan = lichSu[4] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 86, lyDo: `🔄 CẦU 2-2 ĐANG CHẠY (${lichSu[0]}${lichSu[1]} ${lichSu[2]}${lichSu[3]} ${lichSu[4]}${lichSu[5]}) => ${duDoan}` };
  }
  
  return { duDoan: null, doTinCay: 0, lyDo: '' };
}

// 4. PHÂN TÍCH TẦN SUẤT (LỆCH PHA)
function phanTichTanSuat(lichSu) {
  if (lichSu.length < 10) return { duDoan: null, doTinCay: 0, lyDo: '' };
  
  const last10 = lichSu.slice(0, 10);
  const tai10 = last10.filter(r => r === 'Tài').length;
  const xiu10 = 10 - tai10;
  
  if (tai10 >= 8) {
    return { duDoan: 'Xỉu', doTinCay: 88, lyDo: `📊 10 PHIÊN: ${tai10}T - ${xiu10}X, LỆCH PHA QUÁ LỚN => BẮT XỈU` };
  }
  if (tai10 <= 2) {
    return { duDoan: 'Tài', doTinCay: 88, lyDo: `📊 10 PHIÊN: ${tai10}T - ${xiu10}X, LỆCH PHA QUÁ LỚN => BẮT TÀI` };
  }
  if (tai10 >= 7) {
    return { duDoan: 'Xỉu', doTinCay: 80, lyDo: `📊 10 PHIÊN: ${tai10}T - ${xiu10}X => BẮT XỈU` };
  }
  if (tai10 <= 3) {
    return { duDoan: 'Tài', doTinCay: 80, lyDo: `📊 10 PHIÊN: ${tai10}T - ${xiu10}X => BẮT TÀI` };
  }
  
  // Tần suất 5 phiên
  if (lichSu.length >= 5) {
    const last5 = lichSu.slice(0, 5);
    const tai5 = last5.filter(r => r === 'Tài').length;
    if (tai5 >= 4) return { duDoan: 'Xỉu', doTinCay: 76, lyDo: `📊 5 PHIÊN: ${tai5}T-${5-tai5}X => BẮT XỈU` };
    if (tai5 <= 1) return { duDoan: 'Tài', doTinCay: 76, lyDo: `📊 5 PHIÊN: ${tai5}T-${5-tai5}X => BẮT TÀI` };
  }
  
  return { duDoan: null, doTinCay: 0, lyDo: '' };
}

// 5. PHÂN TÍCH PATTERN MARKOV (HỌC TỪ QUÁ KHỨ)
function phanTichMarkov(lichSu, gameMemory) {
  if (lichSu.length < 8) return { duDoan: null, doTinCay: 0, lyDo: '' };
  
  const mc = gameMemory.markovChain;
  
  // Xây dựng ma trận Markov bậc 2
  for (let i = lichSu.length - 3; i >= 0; i--) {
    const trangThai = lichSu.slice(i + 1, i + 3).join('');
    const ketQuaTiep = lichSu[i];
    if (!mc[trangThai]) mc[trangThai] = { Tài: 0, Xỉu: 0 };
    mc[trangThai][ketQuaTiep]++;
  }
  
  // Dự đoán
  if (lichSu.length >= 2) {
    const trangThaiHienTai = lichSu.slice(0, 2).join('');
    const thongKe = mc[trangThaiHienTai];
    
    if (thongKe && (thongKe.Tài + thongKe.Xỉu) >= 3) {
      const t = thongKe.Tài;
      const x = thongKe.Xỉu;
      if (t !== x) {
        const duDoan = t > x ? 'Tài' : 'Xỉu';
        const tyLe = Math.max(t, x) / (t + x);
        return { duDoan, doTinCay: Math.min(90, 70 + Math.round(tyLe * 20)), lyDo: `🔗 MARKOV [${trangThaiHienTai}] => ${duDoan} (${Math.round(tyLe*100)}% LỊCH SỬ)` };
      }
    }
  }
  
  return { duDoan: null, doTinCay: 0, lyDo: '' };
}

// 6. PHÂN TÍCH ĐIỂM SỐ (NẾU CÓ)
function phanTichDiemSo(tongData) {
  if (!tongData || tongData.length < 5) return { duDoan: null, doTinCay: 0, lyDo: '' };
  
  const last5 = tongData.slice(0, 5);
  const avg = last5.reduce((a, b) => a + b, 0) / 5;
  
  if (avg > 12.5) {
    return { duDoan: 'Xỉu', doTinCay: 74, lyDo: `🎲 ĐIỂM TB 5 PHIÊN ${avg.toFixed(1)} (CAO) => XỈU` };
  }
  if (avg < 8.5) {
    return { duDoan: 'Tài', doTinCay: 74, lyDo: `🎲 ĐIỂM TB 5 PHIÊN ${avg.toFixed(1)} (THẤP) => TÀI` };
  }
  
  return { duDoan: null, doTinCay: 0, lyDo: '' };
}

// 7. TỔNG HỢP TẤT CẢ THUẬT TOÁN
function tongHopDuDoan(lichSu, tongData, gameMemory) {
  const algorithms = [
    phanTichBet(lichSu),
    phanTichCau11(lichSu),
    phanTichCau22(lichSu),
    phanTichTanSuat(lichSu),
    phanTichMarkov(lichSu, gameMemory),
    phanTichDiemSo(tongData)
  ];
  
  let diemTai = 0, diemXiu = 0;
  const activeAlgos = algorithms.filter(a => a.duDoan);
  
  for (const a of activeAlgos) {
    if (a.duDoan === 'Tài') diemTai += a.doTinCay;
    else diemXiu += a.doTinCay;
  }
  
  // TRƯỜNG HỢP 1-2 PHIÊN: XỬ LÝ ĐẶC BIỆT
  if (lichSu.length === 1) {
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 62, lyDo: `⚠️ CHỈ 1 PHIÊN (${lichSu[0]}), DỰ ĐOÁN ĐẢO CẦU: ${duDoan}` };
  }
  
  if (lichSu.length === 2) {
    const last2 = lichSu.slice(0, 2);
    if (last2[0] === last2[1]) {
      const duDoan = last2[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { duDoan, doTinCay: 66, lyDo: `📊 BỆT 2 PHIÊN ${last2[0]} => DỰ ĐOÁN ĐẢO ${duDoan}` };
    } else {
      return { duDoan: last2[0], doTinCay: 64, lyDo: `🔄 CẦU 1-1 (${last2[0]}→${last2[1]}) => THEO ${last2[0]}` };
    }
  }
  
  // ĐỦ DỮ LIỆU (>=3 PHIÊN)
  if (activeAlgos.length === 0) {
    // FALLBACK: THEO QUY LUẬT ĐẢO CẦU
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 64, lyDo: `⚖️ THEO QUY LUẬT ĐẢO CẦU (${lichSu[0]} → ${duDoan})` };
  }
  
  const tongDiem = diemTai + diemXiu;
  const chenhLech = Math.abs(diemTai - diemXiu);
  const tyLeChenh = tongDiem > 0 ? chenhLech / tongDiem : 0;
  
  if (tyLeChenh < 0.15) {
    // CHÊNH LỆCH QUÁ NHỎ, DÙNG FALLBACK
    const duDoan = lichSu[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { duDoan, doTinCay: 62, lyDo: `⚖️ ${activeAlgos.length} THUẬT TOÁN, CHÊNH LỆCH NHỎ => ĐẢO CẦU (${lichSu[0]} → ${duDoan})` };
  }
  
  const duDoan = diemTai > diemXiu ? 'Tài' : 'Xỉu';
  let doTinCay = Math.min(94, Math.round(60 + tyLeChenh * 35));
  
  return { duDoan, doTinCay, lyDo: `${activeAlgos.length} THUẬT TOÁN ĐỒNG THUẬN => ${duDoan} (ĐỘ TIN CẬY ${doTinCay}%)` };
}

// ==========================================
// XỬ LÝ GAME CHÍNH
// ==========================================
async function xuLyGame(gameKey) {
  if (!GAME_APIS[gameKey]) throw new Error(`Game [${gameKey}] không tồn tại`);
  
  const rawData = await fetchGameData(GAME_APIS[gameKey], gameKey);
  if (!rawData || rawData.length === 0) throw new Error(`Không lấy được dữ liệu`);
  
  const game = gameData[gameKey];
  const mem = memory[gameKey];
  
  // CẬP NHẬT TẤT CẢ DỮ LIỆU MỚI
  for (const item of rawData) {
    const daTonTai = game.data.find(x => x.phien === item.phien);
    if (!daTonTai) {
      game.data.unshift(item);
      if (item.tong) game.tongData.unshift(item.tong);
    }
  }
  
  // GIỚI HẠN DỮ LIỆU
  if (game.data.length > 200) game.data = game.data.slice(0, 200);
  if (game.tongData.length > 100) game.tongData = game.tongData.slice(0, 100);
  
  // KẾT QUẢ MỚI NHẤT
  const ketQuaThucTe = game.data[0]?.ket_qua;
  const phienHienTai = game.data[0]?.phien;
  
  // KIỂM TRA DỰ ĐOÁN CŨ
  if (game.lichSuDuDoan.length > 0 && game.lichSuDuDoan[0].ket_qua === 'CHỜ' && ketQuaThucTe) {
    const lastPred = game.lichSuDuDoan[0];
    if (lastPred.du_doan && lastPred.du_doan !== 'KHÔNG DỰ ĐOÁN') {
      const dung = (ketQuaThucTe === lastPred.du_doan);
      if (dung) statsDB[gameKey].dung++;
      else statsDB[gameKey].sai++;
      statsDB[gameKey].tong++;
      statsDB[gameKey].tiLe = ((statsDB[gameKey].dung / statsDB[gameKey].tong) * 100).toFixed(1) + '%';
      lastPred.ket_qua = dung ? 'ĐÚNG' : 'SAI';
      lastPred.thuc_te = ketQuaThucTe;
    }
  }
  
  // LẤY LỊCH SỬ
  const lichSu = game.data.map(d => d.ket_qua).filter(k => k === 'Tài' || k === 'Xỉu');
  const tongData = game.tongData;
  
  // DỰ ĐOÁN
  const duDoanObj = tongHopDuDoan(lichSu, tongData, mem);
  
  // HỌC PATTERN
  if (lichSu.length >= 4) {
    const pattern = lichSu.slice(0, 3).join('-');
    const next = lichSu[3];
    mem.patterns.push({ pattern, next, time: Date.now() });
    if (mem.patterns.length > 500) mem.patterns.shift();
  }
  
  // LƯU DỰ ĐOÁN
  const duDoanCuoi = duDoanObj.duDoan || 'KHÔNG DỰ ĐOÁN';
  const tinCay = duDoanObj.doTinCay || 0;
  const lyDo = duDoanObj.lyDo || '';
  
  game.lichSuDuDoan.unshift({
    phien: phienHienTai,
    du_doan: duDoanCuoi,
    do_tin_cay: tinCay,
    ly_do: lyDo,
    ket_qua: 'CHỜ',
    thoi_gian: Date.now()
  });
  if (game.lichSuDuDoan.length > 100) game.lichSuDuDoan.pop();
  
  const coNenCuoc = tinCay >= 70;
  
  // FORMAT OUTPUT THEO YÊU CẦU
  const formatDice = game.data[0]?.dice ? game.data[0].dice.join(' - ') : '? - ? - ?';
  
  return {
    game: gameKey,
    current: {
      phien: phienHienTai,
      ket_qua: ketQuaThucTe,
      vi: formatDice,
      tong: game.data[0]?.tong || '?'
    },
    du_doan: {
      phien_tiep: phienHienTai + 1,
      du_doan: duDoanCuoi,
      ti_le: tinCay + '%',
      id: '@tranhoang2286',
      co_nen_cuoc: coNenCuoc ? '✅ NÊN CƯỢC' : '⏸️ BỎ QUA',
      ly_do: lyDo
    },
    thong_ke: statsDB[gameKey],
    lich_su: lichSu.slice(0, 10)
  };
}

// ==========================================
// GIAO DIỆN HTML HIỆN ĐẠI
// ==========================================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>🎲 SUNWIN SICBO - AI META PRO 🎲</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                background: linear-gradient(135deg, #0a0f1a 0%, #0f1622 100%);
                font-family: 'Segoe UI', 'Poppins', 'Roboto', sans-serif;
                min-height: 100vh;
                color: #fff;
                padding: 20px;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
            }
            
            /* HEADER */
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding: 20px;
                background: rgba(255,255,255,0.05);
                border-radius: 30px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,215,0,0.3);
            }
            
            .header h1 {
                font-size: 1.8rem;
                background: linear-gradient(135deg, #FFD700, #FFA500);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 8px;
            }
            
            .header p {
                color: #aaa;
                font-size: 0.8rem;
            }
            
            /* CARD CHÍNH */
            .card {
                background: rgba(255,255,255,0.05);
                border-radius: 30px;
                padding: 25px;
                margin-bottom: 20px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.1);
                transition: all 0.3s ease;
            }
            
            /* PHIÊN HIỆN TẠI */
            .current-session {
                text-align: center;
                margin-bottom: 25px;
            }
            
            .badge {
                display: inline-block;
                padding: 5px 15px;
                background: rgba(255,215,0,0.2);
                border-radius: 20px;
                font-size: 0.7rem;
                color: #FFD700;
                margin-bottom: 15px;
            }
            
            .result-box {
                background: linear-gradient(135deg, #1a1f2e, #0f1420);
                border-radius: 20px;
                padding: 20px;
                text-align: center;
            }
            
            .result-value {
                font-size: 3rem;
                font-weight: bold;
                margin: 10px 0;
            }
            
            .result-value.tai { color: #ff4757; text-shadow: 0 0 20px rgba(255,71,87,0.5); }
            .result-value.xiu { color: #1e90ff; text-shadow: 0 0 20px rgba(30,144,255,0.5); }
            
            .dice {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin: 15px 0;
            }
            
            .dice span {
                width: 60px;
                height: 60px;
                background: linear-gradient(145deg, #2a2f3e, #1a1f2e);
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.8rem;
                font-weight: bold;
                color: #FFD700;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
            
            /* DỰ ĐOÁN */
            .prediction-box {
                background: linear-gradient(135deg, #1a1f2e, #0f1420);
                border-radius: 20px;
                padding: 20px;
                text-align: center;
                border: 1px solid rgba(255,215,0,0.3);
            }
            
            .prediction-label {
                font-size: 0.8rem;
                color: #aaa;
                letter-spacing: 2px;
            }
            
            .prediction-value {
                font-size: 3rem;
                font-weight: bold;
                margin: 10px 0;
            }
            
            .prediction-value.tai { color: #ff4757; }
            .prediction-value.xiu { color: #1e90ff; }
            
            .confidence {
                font-size: 1.2rem;
                margin: 10px 0;
            }
            
            .confidence-bar {
                width: 100%;
                height: 8px;
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                overflow: hidden;
                margin: 10px 0;
            }
            
            .confidence-fill {
                height: 100%;
                background: linear-gradient(90deg, #FFD700, #FFA500);
                border-radius: 10px;
                transition: width 0.5s ease;
            }
            
            .recommendation {
                font-size: 1rem;
                margin-top: 15px;
            }
            
            .recommendation.yes {
                color: #2ecc71;
                font-weight: bold;
            }
            
            .recommendation.no {
                color: #e74c3c;
                font-weight: bold;
            }
            
            .reason {
                font-size: 0.75rem;
                color: #aaa;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid rgba(255,255,255,0.1);
            }
            
            /* STATS */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-top: 15px;
            }
            
            .stat-item {
                text-align: center;
                padding: 12px;
                background: rgba(255,255,255,0.05);
                border-radius: 15px;
            }
            
            .stat-value {
                font-size: 1.5rem;
                font-weight: bold;
                color: #FFD700;
            }
            
            .stat-label {
                font-size: 0.7rem;
                color: #aaa;
                margin-top: 5px;
            }
            
            /* LỊCH SỬ */
            .history {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
                margin-top: 15px;
            }
            
            .history-item {
                width: 50px;
                padding: 8px;
                text-align: center;
                background: rgba(255,255,255,0.08);
                border-radius: 10px;
                font-size: 0.8rem;
                font-weight: bold;
            }
            
            .history-item.tai { color: #ff4757; background: rgba(255,71,87,0.15); }
            .history-item.xiu { color: #1e90ff; background: rgba(30,144,255,0.15); }
            
            /* NÚT */
            .btn-refresh {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #FFD700, #FFA500);
                border: none;
                border-radius: 30px;
                font-size: 1rem;
                font-weight: bold;
                color: #1a1f2e;
                cursor: pointer;
                transition: transform 0.2s ease;
                margin-bottom: 15px;
            }
            
            .btn-refresh:hover {
                transform: scale(0.98);
            }
            
            .btn-refresh:active {
                transform: scale(0.96);
            }
            
            /* FOOTER */
            .footer {
                text-align: center;
                color: #555;
                font-size: 0.7rem;
                margin-top: 30px;
            }
            
            /* LOADING */
            .loading {
                text-align: center;
                padding: 40px;
            }
            
            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(255,215,0,0.3);
                border-top-color: #FFD700;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎲 SUNWIN SICBO 🎲</h1>
                <p>AI META PRO - THUẬT TOÁN ĐA TẦNG</p>
                <p style="font-size: 0.7rem; margin-top: 5px;">@tranhoang2286</p>
            </div>
            
            <div id="content">
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Đang tải dữ liệu...</p>
                </div>
            </div>
            
            <footer class="footer">
                <p>⚡ DỰ ĐOÁN DỰA TRÊN 6+ THUẬT TOÁN | ĐỘ CHÍNH XÁC TĂNG DẦN ⚡</p>
            </footer>
        </div>
        
        <script>
            async function fetchPrediction() {
                try {
                    const response = await fetch('/api/predict/sunwin_sicbo');
                    const data = await response.json();
                    renderUI(data);
                } catch (error) {
                    document.getElementById('content').innerHTML = \`
                        <div class="card" style="text-align:center;padding:40px">
                            <p style="color:#e74c3c">❌ LỖI KẾT NỐI</p>
                            <button class="btn-refresh" onclick="fetchPrediction()" style="margin-top:20px">🔄 THỬ LẠI</button>
                        </div>
                    \`;
                }
            }
            
            function renderUI(data) {
                if (!data.success) {
                    document.getElementById('content').innerHTML = \`
                        <div class="card" style="text-align:center;padding:40px">
                            <p style="color:#e74c3c">❌ \${data.error || 'LỖI'}</p>
                            <button class="btn-refresh" onclick="fetchPrediction()">🔄 THỬ LẠI</button>
                        </div>
                    \`;
                    return;
                }
                
                const isTai = data.current.ket_qua === 'Tài';
                const duDoanTai = data.du_doan.du_doan === 'Tài';
                const coNenCuoc = data.du_doan.co_nen_cuoc === '✅ NÊN CƯỢC';
                
                let html = \`
                    <div class="card">
                        <div class="current-session">
                            <span class="badge">📊 PHIÊN HIỆN TẠI</span>
                            <div class="result-box">
                                <div style="font-size:0.8rem; color:#aaa">Phiên #\${data.current.phien}</div>
                                <div class="result-value \${isTai ? 'tai' : 'xiu'}">\${data.current.ket_qua}</div>
                                <div class="dice">
                                    <span>\${data.current.vi.split(' - ')[0]}</span>
                                    <span>\${data.current.vi.split(' - ')[1]}</span>
                                    <span>\${data.current.vi.split(' - ')[2]}</span>
                                </div>
                                <div>Tổng: \${data.current.tong}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="prediction-box">
                            <div class="prediction-label">🎯 DỰ ĐOÁN PHIÊN TIẾP THEO #\${data.du_doan.phien_tiep}</div>
                            <div class="prediction-value \${duDoanTai ? 'tai' : 'xiu'}">\${data.du_doan.du_doan}</div>
                            <div class="confidence">
                                ĐỘ TIN CẬY: <strong style="color:#FFD700">\${data.du_doan.ti_le}</strong>
                            </div>
                            <div class="confidence-bar">
                                <div class="confidence-fill" style="width: \${data.du_doan.ti_le.replace('%','')}%"></div>
                            </div>
                            <div class="recommendation \${coNenCuoc ? 'yes' : 'no'}">
                                \${data.du_doan.co_nen_cuoc}
                            </div>
                            <div class="reason">
                                📌 \${data.du_doan.ly_do || 'Đang phân tích...'}
                            </div>
                            <div style="margin-top: 10px; font-size: 0.7rem; color: #888;">
                                ID: \${data.du_doan.id}
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div style="text-align:center; margin-bottom:15px">
                            <span class="badge">📈 THỐNG KÊ</span>
                        </div>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-value">\${data.thong_ke.tong}</div>
                                <div class="stat-label">TỔNG PHIÊN</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" style="color:#2ecc71">\${data.thong_ke.dung}</div>
                                <div class="stat-label">ĐÚNG</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" style="color:#e74c3c">\${data.thong_ke.sai}</div>
                                <div class="stat-label">SAI</div>
                            </div>
                        </div>
                        <div style="text-align:center; margin-top:10px">
                            <span style="font-size:1.2rem; font-weight:bold; color:#FFD700">\${data.thong_ke.tiLe}</span>
                            <span style="color:#aaa"> TỈ LỆ ĐÚNG</span>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div style="text-align:center; margin-bottom:15px">
                            <span class="badge">📜 LỊCH SỬ 10 PHIÊN</span>
                        </div>
                        <div class="history">
                \`;
                
                for (let kq of data.lich_su) {
                    html += \`<div class="history-item \${kq === 'Tài' ? 'tai' : 'xiu'}">\${kq === 'Tài' ? 'T' : 'X'}</div>\`;
                }
                
                html += \`
                        </div>
                    </div>
                    
                    <button class="btn-refresh" onclick="fetchPrediction()">🔄 CẬP NHẬT DỰ ĐOÁN</button>
                \`;
                
                document.getElementById('content').innerHTML = html;
            }
            
            fetchPrediction();
            setInterval(fetchPrediction, 10000);
        </script>
    </body>
    </html>
  `);
});

// ==========================================
// API ENDPOINTS
// ==========================================

app.get('/api/games', (req, res) => {
  res.json({ 
    games: Object.keys(GAME_APIS), 
    total: Object.keys(GAME_APIS).length,
    author: '@tranhoang2286'
  });
});

app.get('/api/predict/:game', async (req, res) => {
  const gameKey = req.params.game;
  if (!GAME_APIS[gameKey]) {
    return res.status(404).json({ error: 'Game không tồn tại', available: Object.keys(GAME_APIS) });
  }
  
  try {
    const result = await xuLyGame(gameKey);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/feedback/:game', (req, res) => {
  const gameKey = req.params.game;
  const { du_doan, ket_qua_thuc_te } = req.body;
  
  if (!GAME_APIS[gameKey]) {
    return res.status(404).json({ error: 'Game không tồn tại' });
  }
  
  if (!du_doan || !ket_qua_thuc_te) {
    return res.status(400).json({ error: 'Thiếu du_doan hoặc ket_qua_thuc_te' });
  }
  
  const dung = (du_doan === ket_qua_thuc_te);
  const stats = statsDB[gameKey];
  
  if (dung) stats.dung++;
  else stats.sai++;
  stats.tong++;
  stats.tiLe = ((stats.dung / stats.tong) * 100).toFixed(1) + '%';
  
  gameData[gameKey].feedbackHistory.unshift({
    du_doan, thuc_te: ket_qua_thuc_te, ket_qua: dung ? 'ĐÚNG' : 'SAI', thoi_gian: Date.now()
  });
  
  res.json({ success: true, dung, stats });
});

app.get('/api/stats/:game', (req, res) => {
  const gameKey = req.params.game;
  if (!statsDB[gameKey]) return res.status(404).json({ error: 'Chưa có dữ liệu' });
  res.json({ game: gameKey, stats: statsDB[gameKey], author: '@tranhoang2286' });
});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`🔥 SUNWIN SICBO - AI META PRO 🔥`);
  console.log(`============================================================`);
  console.log(`📊 GAME: sunwin_sicbo`);
  console.log(`🎯 THUẬT TOÁN: BET | CẦU 1-1 | CẦU 2-2 | TẦN SUẤT | MARKOV | ĐIỂM SỐ`);
  console.log(`✅ GIAO DIỆN: HIỆN ĐẠI - RESPONSIVE`);
  console.log(`🚀 PORT: ${PORT}`);
  console.log(`============================================================\n`);
});