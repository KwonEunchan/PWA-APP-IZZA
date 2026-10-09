"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, doc, updateDoc } from 'firebase/firestore';
import { enablePush, getPushState, detachPush, isIos, type PushState } from '@/lib/push-client';

// 🌐 주소에서 OpenWeather용 영문 도시명을 추출하는 헬퍼 함수
const getCityNameFromAddress = (address: string) => {
  if (!address) return "Seoul";
  if (address.includes("서울")) return "Seoul";
  if (address.includes("부산")) return "Busan";
  if (address.includes("인천")) return "Incheon";
  if (address.includes("대구")) return "Daegu";
  if (address.includes("대전")) return "Daejeon";
  if (address.includes("광주")) return "Gwangju";
  if (address.includes("수원") || address.includes("경기")) return "Gyeonggi-do";
  if (address.includes("제주")) return "Jeju";
  return "Seoul";
};

export default function MyPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string>("유저");
  const [currentUserKey, setCurrentUserKey] = useState<string>("me");
  
  // 상태 카운트 및 새 글 알림(빨간 점) 상태
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [hasUnreadPending, setHasUnreadPending] = useState<boolean>(false);
  const [hasUnreadApproved, setHasUnreadApproved] = useState<boolean>(false);
  const [isCountsLoading, setIsCountsLoading] = useState<boolean>(true);
  
  const [upcomingDate, setUpcomingDate] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);

  // 🔔 푸시 알림 상태
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [isPushBusy, setIsPushBusy] = useState(false);
  const [pushNotice, setPushNotice] = useState('');

  useEffect(() => {
    setPushState(getPushState());
  }, []);

  const handleEnablePush = async () => {
    setIsPushBusy(true);
    setPushNotice('');
    try {
      const result = await enablePush(currentUserKey);
      setPushState(result);
      if (result === 'granted') setPushNotice('알림이 켜졌어요! 아래 버튼으로 테스트해 보세요.');
      if (result === 'denied') setPushNotice('알림이 차단됐어요. 기기 설정에서 허용해 주세요.');
    } catch (e) {
      console.error(e);
      setPushNotice('알림 설정 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setIsPushBusy(true);
    setPushNotice('');
    try {
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: currentUserKey, to: currentUserKey, test: true,
          title: '🔔 이짜! 테스트 알림', body: '알림이 잘 도착했어요 💕', url: '/main',
        }),
      });
      const data = await res.json();
      if (!res.ok) setPushNotice(`전송 실패: ${data.error || res.status}`);
      else if (data.sent > 0) setPushNotice(`테스트 알림을 보냈어요 (기기 ${data.sent}대)`);
      else setPushNotice('등록된 기기가 없어요. 알림 켜기를 다시 눌러주세요.');
    } catch (e) {
      console.error(e);
      setPushNotice('테스트 알림 전송에 실패했어요.');
    } finally {
      setIsPushBusy(false);
    }
  };

  // ☁️ 날씨 상태
  const [weather, setWeather] = useState<{ type: 'available' | 'unavailable' | 'loading'; temp?: number; icon?: string; desc?: string }>({ type: 'loading' });

  const menuItems = [
    { title: "데이트 코스 관리", path: "/archive?tab=all" },
    { title: "과거 데이트 기록", path: "/memory" }
  ];

  useEffect(() => {
    let computedName = "은찬"; 
    let userKey = "me";
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem('currentUser') || 'me';
      userKey = storedUser;
      computedName = storedUser === 'me' ? '은찬' : '민지';
      setUsername(computedName);
      setCurrentUserKey(userKey);
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}.${month}.${day}`;

    const fetchDashboardData = async () => {
      try {
        setIsCountsLoading(true);
        const q = query(collection(db, "date_courses"));
        const snapshot = await getDocs(q);
        
        let p = 0, a = 0;
        let unreadP = false, unreadA = false;
        let closestDate: any = null;

        const updatePromises: Promise<void>[] = [];

        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const id = docSnapshot.id;

          const isUnread = data[`read_${userKey}`] !== true;

          if (data.status === 'approved' && data.date && data.date < todayStr) {
            const courseRef = doc(db, "date_courses", id);
            updatePromises.push(updateDoc(courseRef, { status: 'completed' }));
          } else {
            if (data.status === 'pending') {
              p++;
              if (isUnread) unreadP = true;
            }
            if (data.status === 'approved') {
              a++;
              if (isUnread) unreadA = true;
            }

            if (data.status === 'approved' && data.date >= todayStr) {
              if (!closestDate || data.date < closestDate.date) {
                const targetDate = new Date(data.date.replace(/\./g, '-'));
                const diffDays = Math.ceil((targetDate.getTime() - new Date(todayStr.replace(/\./g, '-')).getTime()) / (1000 * 60 * 60 * 24));
                
                closestDate = { 
                  id: id,
                  title: data.courseName, 
                  date: data.date, 
                  places: data.places,
                  authorName: data.authorName,
                  status: data.status,
                  dday: diffDays === 0 ? "D-Day" : `D-${diffDays}`,
                  diffDays: diffDays
                };
              }
            }
          }
        });

        await Promise.all(updatePromises);
        
        setPendingCount(p);
        setApprovedCount(a);
        setHasUnreadPending(unreadP);
        setHasUnreadApproved(unreadA);
        setUpcomingDate(closestDate);

      } catch (err) {
        console.error("데이터 로드 에러:", err);
      } finally {
        setIsCountsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (upcomingDate && upcomingDate.places && upcomingDate.places.length > 0) {
      const fetchWeather = async () => {
        if (upcomingDate.diffDays > 5) {
          setWeather({ type: 'unavailable' });
          return;
        }

        try {
          const firstPlaceAddress = upcomingDate.places[0].address;
          const city = getCityNameFromAddress(firstPlaceAddress);
          const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY; 
          
          if (!API_KEY) return;

          const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric&lang=kr`);
          if (!res.ok) throw new Error("날씨 정보를 가져오지 못했습니다.");
          
          const data = await res.json();
          const targetDateString = upcomingDate.date.replace(/\./g, '-');
          
          let forecastItem = data.list.find((item: any) => item.dt_txt.startsWith(targetDateString) && item.dt_txt.includes('12:00:00'));
          
          if (!forecastItem) {
            forecastItem = data.list.find((item: any) => item.dt_txt.startsWith(targetDateString));
          }

          if (forecastItem) {
            setWeather({
              type: 'available',
              temp: Math.round(forecastItem.main.temp),
              icon: `https://openweathermap.org/img/wn/${forecastItem.weather[0].icon}@2x.png`,
              desc: forecastItem.weather[0].description
            });
          } else {
            setWeather({ type: 'unavailable' });
          }
        } catch (error) {
          console.error("날씨 페칭 에러:", error);
          setWeather({ type: 'unavailable' });
        }
      };

      fetchWeather();
    }
  }, [upcomingDate]);

  const handleLogout = async () => {
    await detachPush(); // 로그아웃한 기기로는 알림이 가지 않게
    localStorage.clear();
    router.replace('/');
  };

  return (
    <main className="min-h-screen bg-stone-50 pb-28 relative">
      <section className="px-6 pt-14 pb-6 bg-white flex items-center justify-between rounded-b-[24px] shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shadow-sm ${username === '은찬' ? 'bg-blue-50' : 'bg-pink-50'}`}>
            <Image src={username === '은찬' ? '/retriever.png' : '/maltese.png'} alt={username} width={56} height={56} className="w-10 h-10 object-cover" priority />
          </div>
          <div>
            <h2 className="font-bold text-lg text-stone-800">{username}님</h2>
            <p className="text-xs text-stone-400 font-medium">오늘도 즐거운 데이트 하세요!</p>
          </div>
        </div>
        <button onClick={handleLogout} className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-xl text-stone-500 hover:bg-stone-50 transition">로그아웃</button>
      </section>

      {pushState !== 'unsupported' && (
        <section className="mx-6 mt-4">
          {pushState === 'granted' ? (
            <div className="px-4 py-3 bg-white rounded-2xl border border-stone-100 shadow-sm flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-stone-500">🔔 알림 켜짐</span>
              <button
                onClick={handleTestPush}
                disabled={isPushBusy}
                className="text-[11px] font-bold text-stone-500 bg-stone-50 border border-stone-100 px-3 py-1.5 rounded-xl active:bg-stone-100 transition disabled:opacity-50"
              >
                {isPushBusy ? '보내는 중...' : '테스트 알림 받기'}
              </button>
            </div>
          ) : pushState === 'needs-install' ? (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-xs font-bold text-amber-800">📲 알림을 받으려면 홈 화면에 추가해 주세요</p>
              <p className="text-[11px] text-amber-700/80 mt-1 leading-relaxed">
                {isIos()
                  ? 'Safari 하단 공유 버튼 → "홈 화면에 추가" → 홈 화면의 이짜! 아이콘으로 열면 알림을 켤 수 있어요.'
                  : '브라우저 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 눌러주세요.'}
              </p>
            </div>
          ) : pushState === 'denied' ? (
            <div className="p-4 bg-stone-100 rounded-2xl border border-stone-200">
              <p className="text-xs font-bold text-stone-600">🔕 알림이 차단돼 있어요</p>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">기기 설정 → 알림에서 이짜!(또는 이 사이트)의 알림을 허용해 주세요.</p>
            </div>
          ) : (
            <button
              onClick={handleEnablePush}
              disabled={isPushBusy}
              className="w-full p-4 bg-rose-50 rounded-2xl border border-rose-100 text-left active:scale-[0.99] transition disabled:opacity-60"
            >
              <p className="text-xs font-bold text-rose-600">🔔 {isPushBusy ? '알림 설정 중...' : '알림 켜기'}</p>
              <p className="text-[11px] text-rose-500/80 mt-1">상대방이 코스를 보내거나 승인·반려하면 바로 알려드려요.</p>
            </button>
          )}
          {pushNotice && <p className="text-[11px] text-stone-500 font-medium mt-2 px-1">{pushNotice}</p>}
        </section>
      )}

      <section className="px-6 py-4 mt-3">
        <h3 className="font-bold text-stone-800 mb-3 text-sm tracking-tight">📅 곧 다가오는 데이트</h3>
        {upcomingDate ? (
          <div onClick={() => setSelectedCourse(upcomingDate)} className="p-4 bg-orange-50/70 backdrop-blur-sm rounded-2xl border border-orange-100 flex justify-between items-center shadow-sm cursor-pointer hover:bg-orange-100/50 transition relative overflow-hidden">
            <div className="flex-1 min-w-0 z-10 flex flex-col justify-center">
              <p className="font-bold text-stone-800 truncate text-[15px]">{upcomingDate.title}</p>
              
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-xs text-stone-500 font-medium">{upcomingDate.date}</p>
                
                {weather.type === 'available' && (
                  <div className="flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md backdrop-blur-md border border-white shadow-sm">
                    <img src={weather.icon} alt={weather.desc} className="w-[18px] h-[18px] object-contain drop-shadow-sm" />
                    <span className="text-[11px] font-bold text-stone-700 tracking-tight">
                      {weather.desc} {weather.temp}°C
                    </span>
                  </div>
                )}
                {weather.type === 'unavailable' && (
                  <div className="flex items-center px-2 py-0.5 rounded-md bg-stone-200/50 border border-stone-300/30">
                    <span className="text-[10px] font-medium text-stone-500 tracking-tight">날씨정보 미제공</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-orange-500 text-white px-3 py-1.5 rounded-full font-bold text-xs ml-4 flex-shrink-0 shadow-sm z-10">{upcomingDate.dday}</div>
          </div>
        ) : (
          <div className="p-4 bg-white rounded-2xl border border-dashed border-stone-200 text-center text-stone-400 text-xs">예정된 데이트가 없습니다.</div>
        )}
      </section>

      <section className="mx-6 my-2 flex bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div onClick={() => router.push('/archive?tab=waiting')} className="relative flex-1 py-4 flex flex-col items-center justify-center border-r border-stone-100 hover:bg-stone-50/50 transition cursor-pointer">
          {hasUnreadPending && (
            <div className="absolute top-3 left-4 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-sm"></div>
          )}
          <p className="font-bold text-xl text-stone-800">{isCountsLoading ? "..." : `${pendingCount}건`}</p>
          <p className="text-[11px] font-medium text-stone-400 mt-0.5">승인 대기</p>
        </div>

        <div onClick={() => router.push('/archive?tab=approved')} className="relative flex-1 py-4 flex flex-col items-center justify-center hover:bg-stone-50/50 transition cursor-pointer">
          {hasUnreadApproved && (
            <div className="absolute top-3 left-4 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-sm"></div>
          )}
          <p className="font-bold text-xl text-stone-800">{isCountsLoading ? "..." : `${approvedCount}건`}</p>
          <p className="text-[11px] font-medium text-stone-400 mt-0.5">승인 완료</p>
        </div>
      </section>

      <section className="mx-6 mt-3 bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {menuItems.map((item, index) => (
          <div key={index} onClick={() => router.push(item.path)} className="px-5 py-4 flex justify-between items-center border-t border-stone-50 first:border-t-0 hover:bg-stone-50 cursor-pointer">
            <span className="text-sm font-medium text-stone-600">{item.title}</span>
            {/* 💡 투박한 텍스트 화살표 대신 예쁘고 세련된 SVG 아이콘 적용 */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-stone-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        ))}
      </section>

      {selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setSelectedCourse(null)} />
          <div className="w-full max-w-md h-[85vh] bg-stone-50 rounded-t-[32px] z-10 p-6 flex flex-col shadow-2xl animate-slide-up">
            <h2 className="font-bold text-lg text-stone-800 mb-4">{selectedCourse.title}</h2>
            <div className="flex-1 overflow-y-auto space-y-3">
              {selectedCourse.places?.map((p: any, i: number) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-stone-100">
                  <p className="font-bold text-sm">{i+1}. {p.name}</p>
                  <p className="text-xs text-stone-400">{p.address}</p>
                  {p.notes?.map((n: any, ni: number) => n.text && <p key={ni} className="text-xs text-stone-600 bg-stone-50 p-2 mt-1 rounded-lg">{n.text}</p>)}
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedCourse(null)} className="w-full py-4 mt-4 bg-stone-900 text-white rounded-2xl font-bold">닫기</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 w-full px-6 z-20 max-w-md left-1/2 -translate-x-1/2">
        <button 
          onClick={() => router.push('/course/write')} 
          className="w-full py-4.5 bg-stone-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-stone-900/20 active:scale-[0.99] transition transform"
        >
          ✨ 신규 데이트 코스 만들기
        </button>
      </div>
    </main>
  );
}