"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { syncPush } from '@/lib/push-client';
import { sha256Hex } from '@/lib/sha256';

type AuthMode = 'checking' | 'login' | 'register' | 'confirm' | 'error';

export default function LoginPage() {
  const router = useRouter();

  const [selectedUser, setSelectedUser] = useState<'me' | 'minji' | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // 연타해도 숫자가 씹히지 않도록 입력값은 ref 에 즉시 누적합니다.
  // (state 만 쓰면 렌더 전에 두 번 눌렀을 때 이전 값을 기준으로 덮어써짐)
  const pinRef = useRef('');
  const busyRef = useRef(false);
  const firstPinRef = useRef(''); // 처음 등록 시 1차 입력값 (확인용)
  const modeRef = useRef<AuthMode | null>(null);
  const userRef = useRef<'me' | 'minji' | null>(null);

  const changeMode = (mode: AuthMode | null) => {
    modeRef.current = mode;
    setAuthMode(mode);
  };
  const setPin = (pin: string) => {
    pinRef.current = pin;
    setPassword(pin);
  };
  const setBusy = (busy: boolean) => {
    busyRef.current = busy;
    setIsLoading(busy);
  };
  const failFeedback = (message: string) => {
    setErrorMessage(message);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    try { navigator.vibrate?.(80); } catch { /* 미지원 기기 */ }
  };

  useEffect(() => {
    if (localStorage.getItem('isLoggedIn') === 'true') {
      router.replace('/main');
    }
  }, [router]);

  // 🔐 SHA-256 단방향 암호화(해시) — http IP 접속(폰 테스트)에서도 동작하도록 대체 구현 포함
  const hashPassword = (pwd: string) => sha256Hex(pwd);

  // 👤 입장 버튼: 패드를 바로 띄우고, 뒤에서 등록 여부를 확인합니다.
  const checkUser = async (user: 'me' | 'minji') => {
    changeMode('checking');
    setErrorMessage('');
    try {
      const userDocSnap = await getDoc(doc(db, 'users', user));
      if (userRef.current !== user) return; // 그 사이 닫았거나 다른 사람 선택
      changeMode(userDocSnap.exists() && userDocSnap.data().password ? 'login' : 'register');
    } catch (error) {
      console.error("사용자 정보 조회 실패:", error);
      changeMode('error');
      setErrorMessage("서버와 연결할 수 없어요. 인터넷 연결을 확인해 주세요.");
    }
  };

  const handleUserClick = (user: 'me' | 'minji') => {
    userRef.current = user;
    setSelectedUser(user);
    setPin('');
    firstPinRef.current = '';
    setBusy(false);
    checkUser(user);
  };

  const proceedToMain = (user: 'me' | 'minji') => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', user);
    syncPush(user); // 이 기기에서 이미 알림을 허용했다면 바로 연결
    router.replace('/main');
  };

  // 🚀 6자리가 채워지면 실행
  const submitPin = async (pin: string) => {
    const user = userRef.current;
    const mode = modeRef.current;
    if (!user || pin.length !== 6) return;

    // 처음 등록: 한 번 더 입력받아 오타로 잠기는 일을 막습니다.
    if (mode === 'register') {
      firstPinRef.current = pin;
      setTimeout(() => { setPin(''); changeMode('confirm'); }, 150);
      return;
    }
    if (mode === 'confirm' && pin !== firstPinRef.current) {
      firstPinRef.current = '';
      failFeedback('두 번 입력한 암호가 달라요. 처음부터 다시 입력해 주세요.');
      setTimeout(() => { setPin(''); changeMode('register'); }, 150);
      return;
    }

    setBusy(true);
    setErrorMessage('');
    try {
      const hashedPassword = await hashPassword(pin);
      const userDocRef = doc(db, 'users', user);

      if (mode === 'confirm') {
        await setDoc(userDocRef, { password: hashedPassword }, { merge: true });
        proceedToMain(user);
        return;
      }

      const storedPassword = (await getDoc(userDocRef)).data()?.password;
      if (hashedPassword === storedPassword) {
        proceedToMain(user);
        return;
      }
      failFeedback('비밀번호가 일치하지 않습니다.');
      setPin('');
    } catch (error) {
      console.error("인증 실패:", error);
      failFeedback("오류가 발생했어요. 다시 시도해 주세요.");
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  // 💡 터치패드 입력 제어 로직
  const canType = () =>
    !busyRef.current && (modeRef.current === 'login' || modeRef.current === 'register' || modeRef.current === 'confirm');

  const handleNumberPress = (num: string) => {
    if (!canType() || pinRef.current.length >= 6) return;
    const next = pinRef.current + num;
    setPin(next);
    if (errorMessage) setErrorMessage('');
    if (next.length === 6) submitPin(next);
  };

  const handleBackspace = () => {
    if (!canType()) return;
    setPin(pinRef.current.slice(0, -1));
    setErrorMessage('');
  };

  const handleClear = () => {
    if (!canType()) return;
    setPin('');
    setErrorMessage('');
  };

  const closeModal = () => {
    userRef.current = null;
    setSelectedUser(null);
    changeMode(null);
    setPin('');
    firstPinRef.current = '';
    setErrorMessage('');
  };

  const subtitle =
    authMode === 'checking' ? '확인 중이에요...' :
    authMode === 'register' ? '처음 사용하실 6자리 암호를 등록해 주세요.' :
    authMode === 'confirm' ? '확인을 위해 같은 암호를 한 번 더 입력해 주세요.' :
    authMode === 'error' ? '연결에 실패했어요.' :
    '암호 6자리를 입력해주세요.';
  const padDisabled = isLoading || authMode === 'checking' || authMode === 'error';

  return (
    <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center relative">
      
      {/* 1. 로고 영역 (💡 요청하신 텍스트 요소들을 완전히 지우고 로고만 깔끔하게 남겨두었습니다.) */}
      <div className="flex flex-col items-center mb-12 w-full max-w-sm animate-in fade-in duration-1000">
        <div className="relative w-full aspect-square mb-2">
          <Image 
            src="/logo.png" 
            alt="이짜! 로고" 
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* 2. 간편 입장 버튼 */}
      <div className="w-full max-w-sm space-y-4">
        <button 
          onClick={() => handleUserClick('me')}
          className="w-full p-4 bg-white rounded-3xl shadow-sm border border-stone-200 flex items-center justify-between hover:bg-stone-50 transition active:scale-95 duration-200 disabled:opacity-50"
        >
          <span className="text-lg font-bold ml-2">은찬이로 입장</span>
          <div className="relative w-12 h-12 rounded-full border border-stone-100 bg-stone-100 overflow-hidden flex items-center justify-center">
            <Image 
              src="/retriever.png" 
              alt="은찬이 아이콘" 
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
        </button>

        <button 
          onClick={() => handleUserClick('minji')}
          className="w-full p-4 bg-white rounded-3xl shadow-sm border border-stone-200 flex items-center justify-between hover:bg-stone-50 transition active:scale-95 duration-200 disabled:opacity-50"
        >
          <span className="text-lg font-bold ml-2">민지로 입장</span>
          <div className="relative w-12 h-12 rounded-full border border-pink-100 bg-pink-50 overflow-hidden flex items-center justify-center">
            <Image 
              src="/maltese.png" 
              alt="민지 아이콘" 
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
        </button>
      </div>

      {/* 3. 6자리 전용 숫자 패드 터치 모달 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            
            <div className="text-center mb-4">
              <div className={`w-14 h-14 rounded-full mx-auto mb-3 border-2 flex items-center justify-center shadow-sm overflow-hidden ${selectedUser === 'minji' ? 'border-rose-200 bg-pink-50' : 'border-blue-200 bg-stone-100'}`}>
                <Image 
                  src={selectedUser === 'minji' ? '/maltese.png' : '/retriever.png'} 
                  alt="프로필" 
                  width={36} height={30} className="object-contain"
                />
              </div>
              <h3 className="text-lg font-bold text-stone-800">
                {selectedUser === 'minji' ? '민지' : '은찬이'}로 입장
              </h3>
              <p className="text-[11px] text-stone-400 mt-1 font-medium">{subtitle}</p>
            </div>

            {/* PIN 입력 인디케이터 */}
            <div className={`flex justify-center gap-3.5 my-4 ${shake ? 'animate-shake' : ''}`}>
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                    password.length > i
                      ? 'bg-stone-800 border-stone-800 scale-110 shadow-xs'
                      : 'bg-transparent border-stone-200'
                  }`}
                />
              ))}
            </div>

            <div className="h-5 mb-2">
              {errorMessage && (
                <p className="text-[11px] font-bold text-rose-500 text-center">
                  {errorMessage}
                  {authMode === 'error' && selectedUser && (
                    <button type="button" onClick={() => checkUser(selectedUser)} className="ml-2 underline text-stone-500">다시 시도</button>
                  )}
                </p>
              )}
            </div>

            {/* 터치패드 */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto w-full mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={padDisabled}
                  onClick={() => handleNumberPress(String(num))}
                  className="py-3.5 touch-manipulation bg-stone-50 hover:bg-stone-100/80 active:scale-95 text-lg font-bold text-stone-700 rounded-xl transition-all disabled:opacity-40"
                >
                  {num}
                </button>
              ))}
              
              <button
                type="button"
                disabled={padDisabled}
                onClick={handleClear}
                className="py-3.5 text-[11px] font-bold text-stone-400 active:scale-95 transition-all disabled:opacity-40 hover:text-stone-600"
              >
                초기화
              </button>
              
              <button
                type="button"
                disabled={padDisabled}
                onClick={() => handleNumberPress('0')}
                className="py-3.5 touch-manipulation bg-stone-50 hover:bg-stone-100/80 active:scale-95 text-lg font-bold text-stone-700 rounded-xl transition-all disabled:opacity-40"
              >
                0
              </button>
              
              <button
                type="button"
                disabled={padDisabled}
                onClick={handleBackspace}
                className="py-3.5 text-stone-400 active:scale-95 flex items-center justify-center transition-all disabled:opacity-40 hover:text-stone-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                </svg>
              </button>
            </div>

            <div className="w-full pt-1 border-t border-stone-100">
              <button
                type="button"
                onClick={closeModal}
                className="w-full py-3 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
              >
                닫 기
              </button>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}