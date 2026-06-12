"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, doc, updateDoc } from 'firebase/firestore';

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
  
  const [aiRecommendation, setAiRecommendation] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(true);
  
  // 상태 카운트 및 새 글 알림(빨간 점) 상태
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [approvedCount, setApprovedCount] = useState<number>(0);
  const [hasUnreadPending, setHasUnreadPending] = useState<boolean>(false);
  const [hasUnreadApproved, setHasUnreadApproved] = useState<boolean>(false);
  const [isCountsLoading, setIsCountsLoading] = useState<boolean>(true);
  
  const [upcomingDate, setUpcomingDate] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);

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

    const fetchAIRecommendation = async () => {
      try {
        setIsAiLoading(true);

        const systemPrompt = `오늘 날짜는 ${todayStr}입니다. 알아서 오늘 서울/경기권의 날씨와 계절감을 고려해 데이트 코스를 하나 추천해주세요. 최신 유행하는 트렌드(영화, 핫한 디저트, 인기 있는 음식 등)를 꼭 반영해서 트렌디하게 구성해주세요. 사용자 이름이나 인사말은 절대 넣지 말고, 오직 데이트 코스에 대한 정보성 텍스트만 깔끔하게 작성해주세요.`;

        const res = await fetch('/date-recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: computedName, 
            date: todayStr,
            prompt: systemPrompt 
          })
        });
        const data = await res.json();
        setAiRecommendation(data.recommendation || "AI 연동이 원활하지 않습니다.");
      } catch (err) {
        setAiRecommendation("AI 연동이 원활하지 않습니다.");
      } finally {
        setIsAiLoading(false);
      }
    };

    fetchDashboardData();
    fetchAIRecommendation();
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

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
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

      <section className="px-6 py-4 mt-2">
        <h3 className="font-bold text-stone-800 mb-3 text-sm flex items-center gap-2 tracking-tight">🎯 AI가 추천하는 데이트 코스</h3>
        <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 shadow-sm">
          {isAiLoading ? <div className="animate-pulse h-4 bg-indigo-200/60 rounded-md"></div> : <p className="text-sm text-indigo-950 font-medium">"{aiRecommendation}"</p>}
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