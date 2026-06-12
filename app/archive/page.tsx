"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';

type Note = { id: number; text: string };
type Place = { id: number; name: string; address: string; category: string; notes: Note[] };

type CourseItem = {
  id: string;
  title: string;
  date: string;
  status: 'draft' | 'pending' | 'approved' | 'canceled' | 'completed';
  location: string;
  places: Place[];
  authorName: string;
  read_me?: boolean;
  read_minji?: boolean;
  isDateModified?: boolean;
};

const TAB_MENU = [
  { id: 'all', label: '전체', activeBg: 'bg-stone-900' },
  { id: 'draft', label: '임시 저장', activeBg: 'bg-indigo-600' },
  { id: 'waiting', label: '승인 대기', activeBg: 'bg-orange-500' },
  { id: 'approved', label: '승인 완료', activeBg: 'bg-emerald-600' },
  { id: 'cancel', label: '취소', activeBg: 'bg-gray-600' },
];

export default function ArchivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const currentTabParam = searchParams.get('tab') || 'all';
  const [activeTab, setActiveTab] = useState<string>(currentTabParam);

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<CourseItem | null>(null);
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [todayStr, setTodayStr] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<string>('');

  const displayNameMap: { [key: string]: string } = {
    "me": "은찬",
    "minji": "민지",
    "익명": "익명"
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('currentUser') || 'me'; 
      setCurrentUser(storedUser);

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setTodayStr(`${yyyy}-${mm}-${dd}`);
    }
  }, []);

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "date_courses"),
        where("status", "in", ["draft", "pending", "approved", "canceled"])
      );

      const querySnapshot = await getDocs(q);
      const fetchedData: (CourseItem & { _createdAtMs: number })[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let formattedDate = data.date || "0000.00.00";
        let createdAtMs = 0;

        if (data.createdAt && typeof data.createdAt.toDate === "function") {
          const dateObj = data.createdAt.toDate();
          createdAtMs = dateObj.getTime();
          
          if (formattedDate === "0000.00.00") {
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            formattedDate = `${yyyy}.${mm}.${dd}`;
          }
        }

        let detectedLocation = "지역 미정";
        if (data.places && data.places.length > 0) {
          const fullAddress = data.places[0].address || "";
          const addressParts = fullAddress.split(" ");
          if (addressParts.length >= 2) {
            detectedLocation = `${addressParts[0]} ${addressParts[1]}`;
          } else {
            detectedLocation = addressParts[0] || detectedLocation;
          }
        }

        fetchedData.push({
          id: docSnap.id,
          title: data.courseName || "이름 없는 코스",
          status: data.status,
          date: formattedDate,
          location: detectedLocation,
          places: data.places || [],
          authorName: data.authorName || "익명",
          read_me: data.read_me || false,
          read_minji: data.read_minji || false,
          isDateModified: data.isDateModified || false,
          _createdAtMs: createdAtMs
        });
      });

      fetchedData.sort((a, b) => b._createdAtMs - a._createdAtMs);

      const finalData: CourseItem[] = fetchedData.map(({ _createdAtMs, ...rest }) => rest);
      setCourses(finalData);
    } catch (error: any) {
      console.error("❌ [Firebase Archive Fetch Error]:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleSelectCourse = async (course: CourseItem) => {
    setSelectedCourse(course);

    const userKey = currentUser || 'me';
    const isUnread = userKey === 'minji' ? !course.read_minji : !course.read_me;

    if (isUnread && (course.status === 'pending' || course.status === 'approved')) {
      try {
        const updateField = userKey === 'minji' ? 'read_minji' : 'read_me';
        const courseRef = doc(db, "date_courses", course.id);
        
        await updateDoc(courseRef, {
          [updateField]: true
        });

        setCourses((prev) => prev.map(c => 
          c.id === course.id ? { ...c, [updateField]: true } : c
        ));
      } catch (error) {
        console.error("읽음 처리 실패:", error);
      }
    }
  };

  const handleConfirmAndApprove = async () => {
    if (!selectedCourse) return;
    if (!confirmedDate) {
      alert("데이트 날짜를 선택해 주세요!");
      return;
    }

    if (confirmedDate < todayStr) {
      alert("오늘 이전의 과거 날짜는 데이트 일정으로 설정할 수 없습니다!");
      return;
    }

    setIsSubmitting(true);
    try {
      const dateParts = confirmedDate.split('-');
      const targetFormattedDate = `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}`;

      const isDateChange = selectedCourse.status === 'approved';
      const courseRef = doc(db, "date_courses", selectedCourse.id);
      
      await updateDoc(courseRef, {
        status: 'approved',         
        date: targetFormattedDate,  
        updatedAt: new Date(),
        read_me: currentUser === 'me',       
        read_minji: currentUser === 'minji', 
        ...(isDateChange && { isDateModified: true }) 
      });

      alert(
        isDateChange 
          ? `데이트 일정이 [${targetFormattedDate}]로 변경되었습니다!`
          : `[${selectedCourse.title}] 코스가 승인되었습니다!\n데이트 일정: ${targetFormattedDate}`
      );
      
      setIsDatePickerOpen(false);
      setSelectedCourse(null);
      setConfirmedDate('');
      fetchCourses();
    } catch (err) {
      console.error("코스 처리 중 에러 발생:", err);
      alert("서버 데이터 업데이트에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelApprovedCourse = async (courseId: string) => {
    if (!confirm("정말로 이 데이트 코스를 승인 취소하시겠습니까?")) return;

    try {
      const courseRef = doc(db, "date_courses", courseId);
      await updateDoc(courseRef, {
        status: 'canceled', 
        date: '',           
        updatedAt: new Date(),
        read_me: currentUser === 'me',
        read_minji: currentUser === 'minji'
      });
      alert("데이트 코스가 '승인 취소' 상태로 전환되었습니다.");
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      console.error("코스 승인 취소 작업 중 에러 발생:", err);
      alert("취소 상태 업데이트에 실패했습니다.");
    }
  };

  const handleRejectCourse = async (courseId: string) => {
    if (!confirm("이 데이트 코스를 반려하시겠습니까?\n반려 시 '승인 취소' 상태로 보관됩니다.")) return;

    try {
      const courseRef = doc(db, "date_courses", courseId);
      await updateDoc(courseRef, {
        status: 'canceled',
        updatedAt: new Date(),
        read_me: currentUser === 'me',
        read_minji: currentUser === 'minji'
      });
      alert("✕ 코스 반려 처리가 완료되었습니다.");
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      console.error("코스 반려 에러:", err);
      alert("반려 처리에 실패했습니다.");
    }
  };

  const handleWithdrawCourse = async (courseId: string) => {
    if (!confirm("이 코스의 등록을 취소하고 임시저장 상태로 되돌리시겠습니까?")) return;

    try {
      const courseRef = doc(db, "date_courses", courseId);
      await updateDoc(courseRef, {
        status: 'draft', 
        updatedAt: new Date()
      });
      alert("해당 코스가 임시 보관함으로 이동했습니다.");
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      console.error("코스 등록 취소 에러:", err);
      alert("취소 처리에 실패했습니다.");
    }
  };

  const handlePublishDraftCourse = async (courseId: string) => {
    if (!confirm("임시 저장된 코스를 승인 요청할까요?")) return;
    try {
      const courseRef = doc(db, "date_courses", courseId);
      await updateDoc(courseRef, {
        status: 'pending',
        updatedAt: new Date(),
        read_me: currentUser === 'me',
        read_minji: currentUser === 'minji'
      });
      alert("작성 완료! 상대방 결재 대기 공간으로 전송되었습니다.");
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      console.error("임시저장 발행 중 실패:", err);
    }
  };

  const handleDeleteDraftCourse = async (courseId: string) => {
    if (!confirm("정말로 이 임시저장 코스를 삭제하시겠습니까?\n삭제된 코스는 복구할 수 없습니다.")) return;
    try {
      const courseRef = doc(db, "date_courses", courseId);
      await deleteDoc(courseRef);
      alert("임시저장 코스가 완전히 삭제되었습니다.");
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      console.error("임시저장 삭제 중 실패:", err);
      alert("삭제 처리에 실패했습니다.");
    }
  };

  const filteredCourses = courses.filter((course) => {
    if (activeTab === 'all') {
      if (course.status === 'draft') return course.authorName === currentUser;
      return true;
    }
    if (activeTab === 'draft') {
      return course.status === 'draft' && course.authorName === currentUser;
    }
    if (activeTab === 'waiting') {
      return course.status === 'pending';
    }
    if (activeTab === 'cancel') {
      return course.status === 'canceled';
    }
    return course.status === 'approved';
  });

  return (
    <main className="min-h-screen bg-stone-50 pb-12 pt-[140px] relative">
      
      <header className="fixed top-0 left-0 w-full z-30 pointer-events-none">
        {/* 💡 [핵심] pb-4를 주어 둥근 모서리와 탭 메뉴 간의 상하 간격을 확보합니다. */}
        <div className="bg-white/95 backdrop-blur-md shadow-sm rounded-b-[24px] overflow-hidden pointer-events-auto pb-4">
          
          <div className="pt-14 px-5 flex items-center justify-between pb-3">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-stone-50 rounded-xl transition text-stone-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-[16px] font-bold text-stone-800 tracking-tight">데이트 코스 보관함</h1>
            <div className="w-9 h-9"></div> 
          </div>

          {/* 💡 [핵심] px-5를 가진 이너(Inner) 래퍼를 추가하여, 이 선을 넘어가면 깔끔하게 가려지도록(마스킹) 처리합니다. */}
          <div className="px-5">
            <div 
              className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {TAB_MENU.map((tab) => (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    setActiveTab(tab.id);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === tab.id 
                      ? `${tab.activeBg} text-white shadow-sm` 
                      : 'bg-stone-100 text-stone-400 border border-stone-100 hover:bg-stone-200/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
        </div>
      </header>

      <div className="h-5"></div> {/* 고정 간격이 필요한 경우 */}

      <div className="mx-6 mt-2 flex flex-col gap-4">
        {isLoading ? (
          <div className="text-center py-20 text-stone-400 text-xs font-medium bg-white rounded-2xl border border-stone-100 shadow-sm">
            ⏳ 추억 보관함 데이터를 안전하게 불러오는 중...
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-100 shadow-sm text-stone-300 text-xs font-medium">
            비어있습니다. 새로운 코스를 작성해보세요!
          </div>
        ) : (
          filteredCourses.map((course) => {
            const isUnread = (course.status === 'pending' || course.status === 'approved') && 
                             (currentUser === 'minji' ? !course.read_minji : !course.read_me);

            return (
              <div 
                key={course.id}
                onClick={() => handleSelectCourse(course)}
                className="relative bg-white border border-stone-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
              >
                {isUnread && (
                  <div className="absolute top-4 left-3 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-sm z-10" />
                )}

                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[15px] text-stone-800 tracking-tight mt-2 truncate">
                      {course.title}
                    </h3>
                    <span className="text-[10px] font-semibold text-stone-400 tracking-tight bg-stone-50 px-0 py-0.5 rounded-md ml-0.5">
                    {course.location}
                    </span>
                  </div>

                  {course.status === 'draft' ? (
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg shrink-0">임시 저장</span>
                  ) : course.status === 'pending' ? (
                    <span className="text-[10px] font-bold bg-orange-50 text-orange-500 px-2 py-1 rounded-lg shrink-0">승인 대기</span>
                  ) : course.status === 'canceled' ? (
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-500 px-2 py-1 rounded-lg shrink-0">승인 취소</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg shrink-0">승인 완료</span>
                  )}
                </div>


                <div className="border-t border-stone-50 mt-4 pt-3 flex justify-between items-center">
                  {course.status !== 'approved' ? (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      course.authorName === 'minji' ? 'text-rose-600 bg-rose-50' : 'text-blue-600 bg-blue-50'
                    }`}>
                      {displayNameMap[course.authorName] || course.authorName}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-stone-400 flex items-center gap-1.5">
                      {course.date}
                      {course.isDateModified && (
                        <span className="text-[9px] bg-sky-50 text-sky-500 font-bold px-1.5 py-0.5 rounded-md tracking-tight">일정 변경됨</span>
                      )}
                    </span>
                  )}
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCourse(course);
                    }}
                    className="text-xs font-bold text-stone-500 hover:text-stone-800 bg-stone-50 hover:bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-100 transition"
                  >
                    상세 보기
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setSelectedCourse(null)} />

          <div className="w-full max-w-md h-[83vh] bg-stone-50 rounded-t-[32px] z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-slide-up transform">
            <div className="px-6 pt-4 pb-4 border-b border-stone-100 shrink-0 text-left bg-white">
              <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto mb-3" />
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full overflow-hidden bg-white border-2 flex items-center justify-center shrink-0 p-0.5 shadow-xs ${
                    selectedCourse.authorName === 'minji' ? 'border-rose-300' : 'border-blue-300'
                  }`}>
                    <img 
                      src={selectedCourse.authorName === 'minji' ? '/maltese.png' : '/retriever.png'} 
                      alt="프로필" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-stone-900 text-base tracking-tight truncate">{selectedCourse.title}</h4>
                    <p className="text-[11px] font-semibold mt-0.5 flex items-center gap-1">
                      <span className="text-stone-400">By</span> 
                      <span className={selectedCourse.authorName === 'minji' ? 'text-rose-600 font-bold' : 'text-blue-600 font-bold'}>
                        {displayNameMap[selectedCourse.authorName] || selectedCourse.authorName}
                      </span> 
                      <span className="text-stone-300">•</span> 
                      <span className="text-stone-500">{selectedCourse.status === 'approved' ? selectedCourse.date : '미정'}</span>
                      {selectedCourse.isDateModified && (
                        <span className="text-[9px] bg-sky-50 text-sky-500 font-bold px-1.5 py-0.5 rounded-md tracking-tight ml-1">🔄 변경됨</span>
                      )}
                    </p>
                  </div>
                </div>
                {selectedCourse.status === 'draft' ? (
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg shrink-0">임시 저장</span>
                ) : selectedCourse.status === 'pending' ? (
                  <span className="text-[10px] font-bold bg-orange-50 text-orange-500 px-2 py-1 rounded-lg shrink-0">승인 대기</span>
                ) : selectedCourse.status === 'canceled' ? (
                  <span className="text-[10px] font-bold bg-rose-50 text-rose-500 px-2 py-1 rounded-lg shrink-0">승인 취소</span>
                ) : (
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg shrink-0">승인 완료</span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedCourse.places.map((place, index) => (
                <div key={place.id} className="relative pb-2">
                  {index < selectedCourse.places.length - 1 && (
                    <div className="absolute left-[21px] top-12 bottom-0 w-[2px] border-l-2 border-dashed border-stone-200 z-0" />
                  )}

                  <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-xs relative z-10 flex flex-col gap-3.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-xs font-bold text-white bg-stone-800 w-5 h-5 flex items-center justify-center rounded-full shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-stone-800 text-[14px] tracking-tight">{place.name}</h5>
                        </div>
                      </div>
                      
                      {place.category && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          selectedCourse.authorName === 'minji' ? 'text-rose-600 bg-rose-50/70' : 'text-blue-600 bg-blue-50/70'
                        }`}>
                          {place.category}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-stone-400 font-medium pl-7 -mt-2">
                      📍 {place.address || "등록된 주소 정보가 없습니다."}
                    </div>

                    {place.notes && place.notes.length > 0 && place.notes.some(n => n.text.trim()) && (
                      <div className="bg-stone-50 rounded-xl p-3.5 space-y-2 border border-stone-100/50 ml-7">
                        {place.notes.map((note, nIdx) => note.text.trim() && (
                          <div key={note.id} className="text-xs text-stone-600 font-medium flex items-start gap-2">
                            <span className="text-stone-300 select-none font-bold">{nIdx + 1}.</span>
                            <p className="leading-relaxed whitespace-pre-wrap flex-1">{note.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-stone-100 shrink-0 pb-8 flex flex-col gap-2.5">
              
              {selectedCourse.status === 'draft' && (
                <>
                  <div className="w-full flex gap-2">
                    <button
                      type="button"
                      onClick={() => handlePublishDraftCourse(selectedCourse.id)}
                      className="flex-1 py-3.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/10 active:bg-indigo-700 transition"
                    >
                      승인 요청
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/course/write?id=${selectedCourse.id}`)}
                      className="flex-1 py-3.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs active:bg-stone-300 transition"
                    >
                      이어서 작성하기
                    </button>
                  </div>
                  <div className="w-full flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteDraftCourse(selectedCourse.id)}
                      className="flex-[1] py-3.5 bg-red-50 text-red-600 border border-red-100 font-bold rounded-xl text-xs active:bg-red-100 transition"
                    >
                    삭 제
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCourse(null)}
                      className="flex-[1] py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
                    >
                      닫 기
                    </button>
                  </div>
                </>
              )}

              {selectedCourse.status === 'pending' && selectedCourse.authorName !== currentUser && (
                <>
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(true)}
                      className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl text-xs tracking-wide shadow-md shadow-emerald-600/10 active:bg-emerald-700 transition"
                    >
                      승인 및 날짜 확정
                    </button>
                  </div>
                  <div className="w-full flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRejectCourse(selectedCourse.id)}
                      className="flex-1 py-3.5 bg-red-50 text-red-600 border border-red-100 font-bold rounded-xl text-xs active:bg-red-100 transition"
                    >
                      거 절
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCourse(null)}
                      className="flex-1 py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
                    >
                      닫 기
                    </button>
                  </div>
                </>
              )}

              {selectedCourse.status === 'pending' && selectedCourse.authorName === currentUser && (
                <>
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => handleWithdrawCourse(selectedCourse.id)}
                      className="w-full py-4 bg-stone-200 text-stone-700 font-bold rounded-2xl text-xs active:bg-stone-300 transition"
                    >
                      등록 취소
                    </button>
                  </div>
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => setSelectedCourse(null)}
                      className="w-full py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
                    >
                      닫 기
                    </button>
                  </div>
                </>
              )}

              {selectedCourse.status === 'approved' && (
                <>
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(true)}
                      className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl text-xs tracking-wide shadow-md shadow-blue-500/10 active:bg-blue-700 transition"
                    >
                      데이트 날짜 변경
                    </button>
                  </div>
                  <div className="w-full flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCancelApprovedCourse(selectedCourse.id)}
                      className="flex-1 py-3.5 bg-rose-50 text-rose-600 border border-rose-100 font-bold rounded-xl text-xs active:bg-rose-100 transition"
                    >
                      데이트 일정 취소
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCourse(null)}
                      className="flex-1 py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
                    >
                      닫 기
                    </button>
                  </div>
                </>
              )}
              
              {selectedCourse.status === 'canceled' && (
                <div className="w-full">
                    <button
                      type="button"
                      onClick={() => setSelectedCourse(null)}
                      className="w-full py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
                    >
                      닫 기
                    </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {isDatePickerOpen && selectedCourse && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl animate-fade-in transform transition-all flex flex-col gap-4">
            <div className="text-center">
              <h3 className="font-bold text-stone-900 text-base tracking-tight">
                {selectedCourse.status === 'approved' ? "데이트 일정 변경하기" : "데이트 일정 약속하기"}
              </h3>
              <p className="text-xs text-stone-400 mt-1 font-medium">
                {selectedCourse.status === 'approved' 
                  ? `[${selectedCourse.title}] 코스의 일정을 새로 지정합니다.`
                  : `${displayNameMap[selectedCourse.authorName] || selectedCourse.authorName}님이 올린 코스의 일정을 확정해 주세요.`}
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-400 block mb-1.5 pl-1">변경 일자</label>
              <input
                type="date"
                min={todayStr}
                value={confirmedDate}
                onChange={(e) => setConfirmedDate(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 outline-none font-semibold text-stone-800 text-sm focus:ring-2 focus:ring-emerald-100 focus:bg-white focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => { setIsDatePickerOpen(false); setConfirmedDate(''); }}
                className="flex-1 py-3.5 bg-stone-100 text-stone-500 font-bold rounded-xl text-xs active:bg-stone-200 transition"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isSubmitting || !confirmedDate}
                onClick={handleConfirmAndApprove}
                className="flex-[2] py-3.5 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/10 active:bg-emerald-700 transition disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none"
              >
                {isSubmitting ? "변경 중..." : "확정 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}