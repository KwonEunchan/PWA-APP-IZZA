"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

type Note = { id: number; text: string };
type Place = { 
  id: number; 
  name: string; 
  address: string; 
  category: string; 
  notes: Note[]; 
  isSpecial?: boolean;
  placeUrl?: string;
};

export default function WriteCoursePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('id');

  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoaded, setIsLoaded] = useState(false); 
  const [enabled, setEnabled] = useState(false);
  const [showBottomButton, setShowBottomButton] = useState(false);

  const isProcessingParam = useRef(false);
  const lastScrollY = useRef(0);
  const searchBtnRef = useRef<HTMLDivElement>(null);

  // 저장 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [modalType, setModalType] = useState<'draft' | 'pending'>('pending'); 
  const [isSaving, setIsSaving] = useState(false); 

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const searchBtnTop = searchBtnRef.current?.getBoundingClientRect().top || 0;
      // 버튼이 시야에서 사라졌을 때 && 위로 스크롤 할 때만 노출
      if (searchBtnTop < 0) {
        setShowBottomButton(currentScrollY < lastScrollY.current);
      } else {
        setShowBottomButton(false);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const initData = async () => {
      if (courseId) {
        const docRef = doc(db, "date_courses", courseId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCourseName(data.courseName || '');
          setPlaces(data.places || []);
        }
      } else {
        const savedPlaces = localStorage.getItem('course_places');
        let currentPlaces: Place[] = savedPlaces ? JSON.parse(savedPlaces) : [];
        const nameParam = searchParams.get('name');
        const addressParam = searchParams.get('address');
        const urlParam = searchParams.get('url');

        if (nameParam && addressParam && !isProcessingParam.current) {
          isProcessingParam.current = true;
          const existingPlaceIndex = currentPlaces.findIndex((p) => p.name === nameParam && p.address === addressParam);
          if (existingPlaceIndex !== -1) {
            currentPlaces[existingPlaceIndex].id = Date.now();
            if (urlParam) currentPlaces[existingPlaceIndex].placeUrl = urlParam;
          } else {
            const newPlace: Place = {
              id: Date.now(), name: nameParam, address: addressParam, category: "", placeUrl: urlParam || "", notes: [{ id: Date.now(), text: "" }]
            };
            currentPlaces = [...currentPlaces, newPlace];
          }
          localStorage.setItem('course_places', JSON.stringify(currentPlaces));
          router.replace('/course/write');
        }
        setPlaces(currentPlaces);
      }
      setIsLoaded(true);
    };

    initData();
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => { cancelAnimationFrame(animation); setEnabled(false); };
  }, [searchParams, router, courseId]);

  useEffect(() => {
    if (isLoaded && !courseId) localStorage.setItem('course_places', JSON.stringify(places));
  }, [places, isLoaded, courseId]);

  const handleOnDragEnd = (result: DropResult) => {
    if (!result.destination) return; 
    const items = Array.from(places);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setPlaces(items); 
  };

  const updatePlaceField = (id: number, field: 'category', value: string) => setPlaces(places.map(p => p.id === id ? { ...p, [field]: value } : p));
  const updateNote = (placeId: number, noteId: number, value: string) => setPlaces(places.map(p => p.id === placeId ? { ...p, notes: p.notes.map(n => n.id === noteId ? { ...n, text: value } : n) } : p));
  const addNote = (placeId: number) => setPlaces(places.map(p => p.id === placeId ? { ...p, notes: [...p.notes, { id: Date.now(), text: "" }] } : p));
  const removePlace = (id: number) => setPlaces(places.filter(p => p.id !== id));

  const handleCancelClick = () => {
    if (places.length === 0) { router.back(); return; }
    if (confirm("작성 중이던 코스가 있습니다. 임시 저장하시겠습니까?")) { setModalType('draft'); setIsModalOpen(true); } 
    else { localStorage.removeItem('course_places'); router.back(); }
  };

  const handleSaveToFirebase = async () => {
    if (!courseName.trim()) { alert("코스 이름을 입력해주세요!"); return; }
    setIsSaving(true);
    const currentUser = localStorage.getItem('currentUser') || 'unknown';
    try {
      if (courseId) {
        await updateDoc(doc(db, "date_courses", courseId), { courseName: courseName.trim(), authorName: currentUser, status: modalType, places: places, updatedAt: new Date() });
      } else {
        await addDoc(collection(db, "date_courses"), { courseName: courseName.trim(), authorName: currentUser, status: modalType, places: places, createdAt: new Date(), updatedAt: new Date() });
      }
      localStorage.removeItem('course_places'); setIsModalOpen(false); router.push('/');
    } catch (error) { console.error(error); alert("저장 실패"); } finally { setIsSaving(false); }
  };

  if (!isLoaded || !enabled) return <main className="min-h-screen bg-stone-50" />;

  return (
    <main className="min-h-screen bg-stone-50 pb-32">
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md px-6 pt-14 pb-4 border-b border-stone-100 flex justify-between items-center z-50 shadow-sm">
        <button type="button" onClick={handleCancelClick} className="text-stone-500 font-medium text-sm">취소</button>
        <h1 className="font-bold text-base text-stone-800 tracking-tight">데이트 코스 만들기</h1>
        <button type="button" onClick={() => { if(places.length === 0) alert("장소를 추가해주세요."); else { setModalType('pending'); setIsModalOpen(true); }}} className="text-orange-600 font-bold text-sm">완료</button>
      </header>

      <div className="h-24"></div>

      <section className="p-6">
        <div ref={searchBtnRef} className="w-full mb-6 z-30">
          <button type="button" onClick={() => router.push('/search')} className="w-full py-4.5 border-2 border-dashed border-stone-200 bg-white rounded-2xl text-stone-400 text-sm font-semibold hover:border-orange-200 hover:bg-orange-50/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm">
            + 지도에서 장소 검색하여 추가하기
          </button>
        </div>

        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="places-list">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-0">
                {places.map((place, index) => (
                  <Draggable key={place.id} draggableId={place.id.toString()} index={index}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} className="relative pb-5 select-none">
                        {index < places.length - 1 && <div className="absolute left-[33px] top-12 bottom-0 w-[2px] border-l-2 border-dashed border-stone-300 z-0 flex flex-col justify-center items-center"><span className="text-[10px] text-stone-400 bg-stone-50 px-1 py-0.5 rounded-md font-bold tracking-tighter shadow-xs">↓</span></div>}
                        <div {...provided.dragHandleProps} className={`bg-white p-5 rounded-2xl border border-stone-100 shadow-sm transition relative z-10 ${snapshot.isDragging ? "shadow-xl border-orange-200 bg-orange-50/20 scale-[1.01]" : "hover:shadow-md"}`}>
                          <div className="flex justify-between items-start gap-3 mb-4">
                            <div className="min-w-0 flex-1 flex items-center gap-2.5">
                              <div className="text-xs font-bold text-white bg-orange-500 w-6 h-6 flex items-center justify-center rounded-full shrink-0 shadow-sm">{index + 1}</div>
                              <div className="min-w-0 flex-1"><h3 className="font-bold text-[16px] text-stone-800 truncate">{place.name}</h3><p className="text-xs text-stone-400 mt-0.5 font-medium truncate">{place.address}</p></div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0" onPointerDown={(e) => e.stopPropagation()}>
                              <input type="text" placeholder="구분" className="w-24 text-center text-xs p-2 bg-stone-50 border border-stone-100 rounded-xl outline-none font-semibold text-stone-700" value={place.category} onChange={(e) => updatePlaceField(place.id, 'category', e.target.value)} />
                              <button type="button" onClick={() => removePlace(place.id)} className="p-1.5 text-stone-300 hover:text-stone-500 rounded-lg">✕</button>
                            </div>
                          </div>
                          <div className="space-y-2 border-t border-stone-50 pt-4 pl-8" onPointerDown={(e) => e.stopPropagation()}>
                            {place.notes.map((note, idx) => <input key={note.id} className="w-full text-xs p-3 bg-stone-50/70 border border-stone-100 rounded-xl outline-none font-medium text-stone-700" placeholder={`📝 메모 ${idx + 1}...`} value={note.text} onChange={(e) => updateNote(place.id, note.id, e.target.value)} />)}
                            <button type="button" onClick={() => addNote(place.id)} className="text-xs text-blue-500 font-bold flex items-center gap-1"><span>＋</span> 메모 추가하기</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </section>

      <div className={`fixed bottom-6 left-6 right-6 z-40 transition-all duration-300 ease-in-out ${showBottomButton ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}>
        <button type="button" onClick={() => router.push('/search')} className="w-full py-4 bg-orange-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-orange-600/30">+ 새로운 장소 추가하기</button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="font-bold text-lg text-center">{modalType === 'pending' ? "코스 등록" : "임시 저장"}</h3>
            <input type="text" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="데이크 코스 이름" className="w-full bg-stone-50 p-3 rounded-2xl text-sm" />
            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-stone-100 font-bold rounded-xl text-xs">닫 기</button>
              <button onClick={handleSaveToFirebase} disabled={isSaving} className="flex-[2] py-3 bg-orange-500 text-white font-bold rounded-xl text-xs">{isSaving ? "저장 중..." : "저장히기"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}