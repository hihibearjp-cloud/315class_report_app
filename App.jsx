import React, { useState, useEffect } from 'react';
import { LogOut, Lock, AlertCircle, Share2, Clock, Eye, Save, UserPlus } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, onSnapshot } from "firebase/firestore";

// ==========================================
// 這裡已經換成您專屬的 315Class-Report 設定了！
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCBWQlxFEjio3mE5TSl5X6Ng_c1drXwCf0",
  authDomain: "class-report-3191c.firebaseapp.com",
  projectId: "class-report-3191c",
  storageBucket: "class-report-3191c.firebasestorage.app",
  messagingSenderId: "1077190697392",
  appId: "1:1077190697392:web:ca99c2cfdc157cdf393675",
  measurementId: "G-PMEH4L01SR"
};
const appId = 'class-report-3191c'; // 使用專案 ID 作為資料庫路徑

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authData, setAuthData] = useState({ seatNo: '', password: '' });
  const [teacherPass, setTeacherPass] = useState('');
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [editScores, setEditScores] = useState({});
  const [visiblePasswords, setVisiblePasswords] = useState({}); // 控制密碼顯示狀態
  
  // 新增學生的狀態
  const [newStudent, setNewStudent] = useState({ seatNo: '', name: '', password: '' });
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // 1. 初始化 Firebase 驗證 (已改為正式上線用的純匿名登入)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth); // 直接登入，獲取讀寫權限
      } catch (error) {
        console.error("驗證失敗:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 2. 驗證成功後，監聽公共成績資料庫
  useEffect(() => {
    if (!firebaseUser) return;

    const queryRef = collection(db, 'artifacts', appId, 'public', 'data', 'submissions');
    const unsub = onSnapshot(
      queryRef, 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // 依座號排序
        data.sort((a, b) => Number(a.seatNo) - Number(b.seatNo));
        setStudents(data);
      },
      (error) => {
        console.error("資料讀取失敗:", error);
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  // 學生登入邏輯，並記錄登入次數與最後時間
  const handleLogin = async () => {
    const u = students.find(s => s.seatNo === authData.seatNo && s.password === authData.password);
    if (u) {
      const updatedUser = { 
        ...u, 
        loginCount: (u.loginCount || 0) + 1, 
        lastLogin: new Date().toLocaleString() 
      };
      // 更新登入紀錄到資料庫
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'submissions', u.id), updatedUser);
        setCurrentUser(updatedUser);
      } catch (err) {
        console.error("更新登入紀錄失敗", err);
        setCurrentUser(updatedUser);
      }
    } else { 
      alert('座號或密碼錯誤！請重新輸入。'); 
    }
  };

  // 教師直接修改成績並儲存
  const handleSaveScore = async (student) => {
    const newScore = editScores[student.id];
    if (newScore === undefined || newScore === '') return; // 沒有修改或為空就不動作

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'submissions', student.id), {
        ...student,
        scores: { ...student.scores, '國文': Number(newScore) }
      });
      alert(`${student.name} 的成績已更新為 ${newScore} 分！`);
      
      // 清除該筆編輯狀態
      const updatedScores = { ...editScores };
      delete updatedScores[student.id];
      setEditScores(updatedScores);
    } catch (error) {
      alert("成績儲存失敗：" + error.message);
    }
  };

  // 教師新增學生
  const handleAddStudent = async () => {
    if (!newStudent.seatNo || !newStudent.name || !newStudent.password) {
      alert("請填寫完整的學生資料！");
      return;
    }
    
    // 檢查座號是否重複
    if (students.some(s => s.seatNo === newStudent.seatNo)) {
      alert("此座號已存在！");
      return;
    }

    try {
      const newId = `student_${Date.now()}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'submissions', newId), {
        id: newId,
        seatNo: newStudent.seatNo,
        name: newStudent.name,
        password: newStudent.password,
        loginCount: 0,
        lastLogin: null,
        scores: {}
      });
      setNewStudent({ seatNo: '', name: '', password: '' });
      setIsAddingStudent(false);
      alert(`${newStudent.name} 已成功新增！`);
    } catch (error) {
      alert("新增學生失敗：" + error.message);
    }
  };

  // 分享成績給家長
  const shareResult = (student) => {
    const text = `家長您好，這是 ${student.name} 的成績狀態：${student.scores?.['國文'] ?? '尚未登錄'} 分。查詢連結：${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: '學生成績通知', text }).catch(console.error);
    } else {
      prompt("請複製以下文字並透過 Line 或簡訊發送給家長：", text);
    }
  };

  // 畫面載入中 (等待 Firebase 連線)
  if (!firebaseUser) {
    return <div className="min-h-screen bg-[#F9F6F0] flex items-center justify-center font-sans text-slate-500">系統連線中...</div>;
  }

  // 1. 登入介面
  if (!currentUser && !isTeacher) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-[#00704A]">
          <h2 className="text-2xl font-bold mb-6 text-[#1E3932] flex items-center"><Lock className="mr-2" /> 成績查詢系統</h2>
          <input 
            className="w-full p-3 mb-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00704A] bg-slate-50" 
            placeholder="請輸入座號" 
            value={authData.seatNo}
            onChange={e => setAuthData({...authData, seatNo: e.target.value})} 
          />
          <input 
            className="w-full p-3 mb-6 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00704A] bg-slate-50" 
            type="password" 
            placeholder="請輸入查詢密碼" 
            value={authData.password}
            onChange={e => setAuthData({...authData, password: e.target.value})} 
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <button 
            onClick={handleLogin} 
            className="w-full bg-[#00704A] text-white py-3 rounded-xl font-bold mb-6 hover:bg-[#005a3c] transition shadow-md active:scale-95"
          >
            登入查詢
          </button>
          
          <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
            {showTeacherLogin ? (
              <div className="animate-fade-in bg-slate-50 p-3 rounded-xl">
                <input 
                  className="w-full p-2 mb-2 border rounded-lg text-sm focus:outline-none focus:border-[#966746]" 
                  type="password" 
                  placeholder="請輸入管理員密碼" 
                  onChange={e => setTeacherPass(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      teacherPass === "fxm315" ? setIsTeacher(true) : alert('密碼錯誤！');
                    }
                  }}
                />
                <button 
                  onClick={() => teacherPass === "fxm315" ? setIsTeacher(true) : alert('密碼錯誤！')} 
                  className="w-full bg-[#966746] text-white py-2 rounded-lg text-sm hover:bg-[#7a5338] transition"
                >
                  驗證進入管理員模式
                </button>
              </div>
            ) : (
              <button onClick={() => setShowTeacherLogin(true)} className="w-full text-xs text-slate-400 hover:text-slate-600 transition">
                系統管理入口
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. 系統主畫面 (分為教師版與學生版)
  return (
    <div className="min-h-screen bg-[#F9F6F0] p-4 sm:p-6 font-sans">
      {/* 頂部導覽列 */}
      <header className="bg-[#1E3932] text-white p-4 sm:p-6 rounded-2xl mb-6 flex justify-between items-center shadow-md">
        <h1 className="text-lg sm:text-xl font-bold tracking-wide">
          {isTeacher ? "教師管理後台" : `${currentUser?.name} 的成績看板`}
        </h1>
        <button 
          onClick={() => { setIsTeacher(false); setCurrentUser(null); setAuthData({seatNo:'', password:''}); }} 
          className="bg-[#00704A] p-2 sm:px-4 sm:py-2 rounded-xl flex items-center hover:bg-[#005a3c] transition text-sm font-medium shadow-sm active:scale-95"
        >
          <LogOut size={16} className="sm:mr-1" /> <span className="hidden sm:inline">登出系統</span>
        </button>
      </header>

      <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 max-w-4xl mx-auto">
        {isTeacher ? (
          /* ================= 教師後台畫面 ================= */
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="font-bold text-lg text-slate-700">學生成績總覽</h2>
              <button 
                onClick={() => setIsAddingStudent(!isAddingStudent)}
                className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm flex items-center hover:bg-slate-700 transition"
              >
                <UserPlus size={16} className="mr-1" /> {isAddingStudent ? "取消新增" : "新增學生"}
              </button>
            </div>

            {/* 新增學生區塊 */}
            {isAddingStudent && (
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] p-4 rounded-xl mb-4 flex flex-col sm:flex-row gap-3 items-end">
                <div className="w-full sm:w-1/4">
                  <label className="block text-xs font-bold text-green-800 mb-1">座號</label>
                  <input type="number" className="w-full p-2 border rounded-lg text-sm" placeholder="例如: 1" value={newStudent.seatNo} onChange={e => setNewStudent({...newStudent, seatNo: e.target.value})} />
                </div>
                <div className="w-full sm:w-1/4">
                  <label className="block text-xs font-bold text-green-800 mb-1">姓名</label>
                  <input type="text" className="w-full p-2 border rounded-lg text-sm" placeholder="學生姓名" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                </div>
                <div className="w-full sm:w-1/4">
                  <label className="block text-xs font-bold text-green-800 mb-1">查詢密碼</label>
                  <input type="text" className="w-full p-2 border rounded-lg text-sm" placeholder="設定密碼" value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} />
                </div>
                <div className="w-full sm:w-1/4">
                  <button onClick={handleAddStudent} className="w-full bg-[#00704A] text-white py-2 rounded-lg text-sm font-bold hover:bg-[#005a3c] transition">
                    確認建立
                  </button>
                </div>
              </div>
            )}

            {/* 學生列表區塊 */}
            <div className="space-y-3">
              {students.map(s => (
                <div key={s.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 hover:shadow-sm transition">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3">
                    <span className="font-bold text-[#1E3932] text-lg flex items-center">
                      <span className="bg-slate-200 text-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2">{s.seatNo}</span>
                      {s.name}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#00704A]">
                        <span className="px-2 text-sm text-slate-500 bg-slate-100 border-r py-2">國文</span>
                        <input 
                          type="number" 
                          className="w-16 p-2 text-center font-bold text-[#00704A] focus:outline-none" 
                          value={editScores[s.id] !== undefined ? editScores[s.id] : (s.scores?.['國文'] || '')} 
                          placeholder="-"
                          onChange={e => setEditScores({...editScores, [s.id]: e.target.value})} 
                        />
                      </div>
                      <button 
                        onClick={() => handleSaveScore(s)} 
                        disabled={editScores[s.id] === undefined}
                        className={`p-2.5 rounded-lg flex items-center transition ${editScores[s.id] !== undefined ? 'bg-[#00704A] text-white hover:bg-[#005a3c] shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        title="儲存成績"
                      >
                        <Save size={18}/>
                      </button>
                      <button 
                        onClick={() => shareResult(s)} 
                        className="bg-slate-200 text-slate-700 p-2.5 rounded-lg hover:bg-slate-300 transition flex items-center"
                        title="分享成績通知"
                      >
                        <Share2 size={18}/>
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 mt-1">
                    <span 
                      className="flex items-center bg-white px-2 py-1 rounded border cursor-pointer hover:bg-slate-100 transition"
                      onClick={() => setVisiblePasswords(prev => ({...prev, [s.id]: !prev[s.id]}))}
                      title="點擊顯示/隱藏密碼"
                    >
                      <Lock size={10} className="mr-1"/> 
                      密碼: {visiblePasswords[s.id] ? s.password : '••••'}
                    </span>
                    <span className="flex items-center bg-white px-2 py-1 rounded border"><Eye size={10} className="mr-1"/> 登入: {s.loginCount || 0} 次</span>
                    <span className="flex items-center bg-white px-2 py-1 rounded border"><Clock size={10} className="mr-1"/> 最後: {s.lastLogin || '尚未登入'}</span>
                    {s.scores?.['國文'] === undefined && (
                      <span className="text-red-500 font-bold ml-auto flex items-center"><AlertCircle size={12} className="mr-1"/> 成績尚未登錄</span>
                    )}
                  </div>
                </div>
              ))}
              
              {students.length === 0 && (
                <div className="text-center py-16 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <UserPlus size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium mb-1">目前沒有任何學生資料</p>
                  <p className="text-slate-400 text-sm">請點擊右上角的「新增學生」按鈕來建立名單。</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= 學生個人畫面 ================= */
          <div className="text-center py-12 flex flex-col items-center">
            {currentUser?.scores?.['國文'] === undefined ? 
              <div className="text-red-500 font-bold p-8 border border-red-200 rounded-3xl bg-red-50 flex flex-col items-center max-w-sm w-full shadow-sm">
                <AlertCircle size={48} className="mb-4 text-red-400"/>
                <p className="text-xl">目前尚未有登錄成績</p>
                <p className="text-sm font-normal mt-2 text-red-400">請稍後再回來查看，或聯絡老師確認。</p>
              </div> 
              :
              <div className="bg-[#1E3932] text-white p-10 sm:p-14 rounded-[2rem] w-full max-w-sm shadow-xl transform transition hover:scale-105 border-4 border-[#1E3932]">
                <div className="bg-[#00704A] text-white text-sm font-bold py-1 px-4 rounded-full inline-block mb-6 shadow-inner tracking-widest">
                  國語文評量
                </div>
                <div className="flex items-baseline justify-center">
                  <span className="text-8xl font-black tracking-tighter text-[#CBA258] drop-shadow-md">
                    {currentUser.scores['國文']}
                  </span>
                  <span className="text-2xl ml-3 font-light text-slate-300">分</span>
                </div>
              </div>
            }
          </div>
        )}
      </section>
    </div>
  );
}
